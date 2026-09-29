/**
 * POST /api/talking/turn — 녹음 → STT → 회화 답변 (연결형 한 턴).
 *
 * 무엇을 하나요?
 * - multipart: audio, practiceLang, scenarioId, history?(JSON 문자열)
 * - Whisper로 사용자 말 → GPT로 봇 답 → { userText, reply, tokens }
 *
 * 왜 reply와 분리했나요?
 * - 녹음이 있으면 STT+채팅을 서버에서 한 번에 처리하는 편이
 *   왕복·권한·에러 처리가 단순합니다.
 */
import { json } from '@sveltejs/kit';
import { toFile } from 'openai';
import { getOpenAI, missingOpenAIKeyError } from '$lib/server/openai.js';
import { generateTalkingReply, transcribeTalkingAudio } from '$lib/server/talking.js';
import { logger } from '$lib/server/logger.js';

/**
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
	const client = getOpenAI();
	if (!client) {
		logger.warn('talking/turn', 'OPENAI_API_KEY 없음');
		return json(missingOpenAIKeyError(), { status: 503 });
	}

	let form;
	try {
		form = await request.formData();
	} catch {
		return json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 });
	}

	const audio = form.get('audio');
	const practiceLang = String(form.get('practiceLang') ?? '');
	// 시나리오 미지정 시 자유 대화
	const scenarioId = String(form.get('scenarioId') ?? 'free');
	const scenarioLabel = String(form.get('scenarioLabel') ?? '') || undefined;
	let history = [];
	try {
		// FormData는 객체를 못 넣어서 JSON 문자열로 옴
		const raw = form.get('history');
		if (typeof raw === 'string' && raw) history = JSON.parse(raw);
	} catch {
		history = [];
	}

	if (!(audio instanceof File) || audio.size === 0) {
		return json({ error: '음성이 비어 있어요. 다시 말해 주세요' }, { status: 400 });
	}
	// stt 엔드포인트와 같은 12MB 상한
	if (audio.size > 12 * 1024 * 1024) {
		return json({ error: '음성이 너무 길어요. 짧게 말해 주세요' }, { status: 400 });
	}
	if (!['ko', 'en', 'ja'].includes(practiceLang)) {
		return json({ error: '지원하지 않는 연습 언어예요' }, { status: 400 });
	}

	logger.info('talking/turn', `요청 · lang=${practiceLang} · scenario=${scenarioId}`);

	try {
		const bytes = Buffer.from(await audio.arrayBuffer());
		const filename = audio.name || 'speech.webm';
		const file = await toFile(bytes, filename, { type: audio.type || 'audio/webm' });

		// 1) 음성 → 글 (연습 언어 힌트)
		const userText = await transcribeTalkingAudio(
			client,
			file,
			/** @type {'ko'|'en'|'ja'} */ (practiceLang)
		);

		// 2) 글 → 회화 답변
		const { reply, tokens } = await generateTalkingReply(client, {
			practiceLang: /** @type {'ko'|'en'|'ja'} */ (practiceLang),
			scenarioId,
			scenarioLabel,
			userText,
			history
		});

		logger.info('talking/turn', `완료 · tokens=${tokens ?? 0}`);
		// billed: 클라이언트가 “이번 턴에 STT+채팅이 나갔다”는 표시/과금 추적용
		return json({ userText, reply, tokens: tokens ?? 0, billed: ['stt', 'chat'] });
	} catch (err) {
		logger.error('talking/turn', '실패', err);
		const raw = err instanceof Error ? err.message : String(err);
		const lower = raw.toLowerCase();
		let error = '음성을 처리하지 못했어요. 다시 말해 주세요';
		if (lower.includes('quota') || lower.includes('credit') || lower.includes('429')) {
			error = 'AI 사용량이 부족해요. 잠시 후 다시 시도해 주세요';
		} else if (lower.includes('empty transcription') || lower.includes('transcription')) {
			error = '음성을 알아듣지 못했어요. 다시 말해 주세요';
		}
		return json({ error }, { status: 502 });
	}
}

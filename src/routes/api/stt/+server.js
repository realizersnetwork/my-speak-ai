/**
 * POST /api/stt — 녹음 파일 → Whisper 텍스트.
 *
 * 무엇을 하나요?
 * - multipart form의 audio(+선택 language)를 받아 OpenAI Whisper로 글자로 바꿉니다.
 *
 * 누가 쓰나요?
 * - My Translate(ConversationStudy): 모바일 등 브라우저 SpeechRecognition이 약할 때 대비.
 *
 * 응답: { text } 성공 / { error } 실패(503 키없음, 400 잘못된 요청, 502 Whisper 실패)
 */
import { json } from '@sveltejs/kit';
import { toFile } from 'openai';
import { getOpenAI, missingOpenAIKeyError } from '$lib/server/openai.js';
import { transcribeAudio } from '$lib/server/talking.js';
import { logger } from '$lib/server/logger.js';

/**
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
	const client = getOpenAI();
	if (!client) {
		logger.warn('stt', 'OPENAI_API_KEY 없음');
		// 503: 서버 설정 문제 — 클라이언트는 “AI 연결 안 됨” 안내
		return json(missingOpenAIKeyError(), { status: 503 });
	}

	let form;
	try {
		form = await request.formData();
	} catch {
		return json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 });
	}

	const audio = form.get('audio');
	const languageRaw = String(form.get('language') ?? '').trim();
	/** 허용된 언어만 힌트로 넘김. 그 외·빈 값 → undefined(Whisper 자동 감지) */
	/** @type {'ko'|'en'|'ja'|undefined} */
	const language =
		languageRaw === 'ko' || languageRaw === 'en' || languageRaw === 'ja'
			? languageRaw
			: undefined;

	if (!(audio instanceof File) || audio.size === 0) {
		return json({ error: '음성이 비어 있어요. 다시 말해 주세요' }, { status: 400 });
	}
	// 12MB: 너무 긴 녹음·남용 방지 (짧은 한 문장 대화에는 충분)
	if (audio.size > 12 * 1024 * 1024) {
		return json({ error: '음성이 너무 길어요. 짧게 말해 주세요' }, { status: 400 });
	}

	logger.info('stt', `요청 · lang=${language ?? 'auto'}`);

	try {
		const bytes = Buffer.from(await audio.arrayBuffer());
		const filename = audio.name || 'speech.webm';
		// OpenAI SDK가 받는 파일 형식으로 변환
		const file = await toFile(bytes, filename, { type: audio.type || 'audio/webm' });
		const text = await transcribeAudio(client, file, language);
		logger.info('stt', '완료');
		return json({ text });
	} catch (err) {
		logger.error('stt', '실패', err);
		const raw = err instanceof Error ? err.message : String(err);
		const lower = raw.toLowerCase();
		let error = '음성을 알아듣지 못했어요. 다시 말해 주세요';
		// 결제·쿼터 문제는 다른 안내로 구분
		if (lower.includes('quota') || lower.includes('credit') || lower.includes('429')) {
			error = 'AI 사용량이 부족해요. 잠시 후 다시 시도해 주세요';
		}
		return json({ error }, { status: 502 });
	}
}

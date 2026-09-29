/**
 * POST /api/talking/reply — 텍스트만으로 Talking AI 답변을 만듭니다.
 *
 * 무엇을 하나요?
 * - JSON { text|userText, practiceLang, scenarioId, ... } → GPT 짧은 회화 답변.
 *
 * 누가 쓰나요?
 * - 글자 입력으로 보낸 턴, 또는 브라우저 STT로 이미 글자가 있을 때.
 *   (녹음이 있으면 /api/talking/turn 을 씀)
 */
import { json } from '@sveltejs/kit';
import { getOpenAI, missingOpenAIKeyError } from '$lib/server/openai.js';
import { generateTalkingReply } from '$lib/server/talking.js';
import { parseTalkingReplyDto } from '$lib/server/dto.js';
import { logger } from '$lib/server/logger.js';

/**
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
	const client = getOpenAI();
	if (!client) {
		logger.warn('talking/reply', 'OPENAI_API_KEY 없음');
		return json(missingOpenAIKeyError(), { status: 503 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 });
	}

	// DTO 검증 — 통과한 데이터만 모델에 넘김
	const parsed = parseTalkingReplyDto(body);
	if (!parsed.ok) {
		return json({ error: parsed.error }, { status: parsed.status });
	}

	const { userText, practiceLang, scenarioId, scenarioLabel, history } = parsed.data;
	logger.info('talking/reply', `요청 · lang=${practiceLang} · scenario=${scenarioId}`);

	try {
		const { reply, tokens } = await generateTalkingReply(client, {
			practiceLang,
			scenarioId,
			scenarioLabel,
			userText,
			history
		});
		logger.info('talking/reply', `완료 · tokens=${tokens ?? 0}`);
		// userText를 다시 돌려줌: 클라이언트가 화면에 확정 표시할 때 쓰기 쉽게
		return json({ reply, userText, tokens: tokens ?? 0 });
	} catch (err) {
		logger.error('talking/reply', '실패', err);
		const raw = err instanceof Error ? err.message : String(err);
		const lower = raw.toLowerCase();
		let error = '답변을 만들지 못했어요. 다시 보내 주세요';
		if (lower.includes('quota') || lower.includes('credit') || lower.includes('429')) {
			error = 'AI 사용량이 부족해요. 잠시 후 다시 시도해 주세요';
		}
		return json({ error }, { status: 502 });
	}
}

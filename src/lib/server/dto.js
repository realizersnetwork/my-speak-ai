/**
 * dto.js — 서버 API로 들어오는 JSON이 “올바른 모양인지” 검사하는 곳입니다.
 *
 * 무엇을 하나요?
 * - Talking 답변(reply) 요청 body를 읽고, 통과하면 data / 실패하면 error+status를 돌려줍니다.
 *
 * 왜 검사하나요?
 * - 클라이언트가 빈 글·이상한 언어·너무 긴 문장을 보내면
 *   OpenAI를 호출하기 전에 막아, 비용·오류를 줄입니다.
 *
 * @typedef {'ko' | 'en' | 'ja'} AppLang 앱이 지원하는 연습/번역 언어
 * @typedef {{ role: 'user' | 'bot'; text: string }} HistoryTurn 이전 말 한 줄(문맥용)
 * @typedef {{
 *   userText: string;
 *   practiceLang: AppLang;
 *   scenarioId?: string;
 *   scenarioLabel?: string;
 *   history?: HistoryTurn[];
 * }} TalkingReplyDto Talking reply API에 넘길 정리된 데이터
 */

/** 지원 언어 목록 — practiceLang 검증에 사용 (여기 없으면 400) */
/** @type {readonly AppLang[]} */
export const APP_LANGS = /** @type {const} */ (['ko', 'en', 'ja']);

/**
 * Talking reply 요청 DTO 검증.
 * @param {unknown} body request.json() 결과(아직 타입 모름)
 * @returns {{ ok: true; data: TalkingReplyDto } | { ok: false; error: string; status: number }}
 */
export function parseTalkingReplyDto(body) {
	if (!body || typeof body !== 'object') {
		return { ok: false, error: '요청 형식이 올바르지 않아요', status: 400 };
	}
	const b = /** @type {Record<string, unknown>} */ (body);
	// 예전 API는 text, 새 API는 userText — 둘 다 받아 호환
	const rawText =
		typeof b.userText === 'string'
			? b.userText
			: typeof b.text === 'string'
				? b.text
				: '';
	const userText = rawText.trim();
	const practiceLang = b.practiceLang;

	// 빈 문장: 모델 호출해도 의미 없음
	if (!userText) return { ok: false, error: '메시지가 비어 있어요', status: 400 };
	// 2000자: 남용·토큰 폭주 방지 (회화 한 턴으로는 충분)
	if (userText.length > 2000) {
		return { ok: false, error: '메시지가 너무 길어요', status: 400 };
	}
	if (!APP_LANGS.includes(/** @type {AppLang} */ (practiceLang))) {
		return { ok: false, error: '지원하지 않는 연습 언어예요', status: 400 };
	}

	return {
		ok: true,
		data: {
			userText,
			practiceLang: /** @type {AppLang} */ (practiceLang),
			// scenarioId 없으면 'free'(자유 대화) — UI에서 시나리오를 안 골라도 동작
			scenarioId: typeof b.scenarioId === 'string' ? b.scenarioId : 'free',
			scenarioLabel: typeof b.scenarioLabel === 'string' ? b.scenarioLabel : undefined,
			// history가 배열이 아니면 빈 배열 — 문맥 없이 한 턴만 답하게
			history: Array.isArray(b.history) ? /** @type {HistoryTurn[]} */ (b.history) : []
		}
	};
}

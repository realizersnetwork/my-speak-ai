/**
 * Talking API 사용량 — 이 브라우저에만 저장 (대략 추적용)
 * 실제 청구액은 OpenAI Usage가 정확합니다.
 */
const storageKey = 'my-speak-ai-talking-usage-v1';

function todayKey() {
	return new Date().toISOString().slice(0, 10);
}

/** @returns {{ day: string; calls: number; turns: number; replies: number; tokens: number }} */
export function getTalkingUsage() {
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return empty();
		const data = JSON.parse(raw);
		if (data.day !== todayKey()) return empty();
		return {
			day: data.day,
			calls: Number(data.calls) || 0,
			turns: Number(data.turns) || 0,
			replies: Number(data.replies) || 0,
			tokens: Number(data.tokens) || 0
		};
	} catch {
		return empty();
	}
}

function empty() {
	return { day: todayKey(), calls: 0, turns: 0, replies: 0, tokens: 0 };
}

/**
 * @param {{ kind: 'turn' | 'reply'; tokens?: number }} input
 */
export function recordTalkingUsage(input) {
	const cur = getTalkingUsage();
	const next = {
		day: todayKey(),
		calls: cur.calls + 1,
		turns: cur.turns + (input.kind === 'turn' ? 1 : 0),
		replies: cur.replies + (input.kind === 'reply' ? 1 : 0),
		tokens: cur.tokens + (Number(input.tokens) || 0)
	};
	localStorage.setItem(storageKey, JSON.stringify(next));
	return next;
}

/** 한 줄 요약 문구 */
export function formatTalkingUsageLine(usage = getTalkingUsage()) {
	if (!usage.calls) return '오늘 API 0회';
	const tokenPart = usage.tokens > 0 ? ` · 토큰 ${usage.tokens.toLocaleString('ko-KR')}` : '';
	return `오늘 API ${usage.calls}회${tokenPart}`;
}

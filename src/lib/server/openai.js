/**
 * openai.js — 서버에서만 OpenAI SDK 클라이언트를 만드는 곳입니다.
 *
 * 무엇을 하나요?
 * - .env의 OPENAI_API_KEY로 OpenAI 객체를 만들고, API 라우트(stt/talking 등)에 넘깁니다.
 *
 * 왜 브라우저가 아니라 서버인가요?
 * - API 키를 프론트에 넣으면 누구나 훔쳐 쓸 수 있습니다.
 *   그래서 키는 서버 환경변수에만 두고, 이 파일로만 꺼 씁니다.
 */
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

/**
 * OpenAI 클라이언트 생성.
 * 키가 없으면 null — 호출하는 쪽에서 503 + 친절한 안내를 내려보냅니다.
 * @returns {import('openai').default | null}
 */
export function getOpenAI() {
	// 서버 전용 환경변수(브라우저 번들에 안 들어감)
	const key = env.OPENAI_API_KEY;
	if (!key) return null;
	return new OpenAI({ apiKey: key });
}

/**
 * 키가 없을 때 API가 돌려줄 공통 JSON 본문.
 * 사용자에게는 기술 용어(API key) 대신 “연결 안 됨” 느낌으로 안내합니다.
 */
export function missingOpenAIKeyError() {
	return {
		error: '지금은 AI에 연결되지 않았어요. 잠시 후 다시 시도해 주세요'
	};
}

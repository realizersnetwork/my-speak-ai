/**
 * Redis(또는 메모리)에 저장하는 “대화 한 턴”의 타입 정의.
 * OpenAI messages의 role/content와 같은 모양이라 그대로 펼쳐 붙일 수 있다.
 */

/** 캐시에 넣는 메시지 한 줄 */
export interface CachedTurn {
	/** user=사람 질문, assistant=봇 답변 */
	role: 'user' | 'assistant';
	/** 그 턴의 텍스트 본문 */
	content: string;
}

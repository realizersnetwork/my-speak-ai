/**
 * Nest POST /openai/chat 로 보낼 요청 몸체(DTO) 모양.
 * 프론트가 JSON으로 이 필드를 넣어 보냅니다.
 */
export interface RequestDTO {
	/**
	 * 사용자가 방금 친 메시지 본문.
	 * 서버는 이 글을 OpenAI(및 RAG)에 넘김
	 */
	content: string;
	/**
	 * Redis(또는 서버 메모리)에 이전 대화를 이어 붙일 때 쓰는 키.
	 * 예: conv_1739… — 같은 ID면 “이어서 말하기”, 새로고침해 바꾸면 새 대화
	 */
	conversationId: string;
}

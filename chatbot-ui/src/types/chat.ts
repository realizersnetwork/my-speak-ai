/**
 * 채팅 UI용 프론트 타입.
 * Nest DTO와 별개로, 화면에 그릴 말풍선 한 줄의 모양만 정의합니다.
 */

/**
 * 말풍선 주인.
 * - user: 내가 보낸 말 (왼쪽·흰 배경)
 * - bot: AI가 보낸 말 (오른쪽·보라 배경)
 */
export type ChatRole = 'user' | 'bot';

/**
 * 화면에 그리는 말풍선 한 줄.
 * history 배열의 원소이자 ChatBubble의 props.message
 */
export interface ChatMessage {
	/**
	 * React list key용 고유 id.
	 * 같은 글이라도 항목을 구분하기 위해 필요
	 */
	id: string;
	/** 왼쪽(user) / 오른쪽(bot) 정렬·색을 정함 */
	role: ChatRole;
	/** 말풍선 안에 보이는 글자 */
	text: string;
}

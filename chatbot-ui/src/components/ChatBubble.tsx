/**
 * 채팅 말풍선 한 개.
 * 사용자/봇에 따라 왼쪽·오른쪽과 색을 바꿉니다 (표본 UI와 맞춤).
 */
import type { ChatMessage } from '../types/chat';
// bubble-row / bubble-user / bubble-bot 색·정렬 스타일
import './ChatBubble.css';

type Props = {
	/** 화면에 그릴 한 줄 메시지 (id·역할·글) */
	message: ChatMessage;
};

/**
 * 말풍선
 * - 사용자: 왼쪽·흰 배경 (표본 UI)
 * - 봇: 오른쪽·보라 배경
 */
export function ChatBubble({ message }: Props) {
	// true면 사용자 → 왼쪽·흰 말풍선 / false면 봇 → 오른쪽·보라 말풍선
	const isUser = message.role === 'user';
	return (
		// bubble-row: 한 줄 전체 폭. user/bot 클래스로 왼쪽·오른쪽 정렬
		<div className={`bubble-row ${isUser ? 'user' : 'bot'}`}>
			{/* bubble + bubble-user|bubble-bot: 실제 말풍선 박스 (색·모서리) */}
			<div className={`bubble ${isUser ? 'bubble-user' : 'bubble-bot'}`}>{message.text}</div>
		</div>
	);
}

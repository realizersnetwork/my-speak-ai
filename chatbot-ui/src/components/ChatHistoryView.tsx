/**
 * 질의/응답이 쌓이는 스크롤 목록 View.
 * ChatView가 history·로딩·bottomRef를 넘겨 주면 말풍선으로 그립니다.
 */
import { type RefObject } from 'react';
import type { ChatMessage } from '../types/chat';
import { ChatBubble } from './ChatBubble';
// chat-messages / typing 등 스크롤 영역 스타일 (ChatView.css와 공유)
import './ChatView.css';

type Props = {
	/** 화면에 그릴 말풍선들 (위→아래 시간순) */
	messages: ChatMessage[];
	/** true면 맨 아래에 “답변 작성 중…” 임시 말풍선 */
	loading: boolean;
	/**
	 * 맨 아래 빈 div를 가리키는 ref.
	 * 부모 ChatView가 scrollIntoView로 “맨 아래로 가기”에 씀
	 */
	bottomRef: RefObject<HTMLDivElement | null>;
};

/** 질의/응답 목록 View — 말풍선 스크롤 영역 */
export function ChatHistoryView({ messages, loading, bottomRef }: Props) {
	return (
		// chat-messages: 세로 스크롤 되는 대화 칸
		// aria-live="polite": 새 말이 생기면 스크린 리더가 방해 없이 알려 줌
		<main className="chat-messages" aria-live="polite">
			{messages.map((m) => (
				// key=m.id: React가 어떤 말풍선이 바뀌었는지 구분 (고유 id)
				<ChatBubble key={m.id} message={m} />
			))}
			{loading && (
				// 봇 자리(오른쪽)에 임시 “작성 중” 말풍선
				<div className="bubble-row bot">
					<div className="bubble bubble-bot typing">답변 작성 중…</div>
				</div>
			)}
			{/* 자동 스크롤 앵커 — 높이 0인 빈 점. 새 메시지 후 여기로 스크롤 */}
			<div ref={bottomRef} />
		</main>
	);
}

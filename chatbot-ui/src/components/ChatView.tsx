/**
 * Your Own Chatbot 메인 화면.
 * - 위: 제목 + 세션/캐시/RAG 정보
 * - 가운데: 말풍선 대화 목록
 * - 아래: 메시지 입력·전송
 * 마운트 시 conversationId를 만들고, 매 질문마다 Nest에 실어 Redis 문맥을 이어 갑니다.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
// Nest /openai/chat 호출 + Axios 오류를 한글 문구로 바꿈
import { askChatbot, toNetworkErrorMessage } from '../api/openai';
import type { RequestDTO } from '../dto/openai/requestDto';
import type { ChatMessage } from '../types/chat';
import { ChatHistoryView } from './ChatHistoryView';
import { SearchBarView } from './SearchBarView';
import { UserInputView } from './UserInputView';
import './ChatView.css';

/**
 * 말풍선마다 서로 다른 id를 만듦.
 * 무엇을: 시간 + 짧은 난수 문자열
 * 왜: React list의 key로 써, 같은 글이어도 항목을 구분하기 위해
 */
function msgId() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Your Own Chatbot — 대화형 UI + Q&A
 * 마운트 시 conversationId 생성 → 매 요청에 실어 Redis 문맥 유지
 */
export function ChatView() {
	/**
	 * 화면에 보이는 Q&A 말풍선 목록.
	 * 처음에는 환영 메시지 하나만 넣어 둠 (빈 화면이 어색하지 않게)
	 */
	const [history, setHistory] = useState<ChatMessage[]>([
		{
			id: 'welcome',
			role: 'bot',
			text: '안녕하세요! Your Own Chatbot입니다. 무엇이든 물어보세요.'
		}
	]);
	/** 아래 입력창에 타이핑 중인 글자 — 전송 후 비움 */
	const [input, setInput] = useState('');
	/** true면 “답변 작성 중…” 표시 + 입력·전송 잠금 (중복 요청 방지) */
	const [isLoading, setIsLoading] = useState(false);
	/** 빨간 글씨로 보여줄 짧은 오류 문구 (네트워크 등) */
	const [error, setError] = useState('');
	/**
	 * Redis(또는 서버 메모리)에 이전 대화를 이어 붙일 때 쓰는 세션 키.
	 * 새로고침하면 useEffect에서 새로 발급 → 서버 쪽 이전 문맥과 끊김
	 */
	const [conversationId, setConversationId] = useState('');
	/** 서버가 알려 준 캐시 모드 글자 (예: redis | memory) — 헤더에 표시 */
	const [cacheHint, setCacheHint] = useState('');
	/** RAG가 참고한 문서 이름들 — 헤더에 “RAG: …”로 표시 */
	const [ragSources, setRagSources] = useState<string[]>([]);
	/** 스크롤 맨 아래 빈 div — 새 말이 오면 여기로 부드럽게 스크롤 */
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// 컴포넌트가 처음 그려질 때(및 새로고침) 한 번만: 새 대화 세션 ID 발급
		// 형식 예: conv_1739… — 서버가 이 문자열로 이전 메시지를 찾아 붙임
		setConversationId(`conv_${Date.now()}`);
	}, []);

	// history나 로딩이 바뀔 때마다 맨 아래로 스크롤
	// 왜: 새 말풍선이 생겨도 사용자가 맨 아래를 보게
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [history, isLoading]);

	/**
	 * 입력 폼 제출(전송 버튼 / Enter).
	 * 무엇을: 사용자 말풍선 추가 → Nest에 질문 → 봇 말풍선 추가
	 * 왜 FormEvent: form의 submit을 가로채 페이지 새로고침을 막기 위해
	 */
	async function handleSubmit(e: FormEvent) {
		// 브라우저 기본 submit(페이지 새로고침) 막기
		e.preventDefault();
		const text = input.trim();
		// 빈 글·이미 로딩 중·세션 ID 없으면 보내지 않음
		if (!text || isLoading || !conversationId) return;

		setInput('');
		setError('');
		// 화면에 사용자 말풍선 바로 추가 (응답 기다리지 않고 먼저 보이게)
		setHistory((prev) => [...prev, { id: msgId(), role: 'user', text }]);
		setIsLoading(true);

		const requestBody: RequestDTO = {
			content: text,
			// 서버가 이 ID로 Redis/메모리에서 이전 대화를 찾아 붙여 문맥을 유지
			conversationId
		};

		try {
			const data = await askChatbot(requestBody);
			// 응답에 캐시·RAG 정보가 있으면 헤더에 반영
			if (data.cache) setCacheHint(data.cache);
			if (data.ragSources) setRagSources(data.ragSources);
			setHistory((prev) => [
				...prev,
				// 내용이 비면 “(빈 응답)”으로라도 말풍선을 남겨 사용자가 알 수 있게
				{ id: msgId(), role: 'bot', text: data.content || '(빈 응답)' }
			]);
		} catch (err) {
			// Axios/네트워크 오류 → 쉬운 한글 문구로 바꿈
			const msg = toNetworkErrorMessage(err);
			setError(msg);
			// 말풍선에도 경고를 넣어, 스크롤만 봐도 실패를 알 수 있게
			setHistory((prev) => [...prev, { id: msgId(), role: 'bot', text: `⚠️ ${msg}` }]);
		} finally {
			// 성공·실패 모두 로딩 해제 (버튼·입력 다시 사용 가능)
			setIsLoading(false);
		}
	}

	return (
		// chat-shell: 휴대폰·PC에서 읽기 좋은 폭·높이의 채팅 카드
		<div className="chat-shell">
			{/* chat-header: 제목 + 세션 정보 바 */}
			<header className="chat-header">
				<h1>Your Own Chatbot</h1>
				<SearchBarView
					conversationId={conversationId}
					cacheHint={cacheHint}
					ragSources={ragSources}
				/>
			</header>

			{/* 말풍선 스크롤 영역 + 로딩 표시 + 맨 아래 앵커 */}
			<ChatHistoryView messages={history} loading={isLoading} bottomRef={bottomRef} />

			{/* chat-error: 화면 하단 입력 위 빨간 오류 한 줄 (있을 때만) */}
			{error && <p className="chat-error">{error}</p>}

			{/* 하단 입력창 — value/onChange로 부모 상태와 연결 */}
			<UserInputView
				value={input}
				loading={isLoading}
				onChange={setInput}
				onSubmit={handleSubmit}
			/>
		</div>
	);
}

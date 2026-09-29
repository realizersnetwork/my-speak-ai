/**
 * 앱 최상위 화면.
 * 상단 탭으로 “챗봇 / Prompt Caching / Streaming” 세 페이지를 골라 보여 줍니다.
 */
import { useState } from 'react';
// 실제 대화(Q&A) UI
import { ChatView } from './components/ChatView';
// OpenAI 스트리밍(SSE) 시험 화면
import { StreamTest } from './components/StreamTest';
// Prompt Caching(cached_tokens) 시험 화면
import { PromptCacheTest } from './components/PromptCacheTest';
// 이 파일의 레이아웃·탭 버튼 색 등 (App.css)
import './App.css';

/**
 * 지금 열어 둔 탭 종류.
 * - chat: Your Own Chatbot (대화)
 * - cache: Prompt Caching 결과 확인
 * - stream: Streaming API 실시간 응답
 */
type Tab = 'chat' | 'cache' | 'stream';

function App() {
	// 화면에 어느 탭을 보여줄지. 처음엔 챗봇 탭부터
	const [tab, setTab] = useState<Tab>('chat');

	return (
		// app: 화면 세로를 채우고 가운데 정렬하는 바깥 틀 (어두운 배경)
		<div className="app">
			{/* app-nav: 탭 버튼들을 가로로 나열하는 상단 메뉴 */}
			<nav className="app-nav">
				<button
					type="button"
					// 지금 탭이면 active → 보라색으로 “선택됨”을 눈에 띄게
					className={tab === 'chat' ? 'active' : ''}
					onClick={() => setTab('chat')}
				>
					Your Own Chatbot
				</button>
				<button
					type="button"
					className={tab === 'cache' ? 'active' : ''}
					onClick={() => setTab('cache')}
				>
					Prompt Caching
				</button>
				<button
					type="button"
					className={tab === 'stream' ? 'active' : ''}
					onClick={() => setTab('stream')}
				>
					Streaming API
				</button>
			</nav>
			{/* 탭 값에 따라 한 화면만 렌더 (동시에 세 개 안 그림 → 가벼움) */}
			{tab === 'chat' && <ChatView />}
			{tab === 'cache' && <PromptCacheTest />}
			{tab === 'stream' && <StreamTest />}
		</div>
	);
}

export default App;

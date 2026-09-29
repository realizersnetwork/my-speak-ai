/**
 * OpenAI Streaming API 시험 화면.
 * Nest POST /openai/chat/stream 이 보내는 SSE(data: …)를 읽어
 * 글자가 한 조각씩 쌓이는 모습을 보여 줍니다.
 */
import { useState, type FormEvent } from 'react';
import './StreamTest.css';

/**
 * Nest 서버 주소.
 * .env의 VITE_API_URL을 쓰고, 없으면 로컬 기본값 localhost:3000
 */
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * 표본 UI: OpenAI Streaming API 테스트
 * Nest POST /openai/chat/stream (SSE) → ReadableStream으로 실시간 표시
 */
export function StreamTest() {
	/** textarea에 적는 질문(프롬프트). 처음엔 예시 문장 */
	const [prompt, setPrompt] = useState('안녕 한국에 대해서 알려줘');
	/** 스트리밍으로 조각이 이어 붙어 화면에 보이는 답변 전체 */
	const [streamingResponse, setStreamingResponse] = useState('');
	/** true면 “생성 중…” + 입력 잠금 */
	const [loading, setLoading] = useState(false);
	/** 실패 시 빨간 오류 문구 */
	const [error, setError] = useState('');

	/**
	 * 전송: fetch로 스트림을 열고, SSE 줄을 파싱해 streamingResponse에 이어 붙임
	 */
	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const text = prompt.trim();
		if (!text || loading) return;

		setLoading(true);
		// 이전 답·오류 지우고 새로 받기
		setStreamingResponse('');
		setError('');

		try {
			const res = await fetch(`${API}/openai/chat/stream`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				// Nest RequestDTO와 같이 content만 보냄 (이 테스트는 conversationId 없음)
				body: JSON.stringify({ content: text })
			});
			if (!res.ok) {
				// HTTP 오류면 본문 글자를 그대로 에러로
				const errBody = await res.text();
				throw new Error(errBody || `HTTP ${res.status}`);
			}
			// 스트림 바디가 없으면 ReadableStream을 못 씀
			if (!res.body) throw new Error('스트림 본문이 없어요');

			/**
			 * SSE 파싱 요령:
			 * - 서버는 "data: {\"content\":\"글\"}\n\n" 형태로 조각을 보냄
			 * - \n\n 으로 이벤트 단위를 나누고, "data: " 줄만 골라 JSON으로 읽음
			 * - [DONE] 이면 끝 신호라 무시
			 */
			const reader = res.body.getReader();
			// 바이트 → 한글/영문 문자열
			const decoder = new TextDecoder('utf-8');
			// 아직 \n\n 이 안 온 “반쪽 덩어리”를 보관 (다음 읽기와 이어 붙임)
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				// stream: true — 멀티바이트 글자가 잘려도 다음 청크에서 이어짐
				buffer += decoder.decode(value, { stream: true });
				// SSE 이벤트는 빈 줄(\n\n)로 구분
				const parts = buffer.split('\n\n');
				// 마지막 조각은 아직 미완성일 수 있어 buffer에 남겨 둠
				buffer = parts.pop() ?? '';

				for (const part of parts) {
					// 한 이벤트 안의 "data: …" 줄만 찾음
					const line = part
						.split('\n')
						.find((l) => l.startsWith('data: '));
					if (!line) continue;
					// "data: " 여섯 글자 뒤가 실제 JSON 또는 [DONE]
					const payload = line.slice(6).trim();
					if (payload === '[DONE]') continue;
					try {
						const json = JSON.parse(payload) as { content?: string; error?: string };
						// 서버가 error 필드를 실어 보낸 경우
						if (json.error) throw new Error(json.error);
						if (json.content) {
							// 이전 글 + 새 조각을 이어 붙여 실시간으로 늘어나게
							setStreamingResponse((prev) => prev + json.content);
						}
					} catch (parseErr) {
						// JSON이 덜 온 조각은 SyntaxError → 다음 청크까지 기다림(건너뜀)
						if (parseErr instanceof SyntaxError) continue;
						// 그 외(서버 error 등)는 위로 던져 catch에서 표시
						throw parseErr;
					}
				}
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : '스트리밍 실패');
		} finally {
			setLoading(false);
		}
	}

	return (
		// stream-page: 전체 화면 어두운 배경 + 가운데 정렬
		<div className="stream-page">
			<h1>OpenAI Streaming API 테스트</h1>
			{/* stream-box: 입력·응답을 담는 카드 */}
			<div className="stream-box">
				<form onSubmit={handleSubmit}>
					<textarea
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						rows={4}
						disabled={loading}
						aria-label="프롬프트"
					/>
					<button type="submit" disabled={loading || !prompt.trim()}>
						{loading ? '생성 중…' : '전송'}
					</button>
				</form>
				{error && <p className="stream-error">{error}</p>}
				{/* stream-response: 실시간으로 글이 쌓이는 검은 박스 */}
				<div className="stream-response">
					<div className="stream-label">응답:</div>
					<div className="stream-text">
						{streamingResponse || (loading ? '…' : '여기에 전송하면 실시간으로 표시됩니다.')}
					</div>
				</div>
			</div>
		</div>
	);
}

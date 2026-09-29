/**
 * Prompt Caching 결과 확인 UI.
 * Nest /openai/prompt-cache 를 같은(또는 이어지는) 프롬프트로 두 번 호출해
 * 두 번째 usage.cached_tokens 가 커졌는지 눈으로 확인합니다.
 */
import { useState, type FormEvent } from 'react';
import './PromptCacheTest.css';

/**
 * Nest 서버 주소.
 * .env의 VITE_API_URL, 없으면 로컬 기본 localhost:3000
 */
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** OpenAI usage 요약 — 토큰 몇 개 썼는지 / 캐시에서 몇 개 썼는지 */
type UsageInfo = {
	/** 질문에 들어간 토큰 수 */
	prompt_tokens: number;
	/** 답이 쓴 토큰 수 */
	completion_tokens: number;
	/** 둘을 합친 총 토큰 */
	total_tokens: number;
	/** Prompt Caching으로 “이미 본 프롬프트”에서 절약한 토큰 (있으면 성공 신호) */
	cached_tokens?: number;
};

/** 한 번 호출의 화면용 결과 (제목 + 답글 + usage) */
type CallResult = {
	/** 카드 제목 (1번째/2번째 호출 구분) */
	label: string;
	/** 모델이 돌려준 답 본문 */
	content: string;
	/** 토큰·캐시 통계 (없으면 생략) */
	usage?: UsageInfo;
};

/**
 * Prompt Caching 결과 확인 UI
 * Nest /openai/prompt-cache 를 두 번 호출해 cached_tokens 비교
 */
export function PromptCacheTest() {
	/** 1차 호출에 보낼 사용자 질문 (textarea) */
	const [prompt, setPrompt] = useState('한국에 대해 아는 게 많아?');
	/** true면 “호출 중…” + 버튼 잠금 */
	const [loading, setLoading] = useState(false);
	/** 실패 시 빨간 오류 */
	const [error, setError] = useState('');
	/** 1·2차 호출 결과를 순서대로 쌓아 화면에 카드로 표시 */
	const [results, setResults] = useState<CallResult[]>([]);

	/**
	 * Nest에 한 번 POST.
	 * 입력: 화면용 label + content
	 * 출력: CallResult (content + usage)
	 */
	async function callOnce(label: string, content: string): Promise<CallResult> {
		const res = await fetch(`${API}/openai/prompt-cache`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content })
		});
		// JSON이 아니면 빈 객체로 두고 아래에서 HTTP 오류 처리
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			throw new Error(data.message || data.error || `HTTP ${res.status}`);
		}
		return {
			label,
			content: data.content ?? '',
			usage: data.usage
		};
	}

	/**
	 * “2회 연속 호출” 버튼.
	 * 1차: 긴 시스템 프롬프트를 캐시에 올리는(워밍) 호출
	 * 2차: 비슷한 흐름으로 다시 불러 cached_tokens 확인
	 */
	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const text = prompt.trim();
		if (!text || loading) return;
		setLoading(true);
		setError('');
		setResults([]);
		try {
			// 1차: 캐시 워밍 — 결과를 바로 화면에 한 장 보여 줌
			const first = await callOnce('1번째 호출 (캐시 워밍)', text);
			setResults([first]);
			// 2차: 다른 짧은 질문으로 다시 호출 — cached_tokens가 늘었는지 비교
			const second = await callOnce(
				'2번째 호출 (cached_tokens 확인)',
				'한국 역사에 대해 짧게 알려줘'
			);
			setResults([first, second]);
		} catch (err) {
			setError(err instanceof Error ? err.message : '요청 실패');
		} finally {
			setLoading(false);
		}
	}

	return (
		// cache-page: 최대 너비 제한된 흰 글씨 영역
		<div className="cache-page">
			<h1>1. Prompt Caching 결과 확인</h1>
			{/* cache-help: 초보자를 위한 성공 조건 설명 */}
			<p className="cache-help">
				긴 고정 시스템 프롬프트로 두 번 호출합니다. 두 번째 응답의{' '}
				<code>cached_tokens</code>가 0보다 크면 성공입니다.
			</p>
			{/* cache-box: 입력·결과 카드 */}
			<div className="cache-box">
				<form onSubmit={handleSubmit}>
					<textarea
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						rows={3}
						disabled={loading}
					/>
					<button type="submit" disabled={loading || !prompt.trim()}>
						{loading ? '호출 중…' : '2회 연속 호출'}
					</button>
				</form>
				{error && <p className="cache-error">{error}</p>}
				{results.map((r) => (
					// cache-result: 호출 한 번의 usage JSON + 답 미리보기
					<div key={r.label} className="cache-result">
						<h2>{r.label}</h2>
						{/* cache-usage: 토큰 숫자를 읽기 쉽게 JSON으로 보여 줌 */}
						<pre className="cache-usage">
							{JSON.stringify(
								{
									prompt_tokens: r.usage?.prompt_tokens,
									completion_tokens: r.usage?.completion_tokens,
									total_tokens: r.usage?.total_tokens,
									cached_tokens: r.usage?.cached_tokens
								},
								null,
								2
							)}
						</pre>
						{/* cached_tokens > 0 이면 초록 성공 문구 */}
						{typeof r.usage?.cached_tokens === 'number' && r.usage.cached_tokens > 0 && (
							<p className="cache-ok">✓ cached_tokens = {r.usage.cached_tokens}</p>
						)}
						{/* 답이 길면 앞 280자만 — 화면이 너무 길어지지 않게 */}
						<p className="cache-content">{r.content.slice(0, 280)}…</p>
					</div>
				))}
			</div>
		</div>
	);
}

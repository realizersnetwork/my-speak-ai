/**
 * 채팅 헤더 아래 “세션·캐시·RAG” 정보 바.
 * 검색창은 아니지만, 과제 표본의 SearchBar 자리에 세션 정보를 보여 줍니다.
 */
type Props = {
	/**
	 * Redis/서버 문맥용 대화 ID (예: conv_1739…).
	 * 비어 있으면 “…”로 표시 (발급 직전)
	 */
	conversationId: string;
	/** 서버가 알려 준 캐시 모드 (redis | memory 등). 없으면 안 그림 */
	cacheHint?: string;
	/** RAG가 참고한 문서 이름들. 없으면 안 그림 */
	ragSources?: string[];
};

/** 세션·캐시·RAG 출처 표시 바 */
export function SearchBarView({ conversationId, cacheHint, ragSources }: Props) {
	return (
		// session-bar: 작은 글씨로 세 정보를 가운데 나열 (스타일: ChatView.css)
		<div className="session-bar">
			{/* session-id: 고정폭 글꼴로 세션 키 표시 */}
			<span className="session-id">세션: {conversationId || '…'}</span>
			{/* cache-hint: 보라 톤 — 캐시 모드가 있을 때만 */}
			{cacheHint ? <span className="cache-hint">캐시: {cacheHint}</span> : null}
			{/* rag-hint: 초록 톤 — 참고 문서가 1개 이상일 때만 */}
			{ragSources && ragSources.length > 0 ? (
				<span className="rag-hint">RAG: {ragSources.join(', ')}</span>
			) : null}
		</div>
	);
}

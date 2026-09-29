/**
 * Nest POST /openai/chat 이 돌려주는 응답 몸체(DTO) 모양.
 * ChatView가 content를 말풍선에, cache·ragSources를 헤더에 씁니다.
 */
export interface ResponseDTO {
	/** 봇이 만든 답변 글 — 말풍선에 그대로 표시 */
	content: string;
	/** (선택) 이번에 쓴 토큰 대략치 — 화면에 안 쓸 수도 있음 */
	tokens?: number;
	/**
	 * (선택) 서버가 문맥을 어디에 뒀는지.
	 * 예: redis | memory — SearchBarView의 “캐시: …”에 표시
	 */
	cache?: string;
	/**
	 * (선택) RAG가 참고한 지식 문서 이름들.
	 * SearchBarView의 “RAG: …”에 쉼표로 이어 표시
	 */
	ragSources?: string[];
	/**
	 * (선택) OpenAI usage 상세.
	 * Prompt Caching 시험 등에서 cached_tokens를 볼 때 사용
	 */
	usage?: {
		/** 질문(프롬프트)에 들어간 토큰 수 */
		prompt_tokens: number;
		/** 답(completion)에 쓴 토큰 수 */
		completion_tokens: number;
		/** 위 둘의 합 */
		total_tokens: number;
		/** 캐시에서 재사용된 토큰 수 (있으면 Prompt Caching 동작 증거) */
		cached_tokens?: number;
	};
}

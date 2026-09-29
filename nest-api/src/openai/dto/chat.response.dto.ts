/**
 * 채팅·Prompt Caching 응답 본문과 토큰 사용량 DTO.
 * 컨트롤러가 JSON으로 그대로 직렬화해 React UI에 넘긴다.
 */

/** Prompt Caching·일반 채팅 공통 — OpenAI usage를 프론트가 읽기 쉬운 형태로 */
export class UsageDto {
	/** 입력(프롬프트)에 쓴 토큰 수 */
	prompt_tokens!: number;
	/** 출력(답변)에 쓴 토큰 수 */
	completion_tokens!: number;
	/** 입력+출력 합계 */
	total_tokens!: number;
	/** OpenAI Prompt Caching으로 재사용된 입력 토큰 수 (없으면 0 또는 생략) */
	cached_tokens?: number;
}

/** POST /openai/chat · /openai/prompt-cache 응답 본문 */
export class ChatResponseDto {
	/** 모델이 생성한 답변 텍스트 */
	content!: string;
	/** total_tokens 약칭 — UI에 “토큰 N개” 표시용 */
	tokens?: number;
	/** 문맥 캐시가 Redis인지 메모리인지: redis | memory */
	cache?: string;
	/** RAG가 참고한 지식 파일명 목록 (없으면 필드 자체 생략 가능) */
	ragSources?: string[];
	/** Prompt Caching 확인용 상세 usage (cached_tokens 포함) */
	usage?: UsageDto;
}

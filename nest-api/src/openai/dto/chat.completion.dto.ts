/**
 * Chat Completions 응답을 “completion + tokens” 형태로 담는 인터페이스.
 * 구 표본(lim-server) 스타일 createCompletion 반환값과 맞춤.
 */

/** 모델 답변과 사용 토큰만 필요한 단순 응답 */
export interface ChatCompletionDto {
	/** 모델이 생성한 답변 텍스트 */
	completion: string;
	/** 사용 토큰 합(있으면) — UI·로그용 */
	tokens?: number;
}

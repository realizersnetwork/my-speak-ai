/**
 * 채팅 요청 body를 검증하는 DTO (Data Transfer Object).
 * ValidationPipe가 class-validator 데코레이터로 타입·길이·필수 여부를 검사한다.
 * React는 content, 구 표본(lim-server)은 prompt를 쓰므로 둘 다 받는다.
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * POST /openai/chat · prompt-cache · chat/stream 공통 요청 형태
 * - content: React 표본 필드명
 * - prompt: lim-server 초기 표본 호환
 * - conversationId: Redis/메모리 문맥 키 (같은 ID = 이어지는 대화)
 */
export class ChatPromptDto {
	/**
	 * 사용자 메시지 (React RequestDTO)
	 * IsOptional: 없어도 됨(대신 prompt가 있을 수 있음)
	 * MaxLength(4000): 너무 긴 입력으로 비용·타임아웃 방지
	 */
	@IsOptional()
	@IsString()
	@MaxLength(4000)
	content?: string;

	/**
	 * 구 표본 호환 필드 — content와 같은 역할
	 * 둘 중 하나만 채워도 getUserText()로 질문을 뽑음
	 */
	@IsOptional()
	@IsString()
	@MaxLength(4000)
	prompt?: string;

	/**
	 * 세션 ID — 같으면 이전 대화를 이어서 보냄
	 * 없으면 단발 질문(문맥 저장 안 함)
	 */
	@IsOptional()
	@IsString()
	conversationId?: string;

	/**
	 * content / prompt 중 실제 질문 텍스트
	 * trim으로 앞뒤 공백만 있는 요청도 빈 문자열로 취급
	 */
	getUserText(): string {
		return (this.content ?? this.prompt ?? '').trim();
	}
}

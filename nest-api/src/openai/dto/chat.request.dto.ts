/**
 * 확장 채팅 요청 DTO (모델·시스템 메시지 등 선택 필드).
 * 현재 메인 경로는 ChatPromptDto를 쓰지만, 표본/확장용으로 prompt + 옵션을 받는 형태를 남겨 둔다.
 */
import { IsOptional, IsString } from 'class-validator';

export class ChatRequestDto {
	/** 필수: 사용자 질문(또는 완성시킬 프롬프트) */
	@IsString()
	prompt!: string;

	/**
	 * 선택: 쓸 OpenAI 모델명 (예: gpt-4o-mini)
	 * 없으면 서비스 기본 모델을 씀
	 */
	@IsOptional()
	@IsString()
	model?: string;

	/**
	 * 선택: 시스템 역할 메시지 (톤·규칙 지정)
	 * 없으면 서비스가 만든 기본 system을 씀
	 */
	@IsOptional()
	@IsString()
	system?: string;
}

/**
 * RAG 지식 문서 추가 요청 DTO — POST /openai/knowledge
 * source(이름)와 text(원문)를 받아 임베딩·인덱스에 넣는다.
 */
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class IngestKnowledgeDto {
	/**
	 * 문서 식별용 이름 (예: custom.txt, interview-tips.md)
	 * MaxLength(120): 키·로그에 쓰기 적당한 짧은 이름
	 * IsNotEmpty: 빈 문자열 금지
	 */
	@IsString()
	@IsNotEmpty()
	@MaxLength(120)
	source!: string;

	/**
	 * 인덱싱할 원문 전체
	 * MaxLength(100000): 약 10만 글자 — 한 번에 너무 큰 문서 업로드 방지
	 */
	@IsString()
	@IsNotEmpty()
	@MaxLength(100000)
	text!: string;
}

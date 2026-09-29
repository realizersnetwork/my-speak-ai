/**
 * OpenAI 관련 HTTP 진입점(Controller).
 * React UI·Postman이 보내는 POST 요청을 받아 OpenaiService에 넘기고, 결과를 JSON 또는 SSE로 돌려준다.
 *
 * 경로 접두사: /openai
 * - POST /openai/chat          → RAG + Redis 문맥 Q&A
 * - POST /openai/prompt-cache  → Prompt Caching(cached_tokens) 확인용
 * - POST /openai/chat/stream   → SSE 스트리밍 답변
 * - POST /openai/knowledge     → RAG 지식 문서 추가
 */
import {
	BadRequestException,
	Body,
	Controller,
	Post,
	Res
} from '@nestjs/common';
import type { Response } from 'express';
import { OpenaiService } from './openai.service';
import { ChatPromptDto } from './dto/chat.prompt.dto';
import { ChatResponseDto } from './dto/chat.response.dto';
import { IngestKnowledgeDto } from './dto/ingest-knowledge.dto';
import { AppLogger } from '../common/logger/app-logger.service';

/** @Controller('openai') → 모든 메서드 URL 앞에 /openai 붙음 */
@Controller('openai')
export class OpenaiController {
	constructor(
		/** 실제 OpenAI 호출·RAG·캐시 로직 */
		private readonly openaiService: OpenaiService,
		/** 요청 도착·실패를 콘솔에 남김 */
		private readonly logger: AppLogger
	) {}

	/**
	 * 일반 채팅 — conversationId가 있으면 Redis/메모리에서 이전 대화를 이어감
	 * body: { content|prompt, conversationId? }
	 */
	@Post('chat')
	async generateText(@Body() dto: ChatPromptDto): Promise<ChatResponseDto> {
		// content 또는 prompt 중 실제 질문 문자열
		const userText = dto.getUserText();
		// 둘 다 비어 있으면 400 — 모델에 빈 질문을 보내지 않음
		if (!userText) {
			throw new BadRequestException('content 또는 prompt가 필요해요');
		}
		this.logger.log(
			`POST /openai/chat · conv=${dto.conversationId ?? '-'}`,
			'OpenaiController'
		);
		return this.openaiService.chat({
			userText,
			// 없으면 단발 질문(문맥 저장 안 함)
			conversationId: dto.conversationId
		});
	}

	/**
	 * Prompt Caching 확인용 엔드포인트
	 * 같은 긴 시스템 프리픽스로 2번 호출하면 두 번째 usage.cached_tokens > 0 이 나와야 함
	 */
	@Post('prompt-cache')
	async promptCache(@Body() dto: ChatPromptDto): Promise<ChatResponseDto> {
		const userText = dto.getUserText();
		if (!userText) {
			throw new BadRequestException('content 또는 prompt가 필요해요');
		}
		this.logger.log('POST /openai/prompt-cache', 'OpenaiController');
		return this.openaiService.chatWithPromptCache(userText);
	}

	/**
	 * 스트리밍 응답 (SSE = Server-Sent Events)
	 * React StreamTest가 data: {"content":"..."} 청크를 이어 붙여 타이핑처럼 보여 줌
	 * @Res() → Nest 자동 JSON 응답 대신 Express Response를 직접 씀
	 */
	@Post('chat/stream')
	async stream(@Body() dto: ChatPromptDto, @Res() res: Response) {
		const userText = dto.getUserText();
		if (!userText) {
			throw new BadRequestException('content 또는 prompt가 필요해요');
		}
		this.logger.log('POST /openai/chat/stream', 'OpenaiController');

		// text/event-stream → 브라우저/클라이언트가 “실시간 이벤트 스트림”으로 인식
		res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
		// no-cache → 중간 프록시가 스트림을 캐시해 끊기지 않게
		res.setHeader('Cache-Control', 'no-cache');
		// keep-alive → 연결을 오래 유지해 청크를 계속 보냄
		res.setHeader('Connection', 'keep-alive');
		// 헤더를 먼저 밀어 내서 클라이언트가 바로 스트림 모드로 들어감
		res.flushHeaders?.();

		try {
			// OpenAI가 토큰(글자 조각)을 줄 때마다 SSE data 한 줄로 전송
			for await (const delta of this.openaiService.streamChat(userText)) {
				// SSE 규약: "data: ...\n\n" — JSON에 content만 넣어 UI가 이어 붙이기 쉽게
				res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
			}
			// [DONE] → 프론트가 “더 이상 없음”을 알고 연결 정리
			res.write('data: [DONE]\n\n');
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.logger.error(`stream 실패: ${msg}`, undefined, 'OpenaiController');
			// 에러도 SSE data로 보내 프론트가 메시지 표시 가능
			res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
		} finally {
			// 성공·실패 모두 스트림을 닫아 커넥션 누수 방지
			res.end();
		}
	}

	/**
	 * knowledge 텍스트를 RAG 인덱스에 추가
	 * body: { source: 파일명 비슷한 식별자, text: 원문 }
	 */
	@Post('knowledge')
	async ingest(@Body() dto: IngestKnowledgeDto) {
		this.logger.log(`POST /openai/knowledge · ${dto.source}`, 'OpenaiController');
		return this.openaiService.ingestKnowledge(dto.source, dto.text);
	}
}

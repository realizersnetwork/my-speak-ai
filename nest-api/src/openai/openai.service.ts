/**
 * OpenAI 연동 서비스 — 실제 비즈니스 로직.
 * API 키는 서버 .env만 쓰고, RAG 검색·Redis 문맥·Few-shot·Completions·스트리밍을 여기서 조합한다.
 *
 * 주요 메서드:
 * - chat: RAG + Redis 문맥 + Few-shot → 일반 Q&A
 * - chatWithPromptCache: 긴 고정 프리픽스로 cached_tokens 확인
 * - streamChat: 토큰 단위 스트리밍(yield)
 * - ingestKnowledge: RAG 인덱스에 문서 추가
 */
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AppLogger } from '../common/logger/app-logger.service';
import { ConversationCacheService } from '../redis/conversation-cache.service';
import { RagService } from '../rag/rag.service';
import type { ChatCompletionDto } from './dto/chat.completion.dto';
import type { ChatResponseDto, UsageDto } from './dto/chat.response.dto';
import { PROMPT_CACHE_PREFIX } from './prompt-cache.prefix';
import { FEW_SHOT_MESSAGES } from './few-shot.examples';

/** Nest DI로 주입되는 싱글톤 서비스 */
@Injectable()
export class OpenaiService {
	/** OpenAI SDK 클라이언트 — 키가 없으면 null (요청 시 503) */
	private client: OpenAI | null = null;

	constructor(
		/** .env 값 읽기 (OPENAI_API_KEY 등) */
		private readonly config: ConfigService,
		private readonly logger: AppLogger,
		/** conversationId별 이전 대화 저장/조회 */
		private readonly cache: ConversationCacheService,
		/** knowledge 문서 유사 검색 */
		private readonly rag: RagService
	) {
		// 서버 기동 시 한 번만 키를 읽어 클라이언트 준비 — 클라이언트에 키를 절대 노출하지 않음
		const key = this.config.get<string>('OPENAI_API_KEY');
		if (key) {
			this.client = new OpenAI({ apiKey: key });
			this.logger.log('OpenAI 클라이언트 준비됨', 'OpenaiService');
		} else {
			this.logger.warn('OPENAI_API_KEY 없음', 'OpenaiService');
		}
	}

	/** 키 없으면 503 — “서비스 사용 불가”로 프론트에 안내 */
	private getClient(): OpenAI {
		if (!this.client) {
			throw new ServiceUnavailableException(
				'OPENAI_API_KEY가 설정되지 않았어요. .env를 확인하세요'
			);
		}
		return this.client;
	}

	/**
	 * OpenAI usage 객체에서 프론트용 UsageDto로 변환
	 * cached_tokens: Prompt Caching으로 재사용된 입력 토큰 수 (없으면 0)
	 */
	private pickUsage(usage: OpenAI.Completions.CompletionUsage | undefined): UsageDto | undefined {
		if (!usage) return undefined;
		// SDK 타입에 아직 없을 수 있어 확장 타입으로 cached_tokens만 꺼냄
		const details = (
			usage as OpenAI.Completions.CompletionUsage & {
				prompt_tokens_details?: { cached_tokens?: number };
			}
		).prompt_tokens_details;
		return {
			// 입력(프롬프트)에 쓴 토큰
			prompt_tokens: usage.prompt_tokens ?? 0,
			// 출력(답변)에 쓴 토큰
			completion_tokens: usage.completion_tokens ?? 0,
			// 입력+출력 합
			total_tokens: usage.total_tokens ?? 0,
			// 캐시 히트 토큰 — Prompt Caching 성공 여부 확인용
			cached_tokens: details?.cached_tokens ?? 0
		};
	}

	/** 표본 lim-server 호환: prompt만 받아 답변 문자열만 반환 */
	async generateText(prompt: string): Promise<string> {
		const result = await this.chat({ userText: prompt });
		return result.content;
	}

	/**
	 * 메인 Q&A 파이프라인
	 * 순서: 문맥 로드 → RAG 검색 → system+Few-shot+history+질문 → 답 저장
	 */
	async chat(input: {
		/** 사용자 질문 본문 */
		userText: string;
		/** 있으면 같은 세션의 이전 턴을 이어 붙임 */
		conversationId?: string;
	}): Promise<ChatResponseDto> {
		const client = this.getClient();
		const { userText, conversationId } = input;
		// Redis/메모리에서 이전 턴 불러오기 — id 없으면 빈 배열(단발)
		const history = conversationId ? await this.cache.getHistory(conversationId) : [];

		// 질문과 비슷한 지식 조각 Top-K (점수·소스 포함)
		const hits = await this.rag.retrieve(userText);
		// 시스템 프롬프트에 넣을 “참고 문서” 문자열
		const ragContext = this.rag.formatContext(hits);
		// 중복 없이 참조한 파일명만 모아 응답에 표시
		const ragSources = [...new Set(hits.map((h) => h.source))];

		this.logger.log(
			`chat · conv=${conversationId ?? 'none'} · history=${history.length} · rag=${hits.length} · cache=${this.cache.getMode()}`,
			'OpenaiService'
		);

		// 시스템 역할: 면접/학습 도우미 + RAG 문서 우선 + 사용자 언어로 답변
		const systemParts = [
			'You are My Speak AI, a technical interview prep and study assistant.',
			'Use prior conversation context when provided.',
			'If REFERENCE DOCUMENTS are provided, base your answer primarily on them.',
			'If documents are insufficient, say what is missing briefly, then answer carefully.',
			'Reply in the user\'s language. Prefer clear, structured explanations for interview topics.',
			'Follow the style of the few-shot examples below.'
		];
		// RAG 히트가 있을 때만 참고 문서를 시스템 메시지 끝에 붙임
		if (ragContext) {
			systemParts.push(`\nREFERENCE DOCUMENTS:\n${ragContext}`);
		}

		const completion = await client.chat.completions.create({
			// gpt-4o-mini: 과제용으로 빠르고 저렴한 채팅 모델
			model: 'gpt-4o-mini',
			// 0.4: 너무 창의적이지 않게(사실·면접 답변에 유리). 0=결정적, 1=더 다양
			temperature: 0.4,
			// 답변 최대 길이 제한 — 비용·응답시간 조절 (약 900 토큰)
			max_tokens: 900,
			messages: [
				{ role: 'system', content: systemParts.join('\n') },
				// Few-shot: 답변 톤·형식 예시 (매 요청 동일)
				...FEW_SHOT_MESSAGES,
				// 이전 대화 턴을 user/assistant로 그대로 이어 붙임
				...history.map((t) => ({
					role: t.role as 'user' | 'assistant',
					content: t.content
				})),
				// 이번 사용자 질문 (항상 맨 마지막)
				{ role: 'user', content: userText }
			]
		});

		// 첫 번째 choice의 message.content — 비면 실패로 처리
		const text = completion.choices[0]?.message?.content?.trim() ?? '';
		if (!text) throw new Error('empty model reply');

		const usage = this.pickUsage(completion.usage);
		const tokens = usage?.total_tokens ?? 0;

		// 다음 턴을 위해 유저·봇 메시지를 문맥에 누적 (conversationId 있을 때만)
		if (conversationId) {
			await this.cache.appendTurn(conversationId, userText, text);
		}

		this.logger.log(
			`완료 · tokens=${tokens} · cached=${usage?.cached_tokens ?? 0} · ragSources=${ragSources.join(',') || '-'}`,
			'OpenaiService'
		);
		return {
			content: text,
			tokens,
			// redis | memory — UI에서 캐시 모드 표시용
			cache: this.cache.getMode(),
			// 참조한 지식 파일이 있을 때만 필드 포함
			ragSources: ragSources.length ? ragSources : undefined,
			usage
		};
	}

	/**
	 * Prompt Caching 데모 — 긴 고정 프리픽스 + usage.cached_tokens
	 * 같은 프리픽스로 2번 호출하면 두 번째에 cached_tokens > 0
	 */
	async chatWithPromptCache(userText: string): Promise<ChatResponseDto> {
		const client = this.getClient();
		this.logger.log('prompt-cache 요청', 'OpenaiService');

		const completion = await client.chat.completions.create({
			model: 'gpt-4o-mini',
			// 0.5: 캐시 데모용 중간 창의성 (사실 암기보다 안내 톤)
			temperature: 0.5,
			// 답은 짧게 — 캐시 확인이 목적이라 출력 토큰을 아낌
			max_tokens: 400,
			messages: [
				// 앞부분이 길고 동일해야 캐시됨 (PROMPT_CACHE_PREFIX)
				{ role: 'system', content: PROMPT_CACHE_PREFIX },
				{ role: 'user', content: userText }
			]
		});

		const text = completion.choices[0]?.message?.content?.trim() ?? '';
		if (!text) throw new Error('empty model reply');

		const usage = this.pickUsage(completion.usage);
		this.logger.log(
			`prompt-cache 완료 · prompt=${usage?.prompt_tokens} · cached=${usage?.cached_tokens ?? 0}`,
			'OpenaiService'
		);

		return {
			content: text,
			tokens: usage?.total_tokens ?? 0,
			usage
		};
	}

	/**
	 * Streaming — stream:true 로 델타(delta) content를 순차 yield
	 * 컨트롤러가 for-await로 받아 SSE data로 밀어 냄
	 */
	async *streamChat(userText: string): AsyncGenerator<string> {
		const client = this.getClient();
		this.logger.log('stream 시작', 'OpenaiService');

		const stream = await client.chat.completions.create({
			model: 'gpt-4o-mini',
			// 0.7: 스트리밍 데모는 조금 더 자연스러운 문장 허용
			temperature: 0.7,
			max_tokens: 800,
			// stream:true → 한 번에 전체가 아니라 조각(chunk)으로 응답
			stream: true,
			messages: [
				{
					role: 'system',
					content:
						'You are a helpful assistant. Reply in the user\'s language with clear, readable paragraphs.'
				},
				{ role: 'user', content: userText }
			]
		});

		// 각 chunk의 choices[0].delta.content 만 꺼내 호출자에게 전달
		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta?.content;
			if (delta) yield delta;
		}
		this.logger.log('stream 종료', 'OpenaiService');
	}

	/** RAG 인덱스에 문서 추가 후 성공 여부와 ready 상태 반환 */
	async ingestKnowledge(source: string, text: string) {
		await this.rag.ingestDocument(source, text);
		return { ok: true, source, ready: this.rag.isReady() };
	}

	/** 구 표본용: { completion, tokens } 형태로 감싸 반환 */
	async createCompletion(prompt: string): Promise<ChatCompletionDto> {
		const r = await this.chat({ userText: prompt });
		return { completion: r.content, tokens: r.tokens };
	}
}

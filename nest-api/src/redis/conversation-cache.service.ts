/**
 * 대화 문맥 캐시 서비스.
 * conversationId마다 이전 user/assistant 턴을 저장해 다음 채팅에 이어 붙인다.
 * Redis가 되면 Redis를 쓰고, 연결 실패·미설치면 프로세스 안 Map(메모리)으로 폴백한다.
 * Redis 키 형식: chat:conv:{conversationId}
 */
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppLogger } from '../common/logger/app-logger.service';
import type { CachedTurn } from './conversation.types';

@Injectable()
export class ConversationCacheService implements OnModuleInit, OnModuleDestroy {
	/** Redis 클라이언트 — 연결 실패 시 null */
	private redis: Redis | null = null;
	/** Redis 없을 때 로컬 폴백 (서버 재시작 시 사라짐) */
	private memory = new Map<string, CachedTurn[]>();
	/** 대화 유지 시간(초) — Redis EX 만료. 기본 3600=1시간 */
	private readonly ttlSec: number;
	/** 한 세션에 남길 최대 메시지 개수(유저+봇 합). 너무 길면 토큰·비용↑ */
	private readonly maxTurns: number;
	/** 현재 모드 — 응답 JSON의 cache 필드에도 실림 */
	private mode: 'redis' | 'memory' = 'memory';

	constructor(
		private readonly config: ConfigService,
		private readonly logger: AppLogger
	) {
		// TTL·최대 턴 수 — .env로 조절 가능 (없으면 3600초 / 20턴)
		this.ttlSec = Number(this.config.get('REDIS_TTL_SEC') ?? 3600);
		this.maxTurns = Number(this.config.get('CHAT_MAX_TURNS') ?? 20);
	}

	/** Nest 모듈 기동 직후 Redis 연결 시도 — 실패하면 memory 모드로 계속 */
	async onModuleInit() {
		// 기본: 로컬 Redis (Docker redis-stack / redis 흔히 6379)
		const url = this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
		try {
			const client = new Redis(url, {
				// 요청당 재시도 1번만 — 없으면 빨리 실패해 메모리 폴백
				maxRetriesPerRequest: 1,
				// lazyConnect:true → new 직후가 아니라 connect() 호출 때 연결
				lazyConnect: true,
				// 1.5초 안에 안 붙으면 실패로 보고 폴백 (기동 지연 최소화)
				connectTimeout: 1500,
				// 오프라인 큐 끄기 — 연결 전 명령이 쌓여 멈추는 것 방지
				enableOfflineQueue: false,
				// 연결 실패 시 재시도 안 함 (null 반환) → 바로 메모리 폴백
				retryStrategy: () => null
			});
			client.on('error', () => {
				/* 폴백 모드에서는 반복 에러 로그 스팸을 막기 위해 무시 */
			});
			await client.connect();
			// ping으로 “진짜 응답하는지” 확인
			await client.ping();
			this.redis = client;
			this.mode = 'redis';
			this.logger.log(`Redis 연결됨 · ${url}`, 'ConversationCache');
		} catch (err) {
			try {
				this.redis?.disconnect();
			} catch {
				/* 이미 끊긴 경우 무시 */
			}
			this.redis = null;
			this.mode = 'memory';
			this.logger.warn(
				`Redis 연결 실패 → 메모리 캐시 사용 (${err instanceof Error ? err.message : err})`,
				'ConversationCache'
			);
		}
	}

	/** 앱 종료 시 Redis 연결을 깨끗이 닫음 */
	async onModuleDestroy() {
		if (this.redis) await this.redis.quit().catch(() => undefined);
	}

	/** 현재 캐시 모드 문자열 — chat 응답의 cache 필드용 */
	getMode() {
		return this.mode;
	}

	/** Redis 키 규칙: chat:conv:{세션ID} — 다른 키와 안 섞이게 접두사 고정 */
	private key(conversationId: string) {
		return `chat:conv:${conversationId}`;
	}

	/** 이전 대화 문맥 조회 — 없으면 빈 배열 */
	async getHistory(conversationId: string): Promise<CachedTurn[]> {
		if (!conversationId) return [];
		if (this.redis) {
			const raw = await this.redis.get(this.key(conversationId));
			if (!raw) return [];
			try {
				// JSON 문자열 → CachedTurn[]
				return JSON.parse(raw) as CachedTurn[];
			} catch {
				// 깨진 데이터면 빈 문맥으로 취급 (서버 죽지 않게)
				return [];
			}
		}
		// 메모리 Map 복사본 반환 — 호출측이 원본을 직접 바꾸지 않게
		return [...(this.memory.get(conversationId) ?? [])];
	}

	/**
	 * 유저·어시스턴트 한 턴을 문맥에 추가 후 저장
	 * slice(-maxTurns): 오래된 턴부터 잘라 토큰 폭주 방지
	 */
	async appendTurn(conversationId: string, userText: string, assistantText: string) {
		if (!conversationId) return;
		const prev = await this.getHistory(conversationId);
		const next: CachedTurn[] = [
			...prev,
			{ role: 'user' as const, content: userText },
			{ role: 'assistant' as const, content: assistantText }
		].slice(-this.maxTurns);

		if (this.redis) {
			// EX ttlSec: 이 초가 지나면 키 자동 삭제 (오래된 세션 정리)
			await this.redis.set(this.key(conversationId), JSON.stringify(next), 'EX', this.ttlSec);
			this.logger.log(
				`Redis 캐시 저장 · id=${conversationId} · turns=${next.length}`,
				'ConversationCache'
			);
			return;
		}

		this.memory.set(conversationId, next);
		this.logger.log(
			`메모리 캐시 저장 · id=${conversationId} · turns=${next.length}`,
			'ConversationCache'
		);
	}
}

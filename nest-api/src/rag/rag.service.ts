/**
 * RAG(Retrieval-Augmented Generation) 서비스.
 * knowledge/ 폴더(또는 API로 넣은) 문서를 잘라 임베딩한 뒤,
 * 질문과 비슷한 조각을 찾아 채팅 프롬프트의 REFERENCE DOCUMENTS로 넘긴다.
 * Redis Stack 벡터 검색이 가능하면 그걸 우선하고, 아니면 메모리 코사인 유사도로 폴백한다.
 */
import { Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import OpenAI from 'openai';
import Redis from 'ioredis';
import { AppLogger } from '../common/logger/app-logger.service';
import type { RagChunk, RagHit } from './rag.types';
import { RedisVectorStore } from './redis-vector.store';

@Injectable()
export class RagService implements OnModuleInit {
	/** Embeddings API용 OpenAI 클라이언트 — 키 없으면 RAG 비활성 */
	private client: OpenAI | null = null;
	/** 메모리 폴백용 청크 목록 (프로세스 안에 전부 벡터) */
	private chunks: RagChunk[] = [];
	/** 검색 가능한 상태가 되었는지 */
	private ready = false;
	/** 검색 상위 K개 — .env RAG_TOP_K, 기본 3 */
	private readonly topK: number;
	/** 이 점수 미만은 가능하면 제외 — .env RAG_MIN_SCORE, 기본 0.25 */
	private readonly minScore: number;
	/** Redis Stack 벡터 스토어 — 연결·인덱스 성공 시에만 사용 */
	private vectorStore: RedisVectorStore | null = null;
	/** true면 Redis Stack KNN 검색 우선 */
	private useRedisVector = false;
	/** 벡터 스토어가 쓰는 Redis 연결 (참조 유지용) */
	private redisClient: Redis | null = null;

	constructor(
		private readonly config: ConfigService,
		private readonly logger: AppLogger
	) {
		// Top-K=3: 너무 많으면 프롬프트가 길어지고, 너무 적으면 근거 부족
		this.topK = Number(this.config.get('RAG_TOP_K') ?? 3);
		// 0.25: 약한 유사도는 버리고, 전부 약하면 아래에서 최상위 1개는 살림
		this.minScore = Number(this.config.get('RAG_MIN_SCORE') ?? 0.25);
	}

	/** 기동 시: 키 확인 → Redis Stack 시도 → knowledge 폴더 인덱싱 */
	async onModuleInit() {
		const key = this.config.get<string>('OPENAI_API_KEY');
		if (!key) {
			this.logger.warn('OPENAI_API_KEY 없음 — RAG 비활성', 'RagService');
			return;
		}
		this.client = new OpenAI({ apiKey: key });

		await this.tryConnectRedisStack();

		try {
			await this.indexKnowledgeFolder();
			// 메모리 청크가 있거나 Redis 벡터가 켜져 있으면 ready
			this.ready = this.chunks.length > 0 || this.useRedisVector;
			this.logger.log(
				`RAG 인덱스 완료 · memoryChunks=${this.chunks.length} · vector=${this.useRedisVector ? 'redis-stack' : 'memory'}`,
				'RagService'
			);
		} catch (err) {
			this.logger.error(
				`RAG 인덱싱 실패: ${err instanceof Error ? err.message : err}`,
				err instanceof Error ? err.stack : undefined,
				'RagService'
			);
		}
	}

	/** 채팅/지식 API에서 “검색 가능한지” 확인 */
	isReady() {
		return this.ready && (this.chunks.length > 0 || this.useRedisVector);
	}

	/** Redis Stack(RediSearch) 연결 시도 — 실패해도 메모리 RAG로 동작 */
	private async tryConnectRedisStack() {
		const url = this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
		try {
			const redis = new Redis(url, {
				maxRetriesPerRequest: 1,
				lazyConnect: true,
				connectTimeout: 1500,
				enableOfflineQueue: false,
				// 재시도 안 함 → 빨리 메모리 모드로
				retryStrategy: () => null
			});
			redis.on('error', () => undefined);
			await redis.connect();
			await redis.ping();
			const store = new RedisVectorStore(redis, this.logger);
			const ok = await store.ensureIndex();
			if (ok) {
				this.redisClient = redis;
				this.vectorStore = store;
				this.useRedisVector = true;
				this.logger.log('RAG Vector DB = Redis Stack', 'RagService');
				return;
			}
			// 인덱스를 못 만들면 연결을 닫고 메모리만 사용
			await redis.quit().catch(() => undefined);
		} catch (err) {
			this.logger.warn(
				`Redis Stack 벡터 미사용 → 메모리 RAG (${err instanceof Error ? err.message : err})`,
				'RagService'
			);
			this.useRedisVector = false;
			this.vectorStore = null;
		}
	}

	/** knowledge/*.md|txt 를 읽어 인덱스에 적재 (nest-api 실행 cwd 기준) */
	async indexKnowledgeFolder() {
		const dir = join(process.cwd(), 'knowledge');
		let files: string[] = [];
		try {
			// md·txt만 — 바이너리·기타 파일은 건너뜀
			files = (await readdir(dir)).filter((f) => /\.(md|txt)$/i.test(f));
		} catch {
			this.logger.warn(`knowledge 폴더 없음: ${dir}`, 'RagService');
			return;
		}
		for (const file of files) {
			const text = await readFile(join(dir, file), 'utf8');
			await this.ingestDocument(file, text);
		}
	}

	/**
	 * 원문을 청크로 나누고 임베딩 후 메모리(+가능하면 Redis)에 저장
	 * @param source 파일명 또는 API로 준 식별자
	 * @param text 원문
	 */
	async ingestDocument(source: string, text: string) {
		// 700글자 근처: 임베딩 품질과 프롬프트 길이의 타협
		const pieces = chunkText(text, 700);
		this.logger.log(`인덱싱 · ${source} · ${pieces.length} chunks`, 'RagService');

		for (let i = 0; i < pieces.length; i++) {
			const piece = pieces[i];
			const embedding = await this.embed(piece);
			const chunk: RagChunk = {
				// id: 같은 파일의 i번째 조각 — Redis 키·중복 구분용
				id: `${source}#${i}`,
				source,
				text: piece,
				embedding
			};
			this.chunks.push(chunk);
			if (this.vectorStore && this.useRedisVector) {
				await this.vectorStore.upsert(chunk);
			}
		}
		this.ready = this.chunks.length > 0 || this.useRedisVector;
	}

	/** 질문 임베딩 → Top-K 유사 문서 (Redis Stack 우선, 실패 시 메모리) */
	async retrieve(query: string): Promise<RagHit[]> {
		if (!this.isReady()) return [];
		const qVec = await this.embed(query);

		if (this.vectorStore && this.useRedisVector) {
			try {
				const hits = await this.vectorStore.search(qVec, this.topK);
				if (hits.length > 0) {
					this.logger.log(
						`RAG(Redis Stack) · hits=${hits.length} · top=${hits[0]?.score?.toFixed(3) ?? '-'}`,
						'RagService'
					);
					return hits;
				}
			} catch (err) {
				this.logger.warn(
					`Redis 벡터 검색 실패 → 메모리: ${err instanceof Error ? err.message : err}`,
					'RagService'
				);
			}
		}

		// 메모리: 모든 청크와 코사인 유사도 계산 후 점수 높은 순
		const scored = this.chunks
			.map((c) => ({
				source: c.source,
				text: c.text,
				score: cosineSimilarity(qVec, c.embedding)
			}))
			.sort((a, b) => b.score - a.score);

		// minScore 이상만 고르되, 전부 낮으면 최상위 1개는 살려 완전 빈 결과 방지
		const filtered = scored.filter((h) => h.score >= this.minScore);
		const picked = (filtered.length > 0 ? filtered : scored.slice(0, 1)).slice(0, this.topK);

		this.logger.log(
			`RAG(memory) · hits=${picked.length} · top=${picked[0]?.score?.toFixed(3) ?? '-'}`,
			'RagService'
		);
		return picked;
	}

	/** 프롬프트에 넣을 REFERENCE DOCUMENTS 문자열 — 히트 없으면 빈 문자열 */
	formatContext(hits: RagHit[]): string {
		if (!hits.length) return '';
		return hits
			.map((h, i) => `[문서${i + 1}: ${h.source}]\n${h.text}`)
			.join('\n\n');
	}

	private getClient(): OpenAI {
		if (!this.client) {
			throw new ServiceUnavailableException('OpenAI 클라이언트가 없습니다');
		}
		return this.client;
	}

	/**
	 * OpenAI Embeddings API 호출
	 * model text-embedding-3-small: 가성비·1536차원
	 * input 8000자 제한: 임베딩 API 입력 길이 보호
	 */
	private async embed(text: string): Promise<number[]> {
		const client = this.getClient();
		const res = await client.embeddings.create({
			model: 'text-embedding-3-small',
			input: text.slice(0, 8000)
		});
		return res.data[0]?.embedding ?? [];
	}
}

/**
 * 문단(빈 줄) 단위로 대략 maxLen 글자씩 청크
 * 너무 길면 임베딩·검색 품질이 떨어지고 프롬프트도 비대해짐
 */
function chunkText(text: string, maxLen: number): string[] {
	// Windows CRLF → LF 통일
	const normalized = text.replace(/\r\n/g, '\n').trim();
	if (!normalized) return [];
	// 빈 줄 기준으로 문단 분리
	const paras = normalized.split(/\n{2,}/);
	const chunks: string[] = [];
	let buf = '';
	for (const p of paras) {
		const next = buf ? `${buf}\n\n${p}` : p;
		// 합치면 maxLen 넘고 이미 버퍼가 있으면 버퍼를 한 청크로 확정
		if (next.length > maxLen && buf) {
			chunks.push(buf.trim());
			buf = p;
		} else {
			buf = next;
		}
	}
	if (buf.trim()) chunks.push(buf.trim());
	return chunks;
}

/** 코사인 유사도 — 1에 가까울수록 의미적으로 비슷, 길이 다르면 0 */
function cosineSimilarity(a: number[], b: number[]): number {
	if (!a.length || !b.length || a.length !== b.length) return 0;
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		na += a[i] * a[i];
		nb += b[i] * b[i];
	}
	const denom = Math.sqrt(na) * Math.sqrt(nb);
	return denom === 0 ? 0 : dot / denom;
}

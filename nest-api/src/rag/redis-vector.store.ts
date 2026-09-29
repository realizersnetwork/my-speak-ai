/**
 * Redis Stack(RediSearch) 벡터 인덱스 래퍼.
 * 지식 청크의 임베딩을 HASH로 저장하고, KNN으로 “질문과 가까운 문서”를 찾는다.
 * 일반 Redis(스택 아님)면 FT.CREATE/FT.SEARCH가 실패 → 호출측(RagService)이 메모리 검색으로 폴백.
 */
import type Redis from 'ioredis';
import type { AppLogger } from '../common/logger/app-logger.service';
import type { RagChunk, RagHit } from './rag.types';

/** RediSearch 인덱스 이름 — FT.CREATE / FT.SEARCH에 사용 */
const INDEX = 'rag_idx';
/** HASH 키 접두사 — rag:doc:{chunkId} 형태로 저장 */
const PREFIX = 'rag:doc:';
/** text-embedding-3-small 벡터 차원 수 — 모델과 반드시 같아야 검색됨 */
const DIM = 1536;

export class RedisVectorStore {
	constructor(
		/** 이미 연결된 ioredis 인스턴스 */
		private readonly redis: Redis,
		private readonly logger: AppLogger
	) {}

	/**
	 * 인덱스가 없으면 만들고, 있으면 재사용
	 * @returns true=벡터 검색 사용 가능 / false=생성 실패(일반 Redis 등)
	 */
	async ensureIndex(): Promise<boolean> {
		// 이미 있으면 FT.INFO가 성공 → 재생성하지 않음 (데이터 유지)
		try {
			await this.redis.call('FT.INFO', INDEX);
			return true;
		} catch {
			/* 인덱스 없음 → 아래로 가서 생성 */
		}
		try {
			/**
			 * FT.CREATE 옵션 의미:
			 * ON HASH — Redis HASH 문서에 인덱스
			 * PREFIX 1 rag:doc: — 이 접두사 키만 인덱싱
			 * source TAG — 파일명 필터용 태그
			 * text TEXT — 원문 전문 검색 가능 필드
			 * embedding VECTOR FLAT — 근사 없이 전체 비교(데이터 적을 때 단순·정확)
			 * TYPE FLOAT32 / DIM 1536 — 임베딩 숫자 형식·길이
			 * DISTANCE_METRIC COSINE — 코사인 거리(비슷할수록 작음)
			 * '6' = VECTOR 뒤 옵션 개수(TYPE, FLOAT32, DIM, 1536, DISTANCE_METRIC, COSINE)
			 */
			await this.redis.call(
				'FT.CREATE',
				INDEX,
				'ON',
				'HASH',
				'PREFIX',
				'1',
				PREFIX,
				'SCHEMA',
				'source',
				'TAG',
				'text',
				'TEXT',
				'embedding',
				'VECTOR',
				'FLAT',
				'6',
				'TYPE',
				'FLOAT32',
				'DIM',
				String(DIM),
				'DISTANCE_METRIC',
				'COSINE'
			);
			this.logger.log('Redis Stack 벡터 인덱스 생성됨', 'RedisVectorStore');
			return true;
		} catch (err) {
			this.logger.warn(
				`벡터 인덱스 생성 실패(일반 Redis일 수 있음): ${err instanceof Error ? err.message : err}`,
				'RedisVectorStore'
			);
			return false;
		}
	}

	/** 청크를 HASH로 저장 — embedding은 Float32 바이너리 버퍼 */
	async upsert(chunk: RagChunk): Promise<void> {
		const key = `${PREFIX}${chunk.id}`;
		const buf = float32Buffer(chunk.embedding);
		await this.redis.hset(key, {
			source: chunk.source,
			text: chunk.text,
			embedding: buf
		});
	}

	/**
	 * KNN 벡터 검색 — 질문 임베딩과 가까운 문서 topK개
	 * 쿼리: *=>[KNN topK @embedding $vec AS score]
	 */
	async search(queryEmbedding: number[], topK: number): Promise<RagHit[]> {
		const buf = float32Buffer(queryEmbedding);
		const raw = (await this.redis.call(
			'FT.SEARCH',
			INDEX,
			`*=>[KNN ${topK} @embedding $vec AS score]`,
			'PARAMS',
			'2', // 파라미터 이름·값 쌍이 1개(=2개 토큰): vec, buf
			'vec',
			buf,
			'SORTBY',
			'score', // 거리(score) 오름차순 — 가까운 것 먼저
			'RETURN',
			'3', // 돌려받을 필드 3개
			'source',
			'text',
			'score',
			'DIALECT',
			'2' // RediSearch 쿼리 dialect 2 (벡터 구문 지원)
		)) as unknown[];

		return parseSearchResult(raw);
	}
}

/** number[] → Redis VECTOR 필드용 Float32 little-endian Buffer (길이 DIM 고정) */
function float32Buffer(vec: number[]): Buffer {
	const a = new Float32Array(DIM);
	for (let i = 0; i < Math.min(DIM, vec.length); i++) a[i] = vec[i];
	return Buffer.from(a.buffer);
}

/**
 * FT.SEARCH 원시 결과 파싱
 * 형태: [총개수, key1, [field, val, ...], key2, ...]
 */
function parseSearchResult(raw: unknown[]): RagHit[] {
	if (!Array.isArray(raw) || raw.length < 2) return [];
	const hits: RagHit[] = [];
	for (let i = 1; i < raw.length; i += 2) {
		const fields = raw[i + 1];
		if (!Array.isArray(fields)) continue;
		const map: Record<string, string> = {};
		for (let j = 0; j < fields.length; j += 2) {
			map[String(fields[j])] = String(fields[j + 1]);
		}
		// COSINE distance → similarity 근사: 1 - distance (1에 가까울수록 비슷)
		const score = map.score ? 1 - Number(map.score) : 0;
		hits.push({
			source: map.source ?? '',
			text: map.text ?? '',
			score: Number.isFinite(score) ? score : 0
		});
	}
	return hits;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisVectorStore = void 0;
const INDEX = 'rag_idx';
const PREFIX = 'rag:doc:';
const DIM = 1536;
class RedisVectorStore {
    constructor(redis, logger) {
        this.redis = redis;
        this.logger = logger;
    }
    async ensureIndex() {
        try {
            await this.redis.call('FT.INFO', INDEX);
            return true;
        }
        catch {
        }
        try {
            await this.redis.call('FT.CREATE', INDEX, 'ON', 'HASH', 'PREFIX', '1', PREFIX, 'SCHEMA', 'source', 'TAG', 'text', 'TEXT', 'embedding', 'VECTOR', 'FLAT', '6', 'TYPE', 'FLOAT32', 'DIM', String(DIM), 'DISTANCE_METRIC', 'COSINE');
            this.logger.log('Redis Stack 벡터 인덱스 생성됨', 'RedisVectorStore');
            return true;
        }
        catch (err) {
            this.logger.warn(`벡터 인덱스 생성 실패(일반 Redis일 수 있음): ${err instanceof Error ? err.message : err}`, 'RedisVectorStore');
            return false;
        }
    }
    async upsert(chunk) {
        const key = `${PREFIX}${chunk.id}`;
        const buf = float32Buffer(chunk.embedding);
        await this.redis.hset(key, {
            source: chunk.source,
            text: chunk.text,
            embedding: buf
        });
    }
    async search(queryEmbedding, topK) {
        const buf = float32Buffer(queryEmbedding);
        const raw = (await this.redis.call('FT.SEARCH', INDEX, `*=>[KNN ${topK} @embedding $vec AS score]`, 'PARAMS', '2', 'vec', buf, 'SORTBY', 'score', 'RETURN', '3', 'source', 'text', 'score', 'DIALECT', '2'));
        return parseSearchResult(raw);
    }
}
exports.RedisVectorStore = RedisVectorStore;
function float32Buffer(vec) {
    const a = new Float32Array(DIM);
    for (let i = 0; i < Math.min(DIM, vec.length); i++)
        a[i] = vec[i];
    return Buffer.from(a.buffer);
}
function parseSearchResult(raw) {
    if (!Array.isArray(raw) || raw.length < 2)
        return [];
    const hits = [];
    for (let i = 1; i < raw.length; i += 2) {
        const fields = raw[i + 1];
        if (!Array.isArray(fields))
            continue;
        const map = {};
        for (let j = 0; j < fields.length; j += 2) {
            map[String(fields[j])] = String(fields[j + 1]);
        }
        const score = map.score ? 1 - Number(map.score) : 0;
        hits.push({
            source: map.source ?? '',
            text: map.text ?? '',
            score: Number.isFinite(score) ? score : 0
        });
    }
    return hits;
}
//# sourceMappingURL=redis-vector.store.js.map
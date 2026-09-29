import type Redis from 'ioredis';
import type { AppLogger } from '../common/logger/app-logger.service';
import type { RagChunk, RagHit } from './rag.types';
export declare class RedisVectorStore {
    private readonly redis;
    private readonly logger;
    constructor(redis: Redis, logger: AppLogger);
    ensureIndex(): Promise<boolean>;
    upsert(chunk: RagChunk): Promise<void>;
    search(queryEmbedding: number[], topK: number): Promise<RagHit[]>;
}

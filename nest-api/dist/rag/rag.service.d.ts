import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../common/logger/app-logger.service';
import type { RagHit } from './rag.types';
export declare class RagService implements OnModuleInit {
    private readonly config;
    private readonly logger;
    private client;
    private chunks;
    private ready;
    private readonly topK;
    private readonly minScore;
    private vectorStore;
    private useRedisVector;
    private redisClient;
    constructor(config: ConfigService, logger: AppLogger);
    onModuleInit(): Promise<void>;
    isReady(): boolean;
    private tryConnectRedisStack;
    indexKnowledgeFolder(): Promise<void>;
    ingestDocument(source: string, text: string): Promise<void>;
    retrieve(query: string): Promise<RagHit[]>;
    formatContext(hits: RagHit[]): string;
    private getClient;
    private embed;
}

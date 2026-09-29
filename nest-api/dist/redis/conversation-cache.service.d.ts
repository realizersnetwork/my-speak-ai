import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../common/logger/app-logger.service';
import type { CachedTurn } from './conversation.types';
export declare class ConversationCacheService implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly logger;
    private redis;
    private memory;
    private readonly ttlSec;
    private readonly maxTurns;
    private mode;
    constructor(config: ConfigService, logger: AppLogger);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    getMode(): "redis" | "memory";
    private key;
    getHistory(conversationId: string): Promise<CachedTurn[]>;
    appendTurn(conversationId: string, userText: string, assistantText: string): Promise<void>;
}

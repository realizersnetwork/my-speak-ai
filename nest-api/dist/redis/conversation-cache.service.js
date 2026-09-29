"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationCacheService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const app_logger_service_1 = require("../common/logger/app-logger.service");
let ConversationCacheService = class ConversationCacheService {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.redis = null;
        this.memory = new Map();
        this.mode = 'memory';
        this.ttlSec = Number(this.config.get('REDIS_TTL_SEC') ?? 3600);
        this.maxTurns = Number(this.config.get('CHAT_MAX_TURNS') ?? 20);
    }
    async onModuleInit() {
        const url = this.config.get('REDIS_URL') ?? 'redis://127.0.0.1:6379';
        try {
            const client = new ioredis_1.default(url, {
                maxRetriesPerRequest: 1,
                lazyConnect: true,
                connectTimeout: 1500,
                enableOfflineQueue: false,
                retryStrategy: () => null
            });
            client.on('error', () => {
            });
            await client.connect();
            await client.ping();
            this.redis = client;
            this.mode = 'redis';
            this.logger.log(`Redis 연결됨 · ${url}`, 'ConversationCache');
        }
        catch (err) {
            try {
                this.redis?.disconnect();
            }
            catch {
            }
            this.redis = null;
            this.mode = 'memory';
            this.logger.warn(`Redis 연결 실패 → 메모리 캐시 사용 (${err instanceof Error ? err.message : err})`, 'ConversationCache');
        }
    }
    async onModuleDestroy() {
        if (this.redis)
            await this.redis.quit().catch(() => undefined);
    }
    getMode() {
        return this.mode;
    }
    key(conversationId) {
        return `chat:conv:${conversationId}`;
    }
    async getHistory(conversationId) {
        if (!conversationId)
            return [];
        if (this.redis) {
            const raw = await this.redis.get(this.key(conversationId));
            if (!raw)
                return [];
            try {
                return JSON.parse(raw);
            }
            catch {
                return [];
            }
        }
        return [...(this.memory.get(conversationId) ?? [])];
    }
    async appendTurn(conversationId, userText, assistantText) {
        if (!conversationId)
            return;
        const prev = await this.getHistory(conversationId);
        const next = [
            ...prev,
            { role: 'user', content: userText },
            { role: 'assistant', content: assistantText }
        ].slice(-this.maxTurns);
        if (this.redis) {
            await this.redis.set(this.key(conversationId), JSON.stringify(next), 'EX', this.ttlSec);
            this.logger.log(`Redis 캐시 저장 · id=${conversationId} · turns=${next.length}`, 'ConversationCache');
            return;
        }
        this.memory.set(conversationId, next);
        this.logger.log(`메모리 캐시 저장 · id=${conversationId} · turns=${next.length}`, 'ConversationCache');
    }
};
exports.ConversationCacheService = ConversationCacheService;
exports.ConversationCacheService = ConversationCacheService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        app_logger_service_1.AppLogger])
], ConversationCacheService);
//# sourceMappingURL=conversation-cache.service.js.map
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
exports.RagService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const openai_1 = __importDefault(require("openai"));
const ioredis_1 = __importDefault(require("ioredis"));
const app_logger_service_1 = require("../common/logger/app-logger.service");
const redis_vector_store_1 = require("./redis-vector.store");
let RagService = class RagService {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.client = null;
        this.chunks = [];
        this.ready = false;
        this.vectorStore = null;
        this.useRedisVector = false;
        this.redisClient = null;
        this.topK = Number(this.config.get('RAG_TOP_K') ?? 3);
        this.minScore = Number(this.config.get('RAG_MIN_SCORE') ?? 0.25);
    }
    async onModuleInit() {
        const key = this.config.get('OPENAI_API_KEY');
        if (!key) {
            this.logger.warn('OPENAI_API_KEY 없음 — RAG 비활성', 'RagService');
            return;
        }
        this.client = new openai_1.default({ apiKey: key });
        await this.tryConnectRedisStack();
        try {
            await this.indexKnowledgeFolder();
            this.ready = this.chunks.length > 0 || this.useRedisVector;
            this.logger.log(`RAG 인덱스 완료 · memoryChunks=${this.chunks.length} · vector=${this.useRedisVector ? 'redis-stack' : 'memory'}`, 'RagService');
        }
        catch (err) {
            this.logger.error(`RAG 인덱싱 실패: ${err instanceof Error ? err.message : err}`, err instanceof Error ? err.stack : undefined, 'RagService');
        }
    }
    isReady() {
        return this.ready && (this.chunks.length > 0 || this.useRedisVector);
    }
    async tryConnectRedisStack() {
        const url = this.config.get('REDIS_URL') ?? 'redis://127.0.0.1:6379';
        try {
            const redis = new ioredis_1.default(url, {
                maxRetriesPerRequest: 1,
                lazyConnect: true,
                connectTimeout: 1500,
                enableOfflineQueue: false,
                retryStrategy: () => null
            });
            redis.on('error', () => undefined);
            await redis.connect();
            await redis.ping();
            const store = new redis_vector_store_1.RedisVectorStore(redis, this.logger);
            const ok = await store.ensureIndex();
            if (ok) {
                this.redisClient = redis;
                this.vectorStore = store;
                this.useRedisVector = true;
                this.logger.log('RAG Vector DB = Redis Stack', 'RagService');
                return;
            }
            await redis.quit().catch(() => undefined);
        }
        catch (err) {
            this.logger.warn(`Redis Stack 벡터 미사용 → 메모리 RAG (${err instanceof Error ? err.message : err})`, 'RagService');
            this.useRedisVector = false;
            this.vectorStore = null;
        }
    }
    async indexKnowledgeFolder() {
        const dir = (0, path_1.join)(process.cwd(), 'knowledge');
        let files = [];
        try {
            files = (await (0, promises_1.readdir)(dir)).filter((f) => /\.(md|txt)$/i.test(f));
        }
        catch {
            this.logger.warn(`knowledge 폴더 없음: ${dir}`, 'RagService');
            return;
        }
        for (const file of files) {
            const text = await (0, promises_1.readFile)((0, path_1.join)(dir, file), 'utf8');
            await this.ingestDocument(file, text);
        }
    }
    async ingestDocument(source, text) {
        const pieces = chunkText(text, 700);
        this.logger.log(`인덱싱 · ${source} · ${pieces.length} chunks`, 'RagService');
        for (let i = 0; i < pieces.length; i++) {
            const piece = pieces[i];
            const embedding = await this.embed(piece);
            const chunk = {
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
    async retrieve(query) {
        if (!this.isReady())
            return [];
        const qVec = await this.embed(query);
        if (this.vectorStore && this.useRedisVector) {
            try {
                const hits = await this.vectorStore.search(qVec, this.topK);
                if (hits.length > 0) {
                    this.logger.log(`RAG(Redis Stack) · hits=${hits.length} · top=${hits[0]?.score?.toFixed(3) ?? '-'}`, 'RagService');
                    return hits;
                }
            }
            catch (err) {
                this.logger.warn(`Redis 벡터 검색 실패 → 메모리: ${err instanceof Error ? err.message : err}`, 'RagService');
            }
        }
        const scored = this.chunks
            .map((c) => ({
            source: c.source,
            text: c.text,
            score: cosineSimilarity(qVec, c.embedding)
        }))
            .sort((a, b) => b.score - a.score);
        const filtered = scored.filter((h) => h.score >= this.minScore);
        const picked = (filtered.length > 0 ? filtered : scored.slice(0, 1)).slice(0, this.topK);
        this.logger.log(`RAG(memory) · hits=${picked.length} · top=${picked[0]?.score?.toFixed(3) ?? '-'}`, 'RagService');
        return picked;
    }
    formatContext(hits) {
        if (!hits.length)
            return '';
        return hits
            .map((h, i) => `[문서${i + 1}: ${h.source}]\n${h.text}`)
            .join('\n\n');
    }
    getClient() {
        if (!this.client) {
            throw new common_1.ServiceUnavailableException('OpenAI 클라이언트가 없습니다');
        }
        return this.client;
    }
    async embed(text) {
        const client = this.getClient();
        const res = await client.embeddings.create({
            model: 'text-embedding-3-small',
            input: text.slice(0, 8000)
        });
        return res.data[0]?.embedding ?? [];
    }
};
exports.RagService = RagService;
exports.RagService = RagService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        app_logger_service_1.AppLogger])
], RagService);
function chunkText(text, maxLen) {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized)
        return [];
    const paras = normalized.split(/\n{2,}/);
    const chunks = [];
    let buf = '';
    for (const p of paras) {
        const next = buf ? `${buf}\n\n${p}` : p;
        if (next.length > maxLen && buf) {
            chunks.push(buf.trim());
            buf = p;
        }
        else {
            buf = next;
        }
    }
    if (buf.trim())
        chunks.push(buf.trim());
    return chunks;
}
function cosineSimilarity(a, b) {
    if (!a.length || !b.length || a.length !== b.length)
        return 0;
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
//# sourceMappingURL=rag.service.js.map
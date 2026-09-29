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
exports.OpenaiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = __importDefault(require("openai"));
const app_logger_service_1 = require("../common/logger/app-logger.service");
const conversation_cache_service_1 = require("../redis/conversation-cache.service");
const rag_service_1 = require("../rag/rag.service");
const prompt_cache_prefix_1 = require("./prompt-cache.prefix");
const few_shot_examples_1 = require("./few-shot.examples");
let OpenaiService = class OpenaiService {
    constructor(config, logger, cache, rag) {
        this.config = config;
        this.logger = logger;
        this.cache = cache;
        this.rag = rag;
        this.client = null;
        const key = this.config.get('OPENAI_API_KEY');
        if (key) {
            this.client = new openai_1.default({ apiKey: key });
            this.logger.log('OpenAI 클라이언트 준비됨', 'OpenaiService');
        }
        else {
            this.logger.warn('OPENAI_API_KEY 없음', 'OpenaiService');
        }
    }
    getClient() {
        if (!this.client) {
            throw new common_1.ServiceUnavailableException('OPENAI_API_KEY가 설정되지 않았어요. .env를 확인하세요');
        }
        return this.client;
    }
    pickUsage(usage) {
        if (!usage)
            return undefined;
        const details = usage.prompt_tokens_details;
        return {
            prompt_tokens: usage.prompt_tokens ?? 0,
            completion_tokens: usage.completion_tokens ?? 0,
            total_tokens: usage.total_tokens ?? 0,
            cached_tokens: details?.cached_tokens ?? 0
        };
    }
    async generateText(prompt) {
        const result = await this.chat({ userText: prompt });
        return result.content;
    }
    async chat(input) {
        const client = this.getClient();
        const { userText, conversationId } = input;
        const history = conversationId ? await this.cache.getHistory(conversationId) : [];
        const hits = await this.rag.retrieve(userText);
        const ragContext = this.rag.formatContext(hits);
        const ragSources = [...new Set(hits.map((h) => h.source))];
        this.logger.log(`chat · conv=${conversationId ?? 'none'} · history=${history.length} · rag=${hits.length} · cache=${this.cache.getMode()}`, 'OpenaiService');
        const systemParts = [
            'You are My Speak AI, a technical interview prep and study assistant.',
            'Use prior conversation context when provided.',
            'If REFERENCE DOCUMENTS are provided, base your answer primarily on them.',
            'If documents are insufficient, say what is missing briefly, then answer carefully.',
            'Reply in the user\'s language. Prefer clear, structured explanations for interview topics.',
            'Follow the style of the few-shot examples below.'
        ];
        if (ragContext) {
            systemParts.push(`\nREFERENCE DOCUMENTS:\n${ragContext}`);
        }
        const completion = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.4,
            max_tokens: 900,
            messages: [
                { role: 'system', content: systemParts.join('\n') },
                ...few_shot_examples_1.FEW_SHOT_MESSAGES,
                ...history.map((t) => ({
                    role: t.role,
                    content: t.content
                })),
                { role: 'user', content: userText }
            ]
        });
        const text = completion.choices[0]?.message?.content?.trim() ?? '';
        if (!text)
            throw new Error('empty model reply');
        const usage = this.pickUsage(completion.usage);
        const tokens = usage?.total_tokens ?? 0;
        if (conversationId) {
            await this.cache.appendTurn(conversationId, userText, text);
        }
        this.logger.log(`완료 · tokens=${tokens} · cached=${usage?.cached_tokens ?? 0} · ragSources=${ragSources.join(',') || '-'}`, 'OpenaiService');
        return {
            content: text,
            tokens,
            cache: this.cache.getMode(),
            ragSources: ragSources.length ? ragSources : undefined,
            usage
        };
    }
    async chatWithPromptCache(userText) {
        const client = this.getClient();
        this.logger.log('prompt-cache 요청', 'OpenaiService');
        const completion = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.5,
            max_tokens: 400,
            messages: [
                { role: 'system', content: prompt_cache_prefix_1.PROMPT_CACHE_PREFIX },
                { role: 'user', content: userText }
            ]
        });
        const text = completion.choices[0]?.message?.content?.trim() ?? '';
        if (!text)
            throw new Error('empty model reply');
        const usage = this.pickUsage(completion.usage);
        this.logger.log(`prompt-cache 완료 · prompt=${usage?.prompt_tokens} · cached=${usage?.cached_tokens ?? 0}`, 'OpenaiService');
        return {
            content: text,
            tokens: usage?.total_tokens ?? 0,
            usage
        };
    }
    async *streamChat(userText) {
        const client = this.getClient();
        this.logger.log('stream 시작', 'OpenaiService');
        const stream = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.7,
            max_tokens: 800,
            stream: true,
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant. Reply in the user\'s language with clear, readable paragraphs.'
                },
                { role: 'user', content: userText }
            ]
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta)
                yield delta;
        }
        this.logger.log('stream 종료', 'OpenaiService');
    }
    async ingestKnowledge(source, text) {
        await this.rag.ingestDocument(source, text);
        return { ok: true, source, ready: this.rag.isReady() };
    }
    async createCompletion(prompt) {
        const r = await this.chat({ userText: prompt });
        return { completion: r.content, tokens: r.tokens };
    }
};
exports.OpenaiService = OpenaiService;
exports.OpenaiService = OpenaiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        app_logger_service_1.AppLogger,
        conversation_cache_service_1.ConversationCacheService,
        rag_service_1.RagService])
], OpenaiService);
//# sourceMappingURL=openai.service.js.map
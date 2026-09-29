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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenaiController = void 0;
const common_1 = require("@nestjs/common");
const openai_service_1 = require("./openai.service");
const chat_prompt_dto_1 = require("./dto/chat.prompt.dto");
const ingest_knowledge_dto_1 = require("./dto/ingest-knowledge.dto");
const app_logger_service_1 = require("../common/logger/app-logger.service");
let OpenaiController = class OpenaiController {
    constructor(openaiService, logger) {
        this.openaiService = openaiService;
        this.logger = logger;
    }
    async generateText(dto) {
        const userText = dto.getUserText();
        if (!userText) {
            throw new common_1.BadRequestException('content 또는 prompt가 필요해요');
        }
        this.logger.log(`POST /openai/chat · conv=${dto.conversationId ?? '-'}`, 'OpenaiController');
        return this.openaiService.chat({
            userText,
            conversationId: dto.conversationId
        });
    }
    async promptCache(dto) {
        const userText = dto.getUserText();
        if (!userText) {
            throw new common_1.BadRequestException('content 또는 prompt가 필요해요');
        }
        this.logger.log('POST /openai/prompt-cache', 'OpenaiController');
        return this.openaiService.chatWithPromptCache(userText);
    }
    async stream(dto, res) {
        const userText = dto.getUserText();
        if (!userText) {
            throw new common_1.BadRequestException('content 또는 prompt가 필요해요');
        }
        this.logger.log('POST /openai/chat/stream', 'OpenaiController');
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        try {
            for await (const delta of this.openaiService.streamChat(userText)) {
                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
            }
            res.write('data: [DONE]\n\n');
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`stream 실패: ${msg}`, undefined, 'OpenaiController');
            res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
        }
        finally {
            res.end();
        }
    }
    async ingest(dto) {
        this.logger.log(`POST /openai/knowledge · ${dto.source}`, 'OpenaiController');
        return this.openaiService.ingestKnowledge(dto.source, dto.text);
    }
};
exports.OpenaiController = OpenaiController;
__decorate([
    (0, common_1.Post)('chat'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chat_prompt_dto_1.ChatPromptDto]),
    __metadata("design:returntype", Promise)
], OpenaiController.prototype, "generateText", null);
__decorate([
    (0, common_1.Post)('prompt-cache'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chat_prompt_dto_1.ChatPromptDto]),
    __metadata("design:returntype", Promise)
], OpenaiController.prototype, "promptCache", null);
__decorate([
    (0, common_1.Post)('chat/stream'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chat_prompt_dto_1.ChatPromptDto, Object]),
    __metadata("design:returntype", Promise)
], OpenaiController.prototype, "stream", null);
__decorate([
    (0, common_1.Post)('knowledge'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ingest_knowledge_dto_1.IngestKnowledgeDto]),
    __metadata("design:returntype", Promise)
], OpenaiController.prototype, "ingest", null);
exports.OpenaiController = OpenaiController = __decorate([
    (0, common_1.Controller)('openai'),
    __metadata("design:paramtypes", [openai_service_1.OpenaiService,
        app_logger_service_1.AppLogger])
], OpenaiController);
//# sourceMappingURL=openai.controller.js.map
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../common/logger/app-logger.service';
import { ConversationCacheService } from '../redis/conversation-cache.service';
import { RagService } from '../rag/rag.service';
import type { ChatCompletionDto } from './dto/chat.completion.dto';
import type { ChatResponseDto } from './dto/chat.response.dto';
export declare class OpenaiService {
    private readonly config;
    private readonly logger;
    private readonly cache;
    private readonly rag;
    private client;
    constructor(config: ConfigService, logger: AppLogger, cache: ConversationCacheService, rag: RagService);
    private getClient;
    private pickUsage;
    generateText(prompt: string): Promise<string>;
    chat(input: {
        userText: string;
        conversationId?: string;
    }): Promise<ChatResponseDto>;
    chatWithPromptCache(userText: string): Promise<ChatResponseDto>;
    streamChat(userText: string): AsyncGenerator<string>;
    ingestKnowledge(source: string, text: string): Promise<{
        ok: boolean;
        source: string;
        ready: boolean;
    }>;
    createCompletion(prompt: string): Promise<ChatCompletionDto>;
}

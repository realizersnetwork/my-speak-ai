import type { Response } from 'express';
import { OpenaiService } from './openai.service';
import { ChatPromptDto } from './dto/chat.prompt.dto';
import { ChatResponseDto } from './dto/chat.response.dto';
import { IngestKnowledgeDto } from './dto/ingest-knowledge.dto';
import { AppLogger } from '../common/logger/app-logger.service';
export declare class OpenaiController {
    private readonly openaiService;
    private readonly logger;
    constructor(openaiService: OpenaiService, logger: AppLogger);
    generateText(dto: ChatPromptDto): Promise<ChatResponseDto>;
    promptCache(dto: ChatPromptDto): Promise<ChatResponseDto>;
    stream(dto: ChatPromptDto, res: Response): Promise<void>;
    ingest(dto: IngestKnowledgeDto): Promise<{
        ok: boolean;
        source: string;
        ready: boolean;
    }>;
}

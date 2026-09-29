export declare class UsageDto {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cached_tokens?: number;
}
export declare class ChatResponseDto {
    content: string;
    tokens?: number;
    cache?: string;
    ragSources?: string[];
    usage?: UsageDto;
}

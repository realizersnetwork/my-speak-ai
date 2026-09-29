export interface RagChunk {
    id: string;
    source: string;
    text: string;
    embedding: number[];
}
export interface RagHit {
    source: string;
    text: string;
    score: number;
}

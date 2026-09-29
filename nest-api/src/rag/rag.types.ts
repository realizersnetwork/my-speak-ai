/**
 * RAG에서 쓰는 데이터 모양(타입) 정의.
 * 인덱스에 넣는 조각(RagChunk)과 검색 결과 한 건(RagHit)을 나눈다.
 */

/** RAG 인덱스에 올라간 문서 조각 — 저장·검색 단위 */
export interface RagChunk {
	/** 고유 ID (예: interview.md#0) — Redis 키에도 사용 */
	id: string;
	/** 출처 파일명/식별자 (응답 ragSources에 표시) */
	source: string;
	/** 청크 원문 텍스트 */
	text: string;
	/** text-embedding-3-small 벡터(숫자 배열, 보통 1536개) */
	embedding: number[];
}

/** 유사도 검색 결과 한 건 — 프롬프트에 넣을 때 사용 */
export interface RagHit {
	/** 어느 문서에서 왔는지 */
	source: string;
	/** 참고로 넣을 본문 */
	text: string;
	/** 코사인 유사도(높을수록 질문과 관련) — 0~1 근사 */
	score: number;
}

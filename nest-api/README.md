# My Speak AI — Nest.js (표본 + Redis 문맥 + RAG)

## 구조

```
src/openai/     Controller · Service · DTO
src/redis/      대화 문맥 캐시
src/rag/        지식 검색 (임베딩 + 유사도)
knowledge/      RAG 원본 문서 (.md)
```

## 실행

```bash
cd nest-api
docker compose up -d   # Redis 선택
npm run start:dev
```

시작 시 `knowledge/*.md`를 임베딩 인덱싱합니다.

## RAG 테스트 (표본 질문)

```bash
curl -X POST http://localhost:3000/openai/chat \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"데이터베이스 격리수준에 대해서 알려줘\",\"conversationId\":\"conv_rag1\"}"
```

응답에 `ragSources` (예: `db-isolation-levels.md`)가 포함됩니다.

## 지식 추가

```bash
curl -X POST http://localhost:3000/openai/knowledge \
  -H "Content-Type: application/json" \
  -d "{\"source\":\"custom.txt\",\"text\":\"여기에 학습시킬 텍스트...\"}"
```

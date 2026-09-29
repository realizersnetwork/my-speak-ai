# 과제 3. RAG 적용하여 나만의 기술면접 대비용 챗봇 만들기

**도구:** redis-stack, Nest.js, OpenAI API  
**관련 코드:** `nest-api/src/rag/`, `nest-api/knowledge/`, `chatbot-ui/`

---

## 1. 과제 요구사항

### 규칙 1. Embedding · Vector DB 개념 정리
아래 **2절** 참고.

### 규칙 2. 텍스트 소스 기반 RAG 응답 API
- Vector DB로 **Redis Stack** 사용 (가능 시)
- Nest.js + OpenAI로 검색→생성 파이프라인

### 결과물 표본
- 질문: `데이터베이스 격리수준에 대해서 알려줘`
- 지식 문서 기반 상세 답변 + 프론트 연동

---

## 2. Embedding이란?

- 문장·문서를 **숫자 벡터(배열)** 로 바꾸는 과정
- 의미가 비슷한 텍스트는 벡터 공간에서 **가까운 위치**에 모임
- 본 과제: OpenAI `text-embedding-3-small` 로 청크·질문을 벡터화

## 3. Vector DB란?

- 벡터를 저장하고 **유사도 검색(KNN)** 하는 DB
- RAG에서 “질문과 비슷한 문서 조각”을 빠르게 찾을 때 사용
- **Redis Stack**: Redis + RediSearch 등으로 벡터 인덱스를 제공
- 본 구현: Redis Stack 연결 시 벡터 인덱스에 저장·검색, 실패 시 **메모리 벡터** 폴백

---

## 4. RAG 파이프라인

```
knowledge/*.md
  → 청크 분할
  → Embedding
  → Redis Stack Vector Index (또는 메모리)
       ↑
사용자 질문 → Embedding → Top-K 유사 청크
       ↓
프롬프트에 REFERENCE DOCUMENTS 삽입
       ↓
gpt-4o-mini 답변 + ragSources
```

---

## 5. 지식 문서

| 파일 | 내용 |
|------|------|
| `knowledge/db-isolation-levels.md` | 격리 수준 (면접 대비) |
| `knowledge/my-speak-ai.md` | 서비스 소개 |

추가: `POST /openai/knowledge` `{ source, text }`

---

## 6. 실행

```bash
cd nest-api
docker compose up -d          # redis-stack
npm run start:dev             # 시작 시 문서 인덱싱

cd chatbot-ui && npm run dev
```

질문 예: `데이터베이스 격리수준에 대해서 알려줘`  
UI 상단 `RAG: db-isolation-levels.md` 표시되면 성공.

---

## 7. 핵심 파일

| 파일 | 역할 |
|------|------|
| `rag/rag.service.ts` | 청크·임베딩·검색 |
| `rag/redis-vector.store.ts` | Redis Stack 벡터 저장/검색 |
| `openai/openai.service.ts` | 검색 결과로 답변 생성 |
| `docker-compose.yml` | `redis/redis-stack` 이미지 |

---

## 8. 완료 체크

- [x] Embedding 개념 정리
- [x] Vector DB 개념 정리
- [x] 텍스트 기반 RAG API
- [x] Redis Stack 연동(가능 시) + 폴백
- [x] 프론트 연동·표본 질문 대응

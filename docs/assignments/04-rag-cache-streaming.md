# 과제 4. RAG 기술면접 챗봇 고도화 (Prompt Caching · Streaming)

**도구:** Node.js(Nest), React, OpenAI API  
**관련 코드:** `nest-api/src/openai/`, `chatbot-ui/src/components/PromptCacheTest.tsx`, `StreamTest.tsx`

---

## 1. 과제 요구사항

### 규칙 1. Prompt Caching 적용
- 캐싱이 동작함을 확인 (`usage` 내 `cached_tokens`)

### 규칙 2. Streaming API로 채팅 UX 향상
- 응답이 한 번에 오지 않고 **실시간으로** 이어 나오도록 구현

### 결과물 표본
1. Postman/API 응답에서 `cached_tokens` 하이라이트
2. **OpenAI Streaming API 테스트** UI (입력 → 전송 → 응답 영역)

---

## 2. Prompt Caching이란?

- 요청마다 **앞부분(시스템·긴 컨텍스트)이 동일**하면 OpenAI가 그 구간을 캐시
- 두 번째 요청부터 입력 토큰 일부가 `cached_tokens`로 잡혀 **비용·지연 감소**
- 본 구현: 충분히 긴 고정 프리픽스(`prompt-cache.prefix.ts`) + `POST /openai/prompt-cache`

### 확인 방법

**A. React UI**  
http://localhost:5173 → 탭 **Prompt Caching** → 「2회 연속 호출」  
2번째 결과에 `cached_tokens > 0` 표시

**B. Postman / curl**

```bash
# 1번째
curl -X POST http://localhost:3000/openai/prompt-cache \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"한국에 대해 아는 게 많아?\"}"

# 2번째 — cached_tokens 확인
curl -X POST http://localhost:3000/openai/prompt-cache \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"한국 역사에 대해 짧게 알려줘\"}"
```

응답 예:
```json
"usage": {
  "prompt_tokens": 2185,
  "completion_tokens": 80,
  "total_tokens": 2265,
  "cached_tokens": 2048
}
```

---

## 3. Streaming API

- Nest: `POST /openai/chat/stream` — `text/event-stream` (SSE)
- React: `StreamTest` — `ReadableStream`으로 청크를 이어 붙여 표시
- 표본 UI: 제목 **OpenAI Streaming API 테스트**, textarea, 전송, 「응답:」

실행: http://localhost:5173 → 탭 **Streaming API**  
예 입력: `안녕 한국에 대해서 알려줘`

---

## 4. 엔드포인트 정리

| Method | Path | 용도 |
|--------|------|------|
| POST | `/openai/prompt-cache` | Caching + `usage.cached_tokens` |
| POST | `/openai/chat/stream` | SSE 스트리밍 |
| POST | `/openai/chat` | RAG+문맥 일반 채팅 |

Postman: `docs/postman/MySpeak_AI_QA.postman_collection.json`

---

## 5. 완료 체크

- [x] Prompt Caching 적용
- [x] `cached_tokens` 확인 (실측 가능)
- [x] Streaming API UX
- [x] 표본과 유사한 Streaming 테스트 화면

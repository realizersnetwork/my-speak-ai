# My Speak AI — 과제 프롬프트별 작업 보고서

본 문서는 과제 진행 중 작성한 **프롬프트 7개**에 대해, 요청 의도 · 수행 작업 · 산출물 · 완료 여부를 정리한 보고서입니다.

제품 구성:
- **SvelteKit 앱** (`src/`) — Translate / Talking, Vercel 배포
- **Nest.js Q&A 서버** (`nest-api/`) — 과제 표본(lim-server) 기반
- **React 챗봇 UI** (`chatbot-ui/`) — Axios · Redis 문맥 · RAG · Caching · Streaming

---

## 프롬프트 1  
**「방금 쓴 프롬프트는 여태 만들었던 제품에 대한 보고서 요구사항이야 적절히 써봐」**

### 요청 요지
OpenAI API Key 발급·환경설정, REST API 설계·구현(curl/Postman), Nest.js(Controller/Service/Module/DTO/로깅/OpenAI 연동)를 **기존 My Speak AI 제품에 맞춰** 보고서 형태로 작성.

### 수행 내용
- 제품 API(`/api/talking/*`, `/api/stt` 등)와 OpenAI Key·Vercel 환경변수를 보고서에 매핑
- 당시 본체는 SvelteKit이므로 Nest 개념을 SvelteKit 계층에 **대응 설명**

### 산출물
- 대화 중 작성한 기술 구현 보고서(초안)
- `.env` / Vercel `OPENAI_API_KEY` 설정 문서화

### 완료 여부
✅ 보고서 초안 작성 완료  
⚠️ 이 시점에는 Nest 실코드가 아직 없었음 → **프롬프트 2에서 구현으로 보완**

---

## 프롬프트 2  
**「다 반영되어 있어? 안된건 지금이라도 반영해줘」**

### 요청 요지
보고서 요구사항이 **코드에 실제 반영**됐는지 점검하고, 빠진 것은 즉시 구현.

### 당시 미비 → 보완
| 항목 | 조치 |
|------|------|
| Nest.js 구조 | `nest-api/` 신규 |
| DTO / Interface | `AskQuestionDto` 등 (이후 표본에 맞게 개편) |
| 로깅 | `AppLogger` + SvelteKit `logger.js` |
| curl/Postman | `docs/API_TEST.md`, Postman 컬렉션 |
| SvelteKit DTO | `src/lib/server/dto.js` |

### 산출물
- `nest-api/` 초기 서버
- `docs/API_TEST.md`, `docs/postman/`
- `src/lib/server/logger.js`, `dto.js`

### 완료 여부
✅ 요구 기능 코드 반영 완료

---

## 프롬프트 3  
**「이게 이 과제의 표본이라는데 뭐 비슷하게 해봐」** *(lim-server 스크린샷)*

### 요청 요지
표본 Nest 프로젝트와 **동일한 형태**: `openai/` Module·Controller·Service·DTO, `POST /openai/chat`, `{ prompt }` → 답변 문자열.

### 수행 내용
- `qa/` 구조를 `openai/` 표본 구조로 재편
- `ChatPromptDto`, `OpenaiController.generateText`, 포트 **3000**
- curl 테스트: `POST http://localhost:3000/openai/chat`

### 산출물
```
nest-api/src/openai/
  dto/chat.prompt.dto.ts …
  openai.controller.ts
  openai.service.ts
  openai.module.ts
```

### 완료 여부
✅ 표본과 동일 엔드포인트·폴더 구조로 맞춤 완료

---

## 프롬프트 4  
**「그 다음은 이거」** *(React 챗봇 UI + Axios)*

### 요청 요지
React·TypeScript로 대화형 채팅 UI / Q&A 뷰, Axios로 Nest 연동, 네트워크 에러 처리. 표본: "Your Own Chatbot" 다크 UI.

### 수행 내용
- Vite React TS 앱 `chatbot-ui/` 생성
- 유저 왼쪽 흰 말풍선 / 봇 오른쪽 보라 말풍선
- `axios` → `POST /openai/chat`
- `toNetworkErrorMessage` (연결 실패·타임아웃·5xx)

### 산출물
- `chatbot-ui/src/components/ChatView.tsx` 등
- `chatbot-ui/src/api/openai.ts`

### 완료 여부
✅ 완료

---

## 프롬프트 5  
**「또그다음은 이거」** *(Redis 대화 문맥 + conversationId)*

### 요청 요지
프론트에서 `conv_${Date.now()}` 생성, 요청에 `conversationId` 포함. 백엔드 Redis로 문맥 캐싱.

### 수행 내용
- Nest: `ConversationCacheService` (Redis, 실패 시 **메모리 폴백**)
- 요청 DTO: `content` + `conversationId`
- React: 마운트 시 ID 생성, `RequestDTO` / `ResponseDTO`, 컴포넌트 분리(`ChatHistoryView`, `UserInputView`, `SearchBarView`)
- `docker-compose.yml` (Redis 선택 실행)

### 산출물
- `nest-api/src/redis/`
- `chatbot-ui/src/dto/openai/`

### 완료 여부
✅ 완료 (Redis 미기동 시에도 메모리로 문맥 유지)

---

## 프롬프트 6  
**「그 다음」** *(RAG)*

### 요청 요지
텍스트 지식 기반 답변(RAG). 표본 질문: 데이터베이스 격리수준.

### 수행 내용
- `knowledge/db-isolation-levels.md` 등 문서 임베딩 인덱싱
- `RagService`: chunk → `text-embedding-3-small` → 코사인 유사도 Top-K
- 채팅 시 검색 결과를 시스템 프롬프트에 주입, `ragSources` 반환
- UI에 RAG 출처 표시
- `POST /openai/knowledge` 문서 추가 API

### 산출물
- `nest-api/src/rag/`
- `nest-api/knowledge/`

### 완료 여부
✅ 완료 (격리수준 질문 시 `ragSources: db-isolation-levels.md` 확인)

---

## 프롬프트 7  
**「이게 최종」** *(Prompt Caching + Streaming)*

### 요청 요지
1. Prompt Caching — 응답 `usage.cached_tokens` 확인 (Postman 표본)
2. Streaming API — 실시간 UX (Dark UI 표본)

### 수행 내용
- `POST /openai/prompt-cache` + 긴 고정 프리픽스
- 2회 호출 시 `cached_tokens: 2048` **실측 확인**
- `POST /openai/chat/stream` (SSE)
- React **Streaming API** 탭 + **Prompt Caching** 탭(UI에서도 확인 가능)
- Postman 컬렉션 갱신

### 산출물
- `prompt-cache.prefix.ts`
- `StreamTest.tsx`, `PromptCacheTest.tsx`
- `docs/postman/MySpeak_AI_QA.postman_collection.json`

### 완료 여부
✅ 완료

---

## 종합 점검표

| 과제 요구 | 위치 | 상태 |
|-----------|------|------|
| OpenAI Key · 환경설정 | `.env`, Vercel, nest-api `.env` | ✅ |
| REST Q&A API | Nest `/openai/*`, SvelteKit `/api/talking/*` | ✅ |
| curl / Postman | `docs/API_TEST.md`, Postman JSON | ✅ |
| Nest Controller/Service/Module | `nest-api/src/openai/` | ✅ |
| DTO · Interface | `dto/*`, React `dto/openai/*` | ✅ |
| 로깅 | `AppLogger`, `logger.js` | ✅ |
| React 채팅 UI + Axios + 에러처리 | `chatbot-ui/` | ✅ |
| Redis 문맥 (`conversationId`) | `redis/` + ChatView | ✅ |
| RAG | `rag/` + `knowledge/` | ✅ |
| Prompt Caching (`cached_tokens`) | `/openai/prompt-cache` + UI 탭 | ✅ |
| Streaming | `/openai/chat/stream` + UI 탭 | ✅ |
| 본체 제품(Translate/Talking) | SvelteKit + Vercel | ✅ |

---

## 실행 방법 (최종)

```bash
# 선택: Redis
cd nest-api && docker compose up -d

# Nest (포트 3000)
cd nest-api && npm run start:dev

# React (포트 5173)
cd chatbot-ui && npm run dev

# 본체 제품 (선택)
cd .. && npm run dev
```

- 챗봇: http://localhost:5173 → 탭 **Your Own Chatbot / Prompt Caching / Streaming API**
- 배포 제품: https://my-speak-ai-beta.vercel.app

---

## 미비 사항 및 보완 (이번 정리에서)

| 항목 | 조치 |
|------|------|
| Prompt Caching이 Postman 전용에 가까웠음 | React **Prompt Caching** 탭 추가 |
| 프롬프트별 보고서 부재 | **본 문서**로 정리 |

현재 기준으로 위 7개 프롬프트에 대응하는 구현·문서는 **완료** 상태입니다.

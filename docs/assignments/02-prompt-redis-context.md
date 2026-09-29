# 과제 2. 대화 품질 개선을 위한 프롬프트 엔지니어링과 문맥 관리 시스템 구현

**도구:** Nest.js, React, Redis  
**관련 코드:** `nest-api/src/redis/`, `nest-api/src/openai/`, `chatbot-ui/`

---

## 1. 과제 요구사항

### 규칙 1. 프롬프트 엔지니어링 실습
- Few Shots 기법
- 프롬프트에 컨텍스트 제공

### 규칙 2. Redis 학습
- 인메모리 DB·캐시 구조 이해

### 규칙 3. 대화 문맥 관리 시스템 구현
- Redis 서버 구축·연동
- 대화 문맥 기반 응답 로직

### 결과물 표본 (프론트)
- 마운트 시 `conversationId = conv_${Date.now()}` 생성
- `POST /openai/chat` body에 `conversationId` 포함

---

## 2. Redis란? (간단 정리)

- 데이터를 **메모리**에 두어 읽기/쓰기가 빠른 저장소
- 키-값 구조로 **캐시·세션·대화 문맥** 저장에 적합
- 본 과제: `chat:conv:{conversationId}` 키에 최근 대화 턴 JSON 저장 (TTL)

---

## 3. 프롬프트 엔지니어링 (Few Shots)

Nest `OpenaiService.chat` 시스템 프롬프트에 **예시 Q&A(few-shot)** 를 넣어 답변 톤·형식을 고정합니다.

예시 의도:
- 짧은 회화/기술 설명 스타일
- 사용자 언어로 답변
- RAG 문서가 있으면 문서 우선

(구현: `nest-api/src/openai/few-shot.examples.ts`)

---

## 4. 문맥 관리 흐름

```
React 마운트 → conv_1739… 생성
     ↓
매 요청 { content, conversationId }
     ↓
Nest ConversationCacheService
  · Redis 있으면 Redis에 히스토리 get/append
  · 없으면 메모리 Map 폴백
     ↓
OpenAI messages = [system + few-shot] + history + user
```

---

## 5. 실행

```bash
# Redis (권장: Redis Stack)
cd nest-api
docker compose up -d

cd nest-api && npm run start:dev
cd chatbot-ui && npm run dev
```

테스트:
1. "내 이름은 민수야"
2. "내 이름이 뭐야?" → 같은 세션이면 이름을 기억

새로고침 시 새 `conversationId` → 문맥 초기화 (표본과 동일).

---

## 6. 핵심 파일

| 파일 | 역할 |
|------|------|
| `redis/conversation-cache.service.ts` | Redis/메모리 문맥 캐시 |
| `openai/openai.service.ts` | history를 messages에 포함 |
| `ChatView.tsx` | `conv_${Date.now()}` |
| `dto/openai/requestDto.ts` | `content` + `conversationId` |

---

## 7. 완료 체크

- [x] Few Shots / 컨텍스트 프롬프트
- [x] Redis 캐시 개념·연동 (미기동 시 메모리 폴백)
- [x] conversationId 기반 문맥 응답
- [x] React 표본 구조(DTO·컴포넌트 분리)

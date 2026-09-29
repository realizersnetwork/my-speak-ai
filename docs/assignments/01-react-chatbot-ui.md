# 과제 1. React 기반 챗봇 UI 개발 및 백엔드 연동

**도구:** React, TypeScript  
**관련 코드:** `chatbot-ui/` · Nest `nest-api/` (`POST /openai/chat`)

---

## 1. 과제 요구사항

### 규칙 1. 대화형 인터페이스 UI 구현
- 채팅 UI
- 질의/응답(Q&A) View

### 규칙 2. LLM API 백엔드 서버 연동
- Axios를 사용한 API 통신
- 네트워크 에러 처리

### 결과물 표본
- 다크 테마, 제목 **Your Own Chatbot**
- 사용자 말풍선: 왼쪽·흰색
- 봇 말풍선: 오른쪽·보라색

---

## 2. 구현 요약

| 요구 | 구현 위치 |
|------|-----------|
| 채팅 UI | `chatbot-ui/src/components/ChatView.tsx` |
| Q&A 말풍선 | `ChatBubble.tsx` (user 왼쪽 / bot 오른쪽) |
| Axios 통신 | `chatbot-ui/src/api/openai.ts` → `POST /openai/chat` |
| 네트워크 에러 | `toNetworkErrorMessage()` (연결 실패·타임아웃·4xx/5xx) |
| 백엔드 | Nest `OpenaiController` |

---

## 3. 실행 방법

```bash
# 터미널 1 — Nest 백엔드
cd nest-api
npm run start:dev

# 터미널 2 — React UI
cd chatbot-ui
npm run dev
```

브라우저: http://localhost:5173 → 탭 **Your Own Chatbot**

---

## 4. API 연동 흐름

```
[입력] → Axios POST http://localhost:3000/openai/chat
       body: { content, conversationId }
       ← { content, ... }
[말풍선 추가]
```

에러 시: 봇 말풍선에 사용자용 안내 문구 표시 (서버 미기동 등).

---

## 5. 핵심 소스 안내

- `ChatHistoryView.tsx` — 대화 목록(Q&A View)
- `UserInputView.tsx` — 입력창
- `requestDto.ts` / `responseDto.ts` — 요청·응답 타입

---

## 6. 완료 체크

- [x] 채팅 UI
- [x] Q&A View
- [x] Axios 연동
- [x] 네트워크 에러 처리
- [x] 표본과 유사한 다크·말풍선 레이아웃

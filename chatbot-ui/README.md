# React 챗봇 UI — 최종

## 탭
1. **Your Own Chatbot** — Axios / Redis conversationId / RAG
2. **Streaming API** — Nest SSE 실시간 응답 (표본 UI)

## 실행
```bash
cd nest-api && npm run start:dev
cd chatbot-ui && npm run dev
```

Prompt Caching은 Postman에서 `POST /openai/prompt-cache` 를 **두 번** 호출해 `cached_tokens` 확인.

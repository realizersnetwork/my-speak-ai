# 과제별 제출 문서 (첨부 스크린샷 4장 = 과제 4개)

| 파일 | 과제명 |
|------|--------|
| [01-react-chatbot-ui.md](./01-react-chatbot-ui.md) | React 기반 챗봇 UI 개발 및 백엔드 연동 |
| [02-prompt-redis-context.md](./02-prompt-redis-context.md) | 프롬프트 엔지니어링과 문맥 관리 (Redis) |
| [03-rag-interview-chatbot.md](./03-rag-interview-chatbot.md) | RAG 기술면접 대비 챗봇 |
| [04-rag-cache-streaming.md](./04-rag-cache-streaming.md) | RAG 고도화 (Prompt Caching · Streaming) |

## 공통 실행

```bash
cd nest-api && docker compose up -d
cd nest-api && npm run start:dev
cd chatbot-ui && npm run dev
```

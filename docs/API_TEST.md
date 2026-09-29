# My Speak AI — REST API 테스트 (curl / Postman)

## Nest.js (과제 표본과 동일)

서버 실행:
```bash
cd nest-api && npm run start:dev
```

### curl

```bash
curl -X POST http://localhost:3000/openai/chat \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"Who are you?\"}"
```

### Postman

1. Method: `POST`
2. URL: `http://localhost:3000/openai/chat`
3. Body → raw → JSON: `{ "prompt": "Who are you?" }`
4. Send → 답변 문자열 확인

컬렉션: `docs/postman/MySpeak_AI_QA.postman_collection.json`

---

## SvelteKit (제품 배포 API)

```bash
curl -X POST "https://my-speak-ai-beta.vercel.app/api/talking/reply" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"안녕하세요\",\"practiceLang\":\"ko\",\"scenarioId\":\"free\",\"history\":[]}"
```

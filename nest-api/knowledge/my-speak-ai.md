# My Speak AI 서비스 소개

My Speak AI는 실시간 통역(Translate)과 AI 회화 연습(Talking)을 제공하는 웹 앱입니다.
지원 언어는 한국어(ko), 영어(en), 일본어(ja)입니다.

## Translate
두 사람이 각자 언어로 말하면 상대 언어로 번역해 보여줍니다.
모바일에서는 Whisper STT를 사용해 음성 인식을 보조합니다.

## Talking
OpenAI Whisper로 음성을 인식하고 gpt-4o-mini로 짧은 회화 답변을 만듭니다.
시나리오 예: 자유 대화, 카페, 여행.

## 기술 스택
프론트는 SvelteKit, 과제용 Q&A 서버는 Nest.js + OpenAI + Redis 문맥 캐시 + RAG입니다.
배포는 Vercel(https://my-speak-ai-beta.vercel.app)을 사용합니다.

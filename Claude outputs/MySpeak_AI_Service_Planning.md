# MySpeak AI - 서비스 기획 및 API 설계 문서

## 1. 서비스 개요

### 1.1 서비스명
**MySpeak AI - 음성 기반 AI 회화 학습 플랫폼**

### 1.2 서비스 정의
사용자의 음성 입력을 기반으로 AI와 실시간 대화를 나누며 언어를 학습하는 서비스. 다양한 시나리오 환경에서 자연스러운 회화 연습이 가능하며, OpenAI의 최신 모델을 활용한 고품질의 응답과 피드백을 제공합니다.

### 1.3 주요 목표
- 사용자가 편리하게 음성으로 실시간 회화 학습
- 다양한 시나리오 기반의 실전 회화 연습
- 즉각적인 AI 피드백과 문법 교정
- 여러 언어 지원 (한국어, 영어, 일본어)
- 학습 진도 추적 및 개선

### 1.4 기술 스택
- **Frontend**: Svelte 5 + SvelteKit
- **Backend**: Node.js + SvelteKit Server Routes
- **AI/ML**: OpenAI API (Whisper, GPT, TTS)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **Testing**: Vitest + Playwright

---

## 2. 핵심 기능 (Core Features)

### 2.1 음성 기반 회화 학습 및 AI 응답 (Voice-Based Conversation with AI)

#### 기능 설명
사용자가 마이크로 음성을 입력하면, 이를 텍스트로 변환한 후 AI가 적절한 답변을 생성하고 다시 음성으로 출력하는 통합형 회화 학습 기능

#### 세부 명세
- **음성 녹음**: 브라우저의 Web Audio API를 통한 음성 캡처
- **음성 인식 (STT)**: OpenAI Whisper를 활용한 고정확도 음성-텍스트 변환
- **자연어 처리**: OpenAI GPT를 통한 문맥에 맞는 답변 생성
- **음성 출력 (TTS)**: OpenAI TTS를 통한 자연스러운 음성 응답 생성
- **실시간 처리**: 사용자 음성에 대한 평균 1-2초 이내의 빠른 응답
- **오류 처리**: 음성 인식 실패 시 친절한 재입력 요청

#### 기술 요구사항
- Whisper API: 정확도 90% 이상
- GPT API: 응답 시간 500ms 이내
- TTS API: 음성 합성 시간 1초 이내
- 음성 파일 크기: 12MB 이하

#### 사용자 혜택
- 자연스럽고 편한 학습 경험
- 발음 교정 기회
- 실제 대화에 가까운 연습
- 24/7 언제든지 학습 가능

---

### 2.2 시나리오 기반 대화 연습 (Scenario-Based Conversation Practice)

#### 기능 설명
다양한 상황별 대화 시나리오를 제공하여 사용자가 실제 상황에서 필요한 표현과 어휘를 학습할 수 있는 기능

#### 세부 명세
- **시나리오 관리**: 카페 주문, 호텔 체크인, 비즈니스 미팅 등 다양한 시나리오 제공
  - scenarioId: "free", "cafe", "hotel", "business", "doctor" 등
  - scenarioLabel: 사용자 친화적 시나리오 이름
  
- **문맥 유지**: 이전 대화 이력을 고려한 연속적인 대화 진행
  - history 배열: 이전 메시지 기록 유지
  - 대화의 자연스러움과 일관성 보장
  
- **난이도 조절**: 사용자 수준에 따른 응답 복잡도 조정
  - 초급: 단순하고 명확한 표현
  - 중급: 일상적인 표현 혼합
  - 고급: 복잡한 문법과 관용구 포함
  
- **토픽 기반 학습**: 특정 주제에 집중된 어휘와 표현 학습
- **즉각적 피드백**: 발음, 문법, 자연성에 대한 평가 제공

#### 기술 요구사항
- 시나리오 데이터베이스 구축 (최소 10개 이상)
- 문맥 메모리 길이: 최대 10개 메시지까지 유지
- 응답 품질: 일관성 있는 대화 흐름 (일관성 점수 80% 이상)

#### 사용자 혜택
- 실제 상황 대비 훈련
- 주제별 집중 학습
- 체계적인 학습 경로
- 자신감 향상

---

## 3. 부가 기능 (Additional Features)

### 3.1 다국어 음성 인식 및 번역 (Multi-Language STT & Translation)

#### 기능 설명
한국어, 영어, 일본어 등 여러 언어에 대한 음성 인식 기능을 제공하며, 필요시 언어 간 번역도 지원하는 기능

#### 세부 명세
- **지원 언어**: 한국어 (ko), 영어 (en), 일본어 (ja)
- **자동 언어 감지**: 언어 파라미터 미지정 시 자동으로 언어 인식
  - language 파라미터 생략 가능
  - Whisper의 자동 감지 기능 활용
  
- **언어별 최적화**: 각 언어에 맞는 발음 규칙 적용
- **단독 STT 기능**: 번역 등 다른 용도의 순수 음성 인식
  - /api/stt 엔드포인트: STT만 담당
  - 빠른 응답 (STT만 처리)
  
- **오류 처리**:
  - 음성 감지 실패 시 명확한 안내
  - API 할당량 초과 시 사용자 친화적 오류 메시지

#### 기술 요구사항
- Whisper 모델: 언어별 인식률 90% 이상
- 지원 파일 형식: WebM, MP3, WAV 등
- 파일 크기: 최대 12MB
- 처리 시간: 음성 길이의 0.5배 이내

#### 사용자 혜택
- 모국어 학습자 배경 고려
- 편리한 언어 선택
- 높은 인식 정확도
- 다양한 학습 콘텐츠 활용

---

### 3.2 학습 진도 추적 및 분석 대시보드 (Learning Progress Tracking & Analytics)

#### 기능 설명
사용자의 학습 활동을 종합적으로 추적하고, 성과를 시각화하여 맞춤형 피드백과 개선 제안을 제공하는 기능

#### 세부 명세
- **활동 기록**: 모든 회화 세션 자동 저장
  - 세션 시간, 시나리오, 문장 수, 소요 시간 기록
  - 정확도 및 유창성 점수 저장
  
- **진도율 분석**:
  - 학습 시간 추이
  - 시나리오별 학습 횟수
  - 언어별 학습량 비교
  
- **성과 지표**:
  - 정확도 (Accuracy): 음성 인식 정확도
  - 유창성 (Fluency): 자연스러운 회화 능력
  - 어휘 범위 (Vocabulary): 사용한 단어 수와 다양성
  - 발음 점수 (Pronunciation): 발음 평가
  
- **맞춤형 제안**:
  - 약한 영역 식별 및 강화 학습 제시
  - 학습 목표 설정 및 진도 표시
  - 일일 학습 목표 알림
  
- **디버그 패널**: 개발 및 테스트용 상세 정보 표시
  - API 호출 기록
  - 토큰 사용량
  - 에러 로그

#### 기술 요구사항
- 데이터 저장: 사용자별 학습 이력 DB
- 분석 엔진: 통계 계산 및 트렌드 분석
- 시각화: 그래프, 차트 등으로 직관적 표현
- 실시간 업데이트: 세션 완료 시 즉시 반영

#### 사용자(학습자) 혜택
- 학습 성과의 가시적 확인
- 객관적인 피드백
- 동기 부여
- 효율적인 학습 계획

---

## 4. API 설계 명세

### 4.1 기본 정보
- **Base URL**: `https://my-speak-ai.vercel.app/api`
- **형식**: multipart/form-data (음성 처리), JSON (텍스트 처리)
- **응답 포맷**: JSON
- **타임아웃**: 30초 (음성 처리), 10초 (텍스트 처리)
- **파일 크기 제한**: 12MB

---

### 4.2 핵심 API 엔드포인트

#### 4.2.1 음성 + 회화 턴 (Voice Conversation Turn)
```
POST /talking/turn
```

**요청 (Request)**
```
Content-Type: multipart/form-data

Parameters:
- audio (File, required): 사용자 음성 파일 (WebM, MP3 등)
- practiceLang (String, required): 학습 언어 ("ko" | "en" | "ja")
- scenarioId (String, optional): 시나리오 ID (기본값: "free")
- scenarioLabel (String, optional): 시나리오 라벨 (UI용)
- history (String, optional): JSON 형식의 대화 이력
```

**응답 (Response) - 성공 (200)**
```json
{
  "userText": "안녕하세요, 커피 한 잔 주세요.",
  "reply": "네, 어떤 종류의 커피를 원하세요? 아메리카노, 라떼, 카푸치노 등이 있습니다.",
  "tokens": 145,
  "billed": ["stt", "chat"]
}
```

**응답 (Response) - 실패 (400/502/503)**
```json
{
  "error": "음성을 알아듣지 못했어요. 다시 말해 주세요"
}
```

**에러 코드**:
- 400: 음성이 비어있음, 언어 지원 안 됨
- 502: 음성 처리 실패, API 오류
- 503: AI 서버 연결 안 됨

**처리 흐름**:
```
1. 음성 파일 검증 (크기, 형식)
2. Whisper STT: 음성 → 텍스트
3. GPT Chat: 텍스트 기반 답변 생성
4. 응답 토큰 수 반환
```

---

#### 4.2.2 텍스트 기반 회화 답변 (Text Reply)
```
POST /talking/reply
```

**요청 (Request)**
```json
{
  "text": "안녕하세요",
  "practiceLang": "ko",
  "scenarioId": "cafe",
  "scenarioLabel": "카페",
  "history": [
    {
      "role": "user",
      "content": "여기 영업하나요?"
    },
    {
      "role": "assistant",
      "content": "네, 맞습니다. 어서오세요"
    }
  ]
}
```

**응답 (Response) - 성공 (200)**
```json
{
  "reply": "안녕하세요! 무엇을 도와드릴까요?",
  "userText": "안녕하세요",
  "tokens": 89
}
```

**응답 (Response) - 실패**
```json
{
  "error": "메시지가 비어 있어요"
}
```

**에러 코드**:
- 400: 메시지 비어있음, 길이 초과 (>2000자), 언어 지원 안 됨
- 502: 답변 생성 실패
- 503: AI 서버 연결 안 됨

---

#### 4.2.3 순수 음성 인식 (Speech-to-Text Only)
```
POST /stt
```

**요청 (Request)**
```
Content-Type: multipart/form-data

Parameters:
- audio (File, required): 음성 파일
- language (String, optional): "ko" | "en" | "ja" (생략 시 자동 감지)
```

**응답 (Response) - 성공 (200)**
```json
{
  "text": "안녕하세요"
}
```

**응답 (Response) - 실패**
```json
{
  "error": "음성을 알아듣지 못했어요. 다시 말해 주세요"
}
```

**에러 코드**:
- 400: 음성 파일 없음 또는 손상
- 502: STT 처리 실패
- 503: Whisper API 연결 실패

**사용 사례**:
- 번역 메뉴에서 원문 음성 입력
- 모바일 환경에서 SpeechRecognition 약한 경우 대체
- 순수 STT 기능 필요 시

---

### 4.3 데이터 모델

#### UserMessage (사용자 메시지)
```json
{
  "messageId": "msg_20260921_001",
  "sessionId": "sess_user_12345",
  "timestamp": "2026-09-21T10:30:00Z",
  "type": "audio" | "text",
  "content": "string (음성의 경우 base64)",
  "practiceLang": "ko" | "en" | "ja",
  "scenarioId": "free" | "cafe" | "hotel" | "business" | "doctor"
}
```

#### AIReply (AI 답변)
```json
{
  "replyId": "reply_20260921_001",
  "messageId": "msg_20260921_001",
  "text": "AI 답변 텍스트",
  "audioUrl": "https://...",
  "confidence": 0.95,
  "tokens": {
    "input": 45,
    "output": 89,
    "total": 134
  },
  "feedback": {
    "pronunciation": 0.88,
    "grammar": 0.92,
    "fluency": 0.85
  }
}
```

#### ConversationSession (대화 세션)
```json
{
  "sessionId": "sess_user_12345",
  "userId": "user_12345",
  "startedAt": "2026-09-21T10:00:00Z",
  "endedAt": "2026-09-21T10:15:00Z",
  "practiceLang": "ko",
  "scenarioId": "cafe",
  "messages": ["msg_001", "msg_002", ...],
  "totalTokens": 1234,
  "duration": 900,
  "avgAccuracy": 0.89
}
```

#### LearningProfile (학습 프로필)
```json
{
  "userId": "user_12345",
  "totalSessions": 45,
  "totalLearningTime": 43200,
  "languages": {
    "ko": { sessions: 20, hours: 15 },
    "en": { sessions: 15, hours: 12 },
    "ja": { sessions: 10, hours: 8 }
  },
  "scenarios": {
    "cafe": { count: 15, avgAccuracy: 0.88 },
    "hotel": { count: 12, avgAccuracy: 0.85 },
    "business": { count: 8, avgAccuracy: 0.82 }
  },
  "averageAccuracy": 0.85,
  "milestones": ["100_messages", "10_hours", "5_languages"]
}
```

---

### 4.4 에러 코드 정의

| 코드 | HTTP | 메시지 | 원인 | 해결책 |
|------|------|--------|------|-------|
| STT_001 | 400 | 음성이 비어있어요 | 음성 파일 없음 | 다시 녹음 후 전송 |
| STT_002 | 400 | 음성이 너무 길어요 | 파일 > 12MB | 더 짧은 음성 녹음 |
| STT_003 | 502 | 음성을 알아듣지 못했어요 | 인식 실패 | 명확하게 다시 말씀 |
| CHAT_001 | 400 | 메시지가 비어있어요 | 텍스트 입력 없음 | 텍스트 입력 |
| CHAT_002 | 400 | 메시지가 너무 길어요 | 메시지 > 2000자 | 짧게 작성 |
| CHAT_003 | 400 | 지원하지 않는 언어예요 | 잘못된 언어 코드 | ko, en, ja 중 선택 |
| API_001 | 503 | AI에 연결되지 않았어요 | API 서버 다운 | 잠시 후 재시도 |
| API_002 | 429 | AI 사용량이 부족해요 | 할당량 초과 | 나중에 재시도 |
| API_003 | 502 | 요청 형식이 올바르지 않아요 | 잘못된 요청 형식 | API 문서 확인 |

---

## 5. 시스템 아키텍처

### 5.1 전체 흐름도

```
┌─────────────────────────────────────────────────────────┐
│                    사용자 인터페이스                    │
│         (Svelte 컴포넌트: ConversationChatbot 등)       │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP (multipart/JSON)
                     │
┌────────────────────▼────────────────────────────────────┐
│              SvelteKit 서버 라우트                       │
│    (/api/talking/turn, /api/talking/reply, /api/stt)   │
└────┬──────────────┬─────────────────────┬───────────────┘
     │              │                     │
     │              │                     │
┌────▼──┐  ┌────────▼──────┐  ┌──────────▼────┐
│ Whisper│  │  GPT Chat    │  │  Text-to-Speech│
│  STT  │  │              │  │  (TTS)         │
└────┬──┘  └────────┬──────┘  └──────────┬────┘
     │              │                     │
     └──────────────┼─────────────────────┘
                    │
        ┌───────────▼──────────┐
        │   OpenAI API 클라이언트 │
        │  (with error handling)  │
        └───────────┬──────────┘
                    │
        ┌───────────▼──────────┐
        │    OpenAI 서비스      │
        │ (Whisper, GPT, TTS)   │
        └───────────────────────┘
```

### 5.2 주요 컴포넌트

#### Frontend Components
- **ConversationChatbot.svelte**: 메인 대화 인터페이스
  - 음성 녹음 UI
  - 메시지 표시
  - 실시간 피드백 표시

- **VoiceRecorder.svelte**: 음성 녹음 제어
  - 녹음 시작/중지
  - 음성 레벨 표시
  - 파일 업로드

- **ConversationStudy.svelte**: 학습 모드
  - 시나리오 선택
  - 난이도 조절
  - 진도 추적

- **DebugPanel.svelte**: 개발자 도구
  - API 호출 로그
  - 토큰 사용량
  - 에러 추적

#### Backend Services
- **talking.js**: 핵심 회화 로직
  - `generateTalkingReply()`: 대화 응답 생성
  - `transcribeTalkingAudio()`: 음성 → 텍스트
  - `transcribeAudio()`: 순수 STT

- **openai.js**: OpenAI API 클라이언트
  - API 키 관리
  - 에러 처리
  - 재시도 로직

- **Server Routes**:
  - `/api/talking/turn`: 음성 + 회화 통합
  - `/api/talking/reply`: 텍스트 기반 답변
  - `/api/stt`: 순수 음성 인식

---

## 6. 성능 지표 (KPI)

| 지표 | 목표값 | 설명 |
|------|-------|------|
| **음성 인식 정확도** | >90% | Whisper STT 정확도 |
| **응답 생성 시간** | <1초 | 사용자 음성 후 AI 응답까지 |
| **API 응답 시간** | <500ms | GPT 응답 생성 시간 |
| **시스템 가용성** | >99.5% | 서비스 운영 시간 |
| **에러율** | <2% | 처리 실패 비율 |
| **사용자 만족도** | >4.3/5.0 | 사용자 평가 점수 |
| **월별 활성 사용자** | 지속 증가 | MAU (Monthly Active Users) |
| **일일 회화 세션** | 1000+ | DAU 기준 평균 세션 수 |

---

## 7. 보안 및 데이터 보호

### 7.1 인증 & 인가
- 사용자 인증: 안전한 세션 관리
- API 토큰: 환경 변수에서 안전하게 관리
- 권한 검증: 사용자별 데이터 접근 제한

### 7.2 데이터 보호
- **전송**: HTTPS/TLS 1.3 이상 필수
- **저장**: 사용자 음성 데이터는 일시적으로만 저장 (처리 후 삭제)
- **개인정보**: 학습 기록은 암호화하여 저장
- **로깅**: 민감한 정보 마스킹 처리

### 7.3 API 보안
- **Rate Limiting**: 사용자/IP당 요청 수 제한
- **요청 검증**: 파일 크기, 형식, 언어 코드 검증
- **에러 처리**: 내부 에러 정보 노출 방지

### 7.4 감시 & 로깅
- 모든 API 호출 로깅
- 실패한 요청 상세 기록
- 정기적 로그 분석 및 감시

---

## 8. 향후 개선 방안

### 단기 (1-3개월)
- [ ] 추가 시나리오 확대 (레스토랑, 은행, 공항 등)
- [ ] 성과 분석 대시보드 고도화
- [ ] 사용자 피드백 시스템 강화
- [ ] 모바일 앱 최적화

### 중기 (3-6개월)
- [ ] 고급 발음 분석 기능
- [ ] 문법 오류 자동 교정
- [ ] 사용자 커뮤니티 기능 (대화 공유, 순위표)
- [ ] 멀티 턴 대화 능력 강화

### 장기 (6개월+)
- [ ] 추가 언어 지원 (중국어, 스페인어 등)
- [ ] 음성 인식 정확도 97% 이상
- [ ] 개인별 AI 튜터 시스템
- [ ] 오프라인 모드 지원
- [ ] 음성 비교 및 분석 (표준 발음과의 비교)

---

## 9. 개발 주의사항

### 9.1 OpenAI API 비용 관리
```javascript
// 각 API 호출 시 토큰 수 추적
const { reply, tokens } = await generateTalkingReply(client, {...});

// 사용자에게 토큰 비용 정보 제공
// 월별 할당량 모니터링
```

### 9.2 파일 크기 제한
```javascript
// 12MB 이상 파일은 거절
if (audio.size > 12 * 1024 * 1024) {
  return json({ error: '음성이 너무 길어요' }, { status: 400 });
}
```

### 9.3 에러 메시지 설계
```javascript
// 사용자 친화적 메시지
if (lower.includes('quota') || lower.includes('credit')) {
  error = 'AI 사용량이 부족해요. 잠시 후 다시 시도해 주세요';
}
```

### 9.4 언어 코드 검증
```javascript
// 지원 언어만 허용
if (!['ko', 'en', 'ja'].includes(practiceLang)) {
  return json({ error: '지원하지 않는 연습 언어예요' }, { status: 400 });
}
```

---

## 10. 배포 및 운영

### 10.1 배포 환경
- **플랫폼**: Vercel
- **자동 배포**: GitHub 연동
- **환경 변수**: `.env` 파일에서 관리
- **모니터링**: Vercel Analytics

### 10.2 환경 설정
```bash
# .env.example
OPENAI_API_KEY=sk_...
VITE_API_BASE_URL=https://my-speak-ai.vercel.app

# .env (실제 운영)
# 위의 값들을 Vercel 대시보드에서 설정
```

### 10.3 성능 최적화
- [x] 번들 크기 최소화 (Vite 최적화)
- [x] 이미지 최적화
- [ ] API 응답 캐싱 (적절한 범위 내에서)
- [ ] 미리 로드 (prefetching) 전략

### 10.4 모니터링
- OpenAI API 사용량 모니터링
- 에러 발생률 추적
- 사용자 세션 분석
- 성능 메트릭 수집

---

## 11. 기술 부채 및 개선 사항

### 11.1 현재 구현
- [x] STT (Whisper)
- [x] Chat (GPT)
- [x] TTS 지원 계획
- [x] 다국어 지원 (한/영/일)
- [x] 시나리오 기반 학습

### 11.2 추가 필요 구현
- [ ] 사용자 프로필 저장소
- [ ] 학습 기록 데이터베이스
- [ ] 발음 점수 매기기 알고리즘
- [ ] 실시간 협력 학습 기능

---

**문서 작성일**: 2026-09-21  
**버전**: 1.0  
**상태**: 실제 프로젝트 기반 (Production)  
**기술 스택**: Svelte 5 + SvelteKit + OpenAI API + Vercel

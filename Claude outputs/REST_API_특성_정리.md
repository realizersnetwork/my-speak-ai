# REST API 특성 요약 정리

## 1. REST (Representational State Transfer) 란?
웹 기반의 자원(Resource)에 대해 **표준 HTTP 메서드**를 사용하여 CRUD 작업을 수행하는 아키텍처 스타일

---

## 2. REST API의 핵심 특성

### 2.1 자원(Resource) 기반 설계
**특징**: 모든 것을 "자원"으로 표현
```
예시:
- 사용자 자원: /users
- 특정 사용자: /users/123
- 사용자의 게시물: /users/123/posts
- 특정 게시물: /users/123/posts/456

❌ 잘못된 예 (동작 기반):
- /getUser
- /deletePost
- /createComment
```

**장점**:
- 직관적이고 명확한 구조
- URL만 봐도 어떤 자원을 다루는지 파악 가능
- 일관성 있는 API 설계

---

### 2.2 HTTP 메서드 활용
**표준 HTTP 메서드로 동작 표현**

| 메서드 | 목적 | 사용 예 | 멱등성 |
|--------|------|--------|--------|
| **GET** | 조회 | `GET /users/123` | ✅ 예 |
| **POST** | 생성 | `POST /users` | ❌ 아니오 |
| **PUT** | 전체 수정 | `PUT /users/123` | ✅ 예 |
| **PATCH** | 부분 수정 | `PATCH /users/123` | ❌ 보통 |
| **DELETE** | 삭제 | `DELETE /users/123` | ✅ 예 |

**멱등성(Idempotent)**: 같은 요청을 여러 번 해도 결과가 같음

```javascript
// ✅ 멱등성 O (GET)
GET /users/123  → 항상 같은 데이터 반환

// ✅ 멱등성 O (PUT)
PUT /users/123 { name: "John" }  → 여러 번 해도 같은 상태

// ❌ 멱등성 X (POST)
POST /users { name: "John" }  → 매번 새로운 사용자 생성
```

---

### 2.3 무상태성(Statelessness)
**특징**: 서버가 클라이언트 상태를 기억하지 않음

```javascript
// ❌ 상태가 있는 예 (REST 위반)
서버: "이전 요청으로 사용자를 로그인했음"
→ 계속 기억해야 함

// ✅ 무상태 예 (REST)
GET /users/123 + Authorization: Bearer token_xyz
→ 매 요청마다 인증 정보 포함
→ 서버는 상태를 저장하지 않음
```

**장점**:
- 서버 확장성 ↑ (상태 유지 불필요)
- 분산 시스템 구축 용이
- 캐싱 효율 증대

---

### 2.4 클라이언트-서버 분리
**특징**: 클라이언트와 서버의 독립적 진화

```
클라이언트 (웹, 모바일, 데스크톱)
    ↕ HTTP 통신
서버 (API 제공자)

각각 독립적으로 변경 가능
```

**장점**:
- 클라이언트 기술 변경해도 서버 영향 X
- 서버 구현 변경해도 클라이언트 영향 X
- 병렬 개발 용이

---

### 2.5 캐시 가능성(Cacheability)
**특징**: HTTP 캐싱 메커니즘 활용 가능

```javascript
// 캐시 가능한 응답
GET /users/123
Response Headers:
  Cache-Control: max-age=3600
  ETag: "abc123"
  Last-Modified: 2026-09-21

// 동일한 요청이 다시 오면
→ 캐시된 응답 반환 (서버 요청 X)
```

**효과**:
- 네트워크 트래픽 감소
- 응답 속도 향상
- 서버 부하 감소

---

### 2.6 균일 인터페이스(Uniform Interface)
**특징**: 모든 API가 일관된 방식으로 동작

```javascript
// 일관된 URI 패턴
GET    /users          → 목록 조회
POST   /users          → 생성
GET    /users/123      → 단건 조회
PUT    /users/123      → 수정
DELETE /users/123      → 삭제

// 모든 자원에 동일하게 적용
GET    /posts
POST   /posts
GET    /posts/456
PUT    /posts/456
DELETE /posts/456
```

**요소**:
- 자원 식별 (URI로 표현)
- 메시지를 통한 자원 조작
- 자기 서술적 메시지 (HATEOAS)
- 애플리케이션 상태 엔진

---

### 2.7 계층화된 아키텍처(Layered Architecture)
**특징**: 중간 계층을 통한 통신

```
클라이언트
    ↓
로드 밸런서
    ↓
API 게이트웨이
    ↓
비즈니스 로직
    ↓
데이터베이스
    
각 계층은 독립적으로 동작
```

**장점**:
- 확장성 증대
- 보안 강화
- 시스템 성능 최적화

---

## 3. REST API 설계 원칙

### 3.1 명확한 자원 표현
```javascript
// ✅ 좋은 예
GET /api/v1/users
GET /api/v1/users/123
GET /api/v1/users/123/posts

// ❌ 나쁜 예
GET /api/getUser
GET /api/user_detail
GET /api/posts_by_user
```

### 3.2 적절한 HTTP 상태 코드
```javascript
// 성공
200 OK       // 요청 성공, 응답 본문 있음
201 Created  // 자원 생성 성공
204 No Content // 성공, 응답 본문 없음

// 클라이언트 오류
400 Bad Request     // 요청 형식 오류
401 Unauthorized    // 인증 필요
403 Forbidden       // 권한 없음
404 Not Found       // 자원 없음

// 서버 오류
500 Internal Server Error  // 서버 오류
503 Service Unavailable    // 서비스 이용 불가
```

### 3.3 요청/응답 데이터 포맷
```javascript
// 요청
Content-Type: application/json
{
  "name": "John",
  "email": "john@example.com"
}

// 응답
Content-Type: application/json
{
  "id": 123,
  "name": "John",
  "email": "john@example.com",
  "created_at": "2026-09-21T10:30:00Z"
}
```

### 3.4 버전 관리
```javascript
// URL에 버전 포함
GET /api/v1/users      // v1 API
GET /api/v2/users      // v2 API (새로운 형식)

// 이전 클라이언트는 v1 사용 계속
// 새로운 클라이언트는 v2 사용
```

---

## 4. REST API 실제 예시

### MySpeak AI에서의 REST API

```javascript
// 1. 음성 기반 회화 (음성 파일 업로드)
POST /api/talking/turn
Content-Type: multipart/form-data
{
  audio: <음성 파일>,
  practiceLang: "ko",
  scenarioId: "cafe"
}
Response: 200 OK
{
  userText: "안녕하세요",
  reply: "안녕하세요! 뭘 도와드릴까요?"
}

// 2. 텍스트 기반 답변 (JSON 요청)
POST /api/talking/reply
Content-Type: application/json
{
  text: "커피 주세요",
  practiceLang: "ko",
  scenarioId: "cafe"
}
Response: 200 OK
{
  reply: "네, 커피 한 잔 맞나요?"
}

// 3. 음성 인식만 (순수 STT)
POST /api/stt
Content-Type: multipart/form-data
{
  audio: <음성 파일>,
  language: "ko"
}
Response: 200 OK
{
  text: "안녕하세요"
}

// 4. 학습 기록 조회
GET /api/users/123/learning-history
Response: 200 OK
{
  totalSessions: 45,
  totalLearningTime: 43200,
  averageAccuracy: 0.85
}

// 5. 사용자 프로필 수정
PUT /api/users/123
Content-Type: application/json
{
  name: "김철수",
  preferredLanguage: "ko"
}
Response: 200 OK
{
  id: 123,
  name: "김철수",
  updatedAt: "2026-09-21T10:35:00Z"
}

// 6. 학습 세션 삭제
DELETE /api/sessions/sess_001
Response: 204 No Content

// 7. 에러 처리
POST /api/talking/reply
{ text: "", practiceLang: "ko" }
Response: 400 Bad Request
{
  error: "메시지가 비어있어요"
}

POST /api/talking/turn (API 다운 상태)
Response: 503 Service Unavailable
{
  error: "AI에 연결되지 않았어요. 잠시 후 다시 시도해 주세요"
}
```

---

## 5. REST vs 다른 아키텍처

| 특성 | REST | GraphQL | RPC |
|------|------|---------|-----|
| **자원 표현** | URI로 표현 | 쿼리 언어 | 함수 호출 |
| **메서드** | HTTP 메서드 | 주로 POST | 함수명으로 동작 |
| **학습곡선** | 낮음 | 중간 | 낮음 |
| **캐싱** | 쉬움 | 어려움 | 어려움 |
| **과도한 데이터** | 발생 가능 | 없음 | 발생 가능 |
| **부족한 데이터** | 여러 요청 필요 | 한 번에 | 여러 요청 필요 |
| **표준화** | 높음 | 중간 | 낮음 |

---

## 6. REST API 최고의 실천법 (Best Practices)

### DO ✅
```javascript
// 1. 명확한 URI
GET /api/v1/users/123

// 2. 적절한 HTTP 메서드
PUT /api/users/123 (전체 수정)
PATCH /api/users/123 (부분 수정)

// 3. 상태 코드 명확히
201 Created (생성 성공)
204 No Content (삭제 성공)

// 4. 에러 응답 구조화
{
  "error": "Not Found",
  "message": "사용자를 찾을 수 없습니다",
  "code": "USER_NOT_FOUND"
}

// 5. 페이지네이션
GET /api/users?page=1&limit=10

// 6. 필터링
GET /api/users?language=ko&level=advanced

// 7. 정렬
GET /api/users?sort=created_at&order=desc
```

### DON'T ❌
```javascript
// 1. 동작을 URI에 포함
GET /api/getUser
POST /api/deleteUser

// 2. 복잡한 쿼리 스트링
GET /api/getUsersByLanguageAndLevel?lang=ko&lv=3

// 3. 일관성 없는 응답 형식
{ data: {...} }   // 어떤 API는
{ user: {...} }   // 다르게 반환

// 4. 과도한 데이터
GET /api/users/123 
→ 모든 관계 데이터까지 반환 (clients에서 필요한 것만 요청)

// 5. 버전 없이 변경
→ 기존 클라이언트 깨짐
```

---

## 7. REST API 성숙도 모델 (Richardson Maturity Model)

```
Level 0: HTTP 사용 (RPC)
→ POST /service { "method": "getUser", "id": 123 }

Level 1: 자원 도입
→ GET /users/123

Level 2: HTTP 메서드 활용
→ GET /users/123, POST /users, DELETE /users/123

Level 3: HATEOAS (하이퍼미디어)
→ 응답에 다음 액션 링크 포함
{
  "id": 123,
  "name": "John",
  "_links": {
    "self": { "href": "/users/123" },
    "all": { "href": "/users" },
    "delete": { "href": "/users/123", "method": "DELETE" }
  }
}

✨ Level 3가 진정한 REST API
```

---

## 8. 요약 체크리스트

REST API 설계할 때 확인할 사항:

- [ ] **자원 기반**: 모든 엔드포인트가 자원을 표현하는가?
- [ ] **HTTP 메서드**: GET, POST, PUT, DELETE를 올바르게 사용하는가?
- [ ] **무상태**: 각 요청이 독립적인가?
- [ ] **상태 코드**: 적절한 HTTP 상태 코드를 반환하는가?
- [ ] **에러 처리**: 명확한 에러 메시지를 제공하는가?
- [ ] **버전 관리**: API 버전을 명시하는가?
- [ ] **문서화**: 모든 엔드포인트를 문서화했는가?
- [ ] **캐싱**: 캐시 가능한 요청에 헤더를 설정했는가?
- [ ] **일관성**: 모든 API가 같은 구조인가?
- [ ] **보안**: 인증/인가를 구현했는가?

---

**문서 작성일**: 2026-09-21  
**대상**: REST API 학습자 및 개발자

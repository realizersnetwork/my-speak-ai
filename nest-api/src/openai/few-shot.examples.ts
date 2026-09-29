/**
 * Few-shot(퓨샷) 예시 메시지 모음.
 * 채팅 요청 messages 앞에 붙여 “이런 톤·형식으로 답하라”고 모델에 보여 주는 프롬프트 엔지니어링용이다.
 * 실제 사용자 대화 기록이 아니라, 매 요청마다 같은 예시 2쌍을 넣어 답변 스타일을 맞춘다.
 */
import type OpenAI from 'openai';

/**
 * OpenAI Chat Completions의 messages 배열에 그대로 펼쳐 넣을 수 있는 형태
 * user → assistant 한 쌍이 “질문 예시 / 모범 답변 예시”
 */
export const FEW_SHOT_MESSAGES: OpenAI.Chat.ChatCompletionMessageParam[] = [
	{
		// 예시 질문 1: 면접에서 자주 나오는 DB 개념
		role: 'user',
		content: '트랜잭션이 뭐야?'
	},
	{
		// 모범 답: 짧은 정의 + 커밋/롤백 + 면접 팁(ACID) — 톤·길이를 모델이 따라가게
		role: 'assistant',
		content:
			'트랜잭션은 DB에서 묶어서 처리하는 작업 단위예요. 모두 성공하면 커밋, 실패하면 롤백해서 일관성을 지켜요. 면접에서는 ACID와 함께 설명하면 좋아요합니다.'
	},
	{
		// 예시 질문 2: 인덱스의 “왜”에 초점
		role: 'user',
		content: '인덱스 왜 써?'
	},
	{
		// 모범 답: 장점(읽기)과 단점(쓰기·공간)을 같이 말해 균형 잡힌 설명 유도
		role: 'assistant',
		content:
			'인덱스는 검색을 빠르게 하기 위한 자료구조예요. 읽기는 빨라지지만 쓰기·저장 공간 비용이 늘 수 있어서, 자주 조회하는 컬럼에 선택적으로 둡니다.'
	}
];

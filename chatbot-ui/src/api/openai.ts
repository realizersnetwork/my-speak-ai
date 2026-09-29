/**
 * Nest OpenAI 관련 HTTP 클라이언트.
 * - askChatbot: POST /openai/chat (일반 Q&A)
 * - toNetworkErrorMessage: Axios 오류 → 쉬운 한글 안내
 */
import axios, { AxiosError, isAxiosError } from 'axios';
import type { RequestDTO } from '../dto/openai/requestDto';
import type { ResponseDTO } from '../dto/openai/responseDto';

/**
 * Nest 서버 주소.
 * Vite는 VITE_ 로 시작하는 env만 브라우저에 노출함.
 * 없으면 로컬 개발 기본값 http://localhost:3000
 */
const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * 재사용하는 Axios 인스턴스.
 * - baseURL: 위 Nest 주소
 * - timeout 60000(60초): AI 답이 늦을 수 있어 짧게 끊지 않음
 * - Content-Type JSON: 본문을 JSON으로 보낸다고 서버에 알림
 */
const client = axios.create({
	baseURL,
	timeout: 60000,
	headers: { 'Content-Type': 'application/json' }
});

/**
 * Nest POST /openai/chat
 * 입력: RequestDTO (content + conversationId)
 * 출력: ResponseDTO (봇 답 + 캐시/RAG 등)
 * conversationId로 서버가 Redis(또는 메모리) 문맥을 이어 붙임
 */
export async function askChatbot(body: RequestDTO): Promise<ResponseDTO> {
	const { data } = await client.post<ResponseDTO | string>('/openai/chat', body);
	// 구버전 호환: 예전 서버가 문자열만 주면 content로 감싸서 통일
	if (typeof data === 'string') return { content: data };
	return {
		content: data?.content ?? '',
		tokens: data?.tokens,
		cache: data?.cache,
		ragSources: data?.ragSources,
		usage: data?.usage
	};
}

/**
 * 네트워크·HTTP 오류 → 사용자에게 보여줄 짧은 한글 문구.
 * (과제: Axios 네트워크 에러 처리)
 *
 * 왜 필요한가: Axios 원문 에러는 영어·기술적이라
 * 초보 사용자가 “서버가 꺼졌는지 / 시간이 초과됐는지”를 바로 알기 어렵기 때문
 */
export function toNetworkErrorMessage(err: unknown): string {
	// Axios가 아닌 일반 Error 등
	if (!isAxiosError(err)) {
		return '알 수 없는 오류가 발생했어요. 다시 시도해 주세요';
	}
	const ax = err as AxiosError<{ message?: string | string[] }>;
	// 타임아웃(60초) 초과
	if (ax.code === 'ECONNABORTED') {
		return '응답 시간이 초과됐어요. 잠시 후 다시 시도해 주세요';
	}
	// 서버에 아예 연결 실패 (Nest 미실행, CORS, 네트워크 끊김 등)
	if (ax.code === 'ERR_NETWORK' || !ax.response) {
		return '서버에 연결할 수 없어요. Nest 서버(localhost:3000)가 켜져 있는지 확인해 주세요';
	}
	const status = ax.response.status;
	const body = ax.response.data;
	// Nest ValidationPipe 등은 message가 배열일 수 있어 한 줄로 합침
	const serverMsg = Array.isArray(body?.message)
		? body.message.join(', ')
		: typeof body?.message === 'string'
			? body.message
			: '';

	// 503: 보통 API 키 없음·OpenAI 준비 안 됨
	if (status === 503) return serverMsg || 'AI 서비스가 준비되지 않았어요 (API 키 확인)';
	// 400: 요청 body가 DTO 규칙을 어김
	if (status === 400) return serverMsg || '요청 형식이 올바르지 않아요';
	// 5xx: 서버 내부 오류
	if (status >= 500) return serverMsg || '서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요';
	// 그 외 상태 코드
	return serverMsg || `요청에 실패했어요 (${status})`;
}

/**
 * Vite가 브라우저에 넘겨 주는 환경 변수 타입 선언.
 * TypeScript가 import.meta.env.VITE_API_URL 을 안전하게 쓰게 해 줍니다.
 */
/// <reference types="vite/client" />

interface ImportMetaEnv {
	/**
	 * Nest 서버 주소 (예: http://localhost:3000).
	 * .env 에 VITE_API_URL=... 로 넣고, 없으면 코드에서 localhost:3000 기본값 사용
	 */
	readonly VITE_API_URL: string;
}

interface ImportMeta {
	/** Vite가 주입하는 env 묶음 — 위 ImportMetaEnv 필드들 */
	readonly env: ImportMetaEnv;
}

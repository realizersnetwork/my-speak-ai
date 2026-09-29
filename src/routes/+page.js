import { redirect } from '@sveltejs/kit';

/** 홈은 번역 서비스로 바로 이동 */
export function load() {
	throw redirect(307, '/translate');
}

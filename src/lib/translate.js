/**
 * translate.js — 브라우저에서 한·영·일 번역을 요청하는 클라이언트 헬퍼입니다.
 *
 * 무엇을 하나요?
 * - `/api/translate` 서버 프록시를 호출해 번역문을 받습니다.
 *
 * 왜 서버를 거치나요?
 * - 브라우저에서 Google 번역을 직접 부르면 CORS/차단이 잦습니다.
 * - MyMemory 같은 무료 API는 en→ja 때 "yoroshiku" 로마자를 자주 내서 쓰지 않습니다.
 *
 * ConversationStudy의 translateOne → 이 함수.
 */

/** @typedef {'ko' | 'en' | 'ja'} AppLang */

/**
 * from → to 번역. 같은 언어면 원문 그대로 반환(불필요한 네트워크 호출 없음).
 * @param {string} text
 * @param {AppLang} from 원문 언어
 * @param {AppLang} to 번역 결과 언어
 * @returns {Promise<string>}
 */
export async function translateText(text, from, to) {
	const cleaned = text?.trim();
	if (!cleaned) return '';
	if (from === to) return cleaned;

	const url =
		`/api/translate?from=${encodeURIComponent(from)}` +
		`&to=${encodeURIComponent(to)}` +
		`&text=${encodeURIComponent(cleaned)}`;

	const response = await fetch(url);
	if (!response.ok) {
		const msg = await response.text().catch(() => '');
		throw new Error(msg || `translate HTTP ${response.status}`);
	}

	const data = await response.json();
	const translated = typeof data?.text === 'string' ? data.text.trim() : '';
	if (!translated) throw new Error('Empty translation');
	return translated;
}

/**
 * GET /api/translate — 한·영·일 문장 번역 서버 프록시.
 *
 * 무엇을 하나요?
 * - 브라우저에서 Google 번역을 직접 부르면 CORS/차단이 자주 나서,
 *   서버가 대신 호출하고 { text: 번역문 }만 내려줍니다.
 *
 * 쿼리: ?from=ko&to=en&text=안녕
 * 왜 dict-chrome-ex를 먼저 쓰나요?
 * - 예전 gtx 엔드포인트는 IP 차단이 잦고, Chrome 사전 API가 한·일 품질이 더 나은 편입니다.
 */
import { error, json } from '@sveltejs/kit';

/** 앱 언어코드 → Google sl/tl에 넣는 코드(지금은 동일) */
/** @type {Record<string, string>} */
const CODE = { ko: 'ko', en: 'en', ja: 'ja' };

/**
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url }) {
	const text = (url.searchParams.get('text') ?? '').trim();
	const from = url.searchParams.get('from') ?? 'en';
	const to = url.searchParams.get('to') ?? 'ko';

	if (!text) error(400, 'text required');
	// 5000자: URL·남용 방지 (대화 한 턴보다 넉넉)
	if (text.length > 5000) error(400, 'text too long');
	if (!(from in CODE) || !(to in CODE)) error(400, 'unsupported lang');
	// 같은 언어면 왕복 호출 없이 원문 반환
	if (from === to) return json({ text });

	const translated = await translateViaGoogle(text, CODE[from], CODE[to]);
	if (!translated) error(502, 'empty translation');

	// 일본어인데 로마자만 오면 실패로 처리 (MyMemory식 쓰레기 결과 방지)
	if (to === 'ja' && isRomajiOnly(translated) && !isRomajiOnly(text)) {
		error(502, 'bad japanese translation');
	}

	return json({ text: translated });
}

/**
 * Google 번역 두 경로를 순서대로 시도.
 * @param {string} text 원문
 * @param {string} sl source language
 * @param {string} tl target language
 */
async function translateViaGoogle(text, sl, tl) {
	// 브라우저처럼 보이게 하는 UA — 일부 엔드포인트가 봇을 거절함
	const headers = {
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		Accept: 'application/json,text/plain,*/*'
	};

	// 1) Chrome 사전 엔드포인트 — 차단이 적고 일본어/한국어 품질이 좋음
	const chromeUrl =
		`https://clients5.google.com/translate_a/t?client=dict-chrome-ex` +
		`&sl=${sl}&tl=${tl}&q=${encodeURIComponent(text)}`;

	try {
		const res = await fetch(chromeUrl, { headers });
		if (res.ok) {
			const data = await res.json();
			const out = parseChromeTranslate(data);
			if (out) return out;
		}
	} catch {
		/* 다음 경로 시도 */
	}

	// 2) gtx 폴백 — 1번이 막히거나 형식이 이상할 때
	const gtxUrl =
		`https://translate.googleapis.com/translate_a/single?client=gtx&dt=t` +
		`&sl=${sl}&tl=${tl}&q=${encodeURIComponent(text)}`;

	try {
		const res = await fetch(gtxUrl, { headers });
		if (res.ok) {
			const data = await res.json();
			if (Array.isArray(data?.[0])) {
				const out = data[0]
					.map((/** @type {unknown[]} */ part) => (typeof part?.[0] === 'string' ? part[0] : ''))
					.join('')
					.trim();
				if (out) return out;
			}
		}
	} catch {
		/* 포기 → 빈 문자열 */
	}

	return '';
}

/**
 * Chrome 사전 API JSON에서 번역문만 꺼냄.
 * 형식이 버전에 따라 달라서 여러 경우를 처리합니다.
 * @param {unknown} data
 */
function parseChromeTranslate(data) {
	// 형식 예: ["번역문"] 또는 [["번역문","원문"]] 또는 [[["번역",...]]]
	if (typeof data === 'string') return data.trim();
	if (!Array.isArray(data) || data.length === 0) return '';

	const first = data[0];
	if (typeof first === 'string') return first.trim();
	if (Array.isArray(first)) {
		if (typeof first[0] === 'string') return first[0].trim();
		if (Array.isArray(first[0]) && typeof first[0][0] === 'string') {
			return data
				.map((/** @type {unknown} */ row) =>
					Array.isArray(row) && typeof row[0] === 'string' ? row[0] : ''
				)
				.join('')
				.trim();
		}
	}
	return '';
}

/**
 * 일본어 결과에 가나/한자가 없고 로마자(알파벳)만 있는지.
 * true면 “yoroshiku” 같은 가짜 일본어로 보고 상위에서 실패 처리.
 */
function isRomajiOnly(text) {
	const hasKanaOrKanji = /[\u3040-\u30ff\u4e00-\u9faf]/.test(text);
	const hasLatin = /[A-Za-z]/.test(text);
	return !hasKanaOrKanji && hasLatin;
}

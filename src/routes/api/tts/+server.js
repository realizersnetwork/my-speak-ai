/**
 * GET /api/tts — Google TTS 오디오를 서버에서 받아 브라우저에 그대로 전달.
 *
 * 무엇을 하나요?
 * - 클라이언트가 Google TTS를 직접 부르면 CORS·차단이 자주 나서,
 *   서버가 대신 받아 audio/mpeg 바이트를 프록시합니다.
 *
 * 쿼리: ?lang=en&text=hello
 * 누가 쓰나요?
 * - $lib/tts.js speakTts — 1순위 재생 경로.
 */
import { error } from '@sveltejs/kit';

/** 앱 언어 → Google tl 파라미터 */
/** @type {Record<string, string>} */
const TL = { ko: 'ko', en: 'en', ja: 'ja' };

/**
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url }) {
	const text = (url.searchParams.get('text') ?? '').trim();
	const lang = url.searchParams.get('lang') ?? 'en';

	if (!text) error(400, 'text required');
	// 180자: Google TTS URL·한 청크 길이 제한에 맞춤 (tts.js chunkText와 비슷)
	if (text.length > 180) error(400, 'text too long');
	if (!(lang in TL)) error(400, 'unsupported lang');

	const tl = TL[lang];
	const googleUrl =
		`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}` +
		`&q=${encodeURIComponent(text)}`;

	const upstream = await fetch(googleUrl, {
		headers: {
			// 서버 UA — 브라우저 직접 호출 시 막히는 경우를 우회
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
			Referer: 'https://translate.google.com/'
		}
	});

	if (!upstream.ok) {
		error(502, `upstream TTS failed (${upstream.status})`);
	}

	const bytes = await upstream.arrayBuffer();
	if (!bytes.byteLength) error(502, 'empty TTS audio');

	return new Response(bytes, {
		headers: {
			'Content-Type': upstream.headers.get('Content-Type') || 'audio/mpeg',
			// 하루 캐시: 같은 문장 반복 재생 시 서버·Google 부담 감소
			'Cache-Control': 'public, max-age=86400',
			// 개발·별도 origin에서도 오디오 fetch가 되게
			'Access-Control-Allow-Origin': '*'
		}
	});
}

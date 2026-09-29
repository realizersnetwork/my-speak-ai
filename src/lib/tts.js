/**
 * tts.js — 브라우저에서 “번역문/봇 답변을 해당 언어 발음으로 읽기”를 담당합니다.
 *
 * 재생 순위:
 * 1) 우리 서버 `/api/tts` 프록시 (Google 음성) → CORS/차단 우회, en/ja/ko 안정
 * 2) 브라우저 SpeechSynthesis 중 “그 언어 네이티브 보이스만” (콩글리시 방지)
 *
 * ConversationStudy의 speakText / ConversationChatbot이 이 모듈을 호출합니다.
 */

/** @typedef {'ko' | 'en' | 'ja'} AppLang */

/**
 * 언어별 TTS 설정.
 * - bcp47: SpeechSynthesis utter.lang / 보이스 매칭
 * - google: /api/tts?lang= 에 넘기는 짧은 코드
 * - prefixes: 보이스 lang이 이걸로 시작하면 “그 언어 보이스”로 인정
 */
const LANG = {
	ko: { bcp47: 'ko-KR', google: 'ko', prefixes: ['ko'] },
	en: { bcp47: 'en-US', google: 'en', prefixes: ['en'] },
	ja: { bcp47: 'ja-JP', google: 'ja', prefixes: ['ja'] }
};

/** 지금 재생 중인 HTMLAudioElement. stopTts에서 pause·비움 */
/** @type {HTMLAudioElement | null} */
let currentAudio = null;
/** true면 청크 루프를 더 이상 이어가지 않음(사용자가 멈춤/새 재생) */
let cancelled = false;
/** TTS 재생 중 여부 UI 콜백(있으면 true/false 알림) */
/** @type {((v: boolean) => void) | null} */
let speakingListener = null;

/** TTS 재생 중 여부 콜백 등록 (UI용) */
export function onTtsSpeakingChange(listener) {
	speakingListener = listener;
}

function setSpeaking(value) {
	speakingListener?.(value);
}

/** 재생 중인 프록시 오디오·로컬 SpeechSynthesis를 모두 멈춤 */
export function stopTts() {
	cancelled = true;
	if (currentAudio) {
		currentAudio.pause();
		currentAudio.src = '';
		currentAudio = null;
	}
	if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
	setSpeaking(false);
}

/**
 * 긴 문장을 TTS 길이 제한(~160자)에 맞게 문장 단위로 자름.
 * Google TTS URL·품질을 위해 한 번에 너무 길게 보내지 않음.
 * @param {string} text
 * @param {number} [maxLen=160]
 */
function chunkText(text, maxLen = 160) {
	const parts = text
		.split(/(?<=[.!?。！？\n])\s*/)
		.map((p) => p.trim())
		.filter(Boolean);
	/** @type {string[]} */
	const chunks = [];
	let buf = '';
	for (const part of parts.length ? parts : [text]) {
		if ((buf + ' ' + part).trim().length <= maxLen) {
			buf = (buf + ' ' + part).trim();
		} else {
			if (buf) chunks.push(buf);
			if (part.length <= maxLen) {
				buf = part;
			} else {
				// 문장 부호가 없는 초장문: 강제 슬라이스
				for (let i = 0; i < part.length; i += maxLen) {
					chunks.push(part.slice(i, i + maxLen));
				}
				buf = '';
			}
		}
	}
	if (buf) chunks.push(buf);
	return chunks.length ? chunks : [text.slice(0, maxLen)];
}

/** 우리 API 프록시 URL — 브라우저에서 Google 직접 호출이 막혀도 재생됨 */
function proxyTtsUrl(lang, text) {
	return `/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`;
}

/**
 * URL 오디오를 끝까지 재생(또는 실패 reject).
 * @param {string} url
 * @returns {Promise<void>}
 */
function playAudioUrl(url) {
	return new Promise((resolve, reject) => {
		const audio = new Audio();
		currentAudio = audio;
		audio.preload = 'auto';
		audio.onended = () => {
			if (currentAudio === audio) currentAudio = null;
			resolve();
		};
		audio.onerror = () => {
			if (currentAudio === audio) currentAudio = null;
			reject(new Error('TTS audio failed'));
		};
		audio.src = url;
		void audio.play().catch(reject);
	});
}

/**
 * 해당 언어 보이스만 고름. 다른 언어 보이스는 절대 쓰지 않음(한국어 보이스로 영어 읽기 금지).
 * natural/neural/google 등에 가산점, compact/legacy는 감점.
 * @param {AppLang} lang
 * @returns {SpeechSynthesisVoice | null}
 */
function pickNativeVoice(lang) {
	if (typeof speechSynthesis === 'undefined') return null;
	const cfg = LANG[lang];
	const voices = speechSynthesis.getVoices();
	const candidates = voices
		.filter((v) => cfg.prefixes.some((p) => v.lang.toLowerCase().startsWith(p)))
		.map((v) => {
			const name = v.name.toLowerCase();
			const code = v.lang.toLowerCase();
			let score = 0;
			if (code === cfg.bcp47.toLowerCase()) score += 100;
			else if (code.startsWith(cfg.prefixes[0])) score += 60;
			if (name.includes('natural') || name.includes('neural')) score += 50;
			if (name.includes('google')) score += 45;
			if (name.includes('microsoft') && (name.includes('online') || name.includes('natural')))
				score += 40;
			if (name.includes('enhanced') || name.includes('premium')) score += 25;
			if (name.includes('compact') || name.includes('legacy') || name.includes('desktop')) score -= 30;
			return { v, score };
		})
		.sort((a, b) => b.score - a.score);

	return candidates[0]?.v ?? null;
}

/**
 * 로컬 SpeechSynthesis — 네이티브 보이스가 있을 때만 (폴백).
 * @param {string} text
 * @param {AppLang} lang
 */
function speakLocalNative(text, lang) {
	return new Promise((resolve, reject) => {
		if (typeof speechSynthesis === 'undefined') {
			reject(new Error('No speechSynthesis'));
			return;
		}
		const voice = pickNativeVoice(lang);
		if (!voice) {
			reject(new Error('No native voice for ' + lang));
			return;
		}
		const utter = new SpeechSynthesisUtterance(text);
		utter.voice = voice;
		utter.lang = voice.lang || LANG[lang].bcp47;
		// 0.95: 약간 느리게 — 따라 말하기·듣기 연습에 편함
		utter.rate = 0.95;
		utter.onend = () => resolve();
		utter.onerror = () => reject(new Error('speechSynthesis error'));
		speechSynthesis.speak(utter);
	});
}

/**
 * 텍스트를 해당 언어 네이티브 발음으로 읽습니다.
 * @param {string} text
 * @param {AppLang} lang
 * @param {{ onStart?: () => void; onEnd?: () => void }} [hooks] UI 하이라이트용
 */
export async function speakTts(text, lang, hooks = {}) {
	const cleaned = text?.trim();
	if (!cleaned) return;

	stopTts();
	cancelled = false;
	hooks.onStart?.();
	setSpeaking(true);

	try {
		const chunks = chunkText(cleaned);
		for (const chunk of chunks) {
			if (cancelled) break;
			try {
				// 서버 프록시로 en/ja/ko 모두 재생 (브라우저 직접 Google 호출 X)
				await playAudioUrl(proxyTtsUrl(lang, chunk));
			} catch {
				if (cancelled) break;
				// 프록시 실패 시에만 같은 언어 로컬 보이스
				await speakLocalNative(chunk, lang);
			}
		}
	} catch {
		/* 재생 실패 — UI는 onEnd로 정리 */
	} finally {
		if (!cancelled) {
			hooks.onEnd?.();
			setSpeaking(false);
		}
		currentAudio = null;
	}
}

/**
 * 보이스 목록 미리 로드 (로컬 폴백용).
 * 일부 OS는 getVoices()가 비동기로 채워지므로 voiceschanged도 듣습니다.
 */
export function warmTtsVoices() {
	if (typeof speechSynthesis === 'undefined') return;
	speechSynthesis.getVoices();
	speechSynthesis.addEventListener('voiceschanged', () => {
		speechSynthesis.getVoices();
	});
}

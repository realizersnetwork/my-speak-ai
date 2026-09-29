/**
 * talking.js — Talking AI(회화 연습)의 “두뇌” 서버 로직입니다.
 *
 * 무엇을 하나요?
 * 1) 시나리오·연습 언어에 맞는 시스템 프롬프트를 만듭니다.
 * 2) Chat Completions로 짧은 회화 답변을 생성합니다.
 * 3) Whisper로 녹음을 글로 바꿉니다(STT).
 *
 * 연결 흐름(연결형):
 *   녹음 → transcribe* → 사용자 글 → generateTalkingReply → 봇 글 → (클라이언트 TTS)
 */

/** @typedef {'ko' | 'en' | 'ja'} AppLang */
/** @typedef {{ role: 'user' | 'bot'; text: string }} HistoryTurn */

/**
 * 프롬프트에 넣을 영어 언어 이름.
 * 모델에게 “Reply ONLY in Korean”처럼 명확히 지시하려고 영어명을 씀.
 */
const langNames = {
	ko: 'Korean',
	en: 'English',
	ja: 'Japanese'
};

/**
 * 시나리오별 역할 힌트(영어).
 * free=자유 대화, cafe=카페 주문, travel=여행(공항·호텔·길찾기).
 * 키가 없으면 scenarioLabel 또는 기본 문구를 씁니다.
 */
const scenarioHints = {
	free: 'Casual free conversation partner. Be friendly and ask follow-up questions.',
	cafe: 'You are a cafe barista taking orders and chatting lightly with the customer.',
	travel: 'You are a helpful travel assistant for airport, hotel, and directions situations.'
};

/**
 * Talking 시스템 프롬프트 문자열을 조립합니다.
 * - 짧은 구어체 1~3문장: 듣기·따라 말하기에 맞춤
 * - 마크다운/불릿 금지: TTS로 읽힐 때 “별표” 같은 잡음이 안 나오게
 * @param {{ practiceLang: AppLang; scenarioId: string; scenarioLabel?: string }} opts
 */
export function buildTalkingSystemPrompt(opts) {
	const lang = langNames[opts.practiceLang] ?? 'English';
	const scenario =
		scenarioHints[opts.scenarioId] ??
		opts.scenarioLabel ??
		'Friendly conversation practice partner.';

	return [
		'You are My Talking AI, a spoken language practice partner.',
		`Scenario: ${scenario}`,
		`Reply ONLY in ${lang}. Do not mix other languages in the main reply.`,
		'Keep each reply short: 1–3 spoken sentences, easy to hear and repeat.',
		'Stay in character for the scenario. Encourage the learner to keep talking.',
		'Do not use markdown, bullet lists, or stage directions.'
	].join('\n');
}

/**
 * 사용자 문장(+짧은 히스토리) → 봇 회화 답변.
 * @param {import('openai').default} client
 * @param {{
 *   practiceLang: AppLang;
 *   scenarioId: string;
 *   scenarioLabel?: string;
 *   userText: string;
 *   history?: HistoryTurn[];
 * }} input
 * @returns {Promise<{ reply: string; tokens: number }>}
 */
export async function generateTalkingReply(client, input) {
	// 최근 12턴만: 토큰·비용 절약. 너무 많으면 문맥은 늘지만 과금↑
	const history = (input.history ?? []).slice(-12);
	/** @type {import('openai').OpenAI.Chat.ChatCompletionMessageParam[]} */
	const messages = [
		{ role: 'system', content: buildTalkingSystemPrompt(input) },
		// UI의 bot → OpenAI assistant 역할로 맞춤
		...history.map((turn) => ({
			role: /** @type {'user' | 'assistant'} */ (turn.role === 'bot' ? 'assistant' : 'user'),
			content: turn.text
		})),
		{ role: 'user', content: input.userText }
	];

	const completion = await client.chat.completions.create({
		// gpt-4o-mini: 회화 연습에 충분하고 저렴·빠른 편
		model: 'gpt-4o-mini',
		// 0.7: 너무 기계적이지 않게, 너무 엉뚱하지 않게
		temperature: 0.7,
		// 220: 짧은 구어체 답변 상한(긴 에세이 방지)
		max_tokens: 220,
		messages
	});

	const reply = completion.choices[0]?.message?.content?.trim() ?? '';
	if (!reply) throw new Error('empty model reply');
	return {
		reply,
		/** 과금·디버그용 총 토큰(대략). 없으면 0 */
		tokens: completion.usage?.total_tokens ?? 0
	};
}

/**
 * Whisper STT. languageHint가 있으면 그 언어로 인식률↑, 없으면 자동 감지(번역 A↔B용).
 * @param {import('openai').default} client
 * @param {File | import('openai').Uploadable} file
 * @param {AppLang | undefined} [languageHint]
 */
export async function transcribeAudio(client, file, languageHint) {
	/** @type {import('openai').OpenAI.Audio.TranscriptionCreateParams} */
	const params = {
		file,
		// whisper-1: OpenAI 음성→텍스트 기본 모델
		model: 'whisper-1'
	};
	if (languageHint) params.language = languageHint;

	const result = await client.audio.transcriptions.create(params);
	const text = (result.text ?? '').trim();
	if (!text) throw new Error('empty transcription');
	return text;
}

/**
 * Talking 전용 STT — 연습 언어를 힌트로 고정해 인식률을 올립니다.
 * @param {import('openai').default} client
 * @param {File | import('openai').Uploadable} file
 * @param {AppLang} practiceLang
 */
export async function transcribeTalkingAudio(client, file, practiceLang) {
	// whisper-1: language 힌트로 연습 언어 인식률 ↑
	return transcribeAudio(client, file, practiceLang);
}

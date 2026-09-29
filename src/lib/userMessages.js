/**
 * userMessages.js — 화면에 보이는 짧은 실패·안내 문구 모음입니다.
 *
 * 무엇을 하나요?
 * - 번역 실패, 마이크 거부, 음성 인식 실패 등 상황별로 짧은 한국어 문장을 고릅니다.
 * - 같은 상황에서도 pick()으로 문구를 바꿔, 반복해서 보면 덜 딱딱하게 느껴지게 합니다.
 *
 * 규칙:
 * - 기술 용어·영문 에러 코드는 넣지 않음 (사용자는 “다시 말해 주세요”만 보면 됨)
 * - ConversationStudy / ConversationChatbot의 statusText에 바로 넣음
 */

/**
 * 목록에서 무작위로 하나 고름. 비어 있으면 첫 항목 안전장치.
 * @param {string[]} list
 */
function pick(list) {
	return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

/** 번역(My Translate) API·네트워크 실패 시 상태줄 */
export function failTranslate() {
	return pick([
		'번역에 실패했어요. 다시 말해 주세요',
		'잠깐 번역이 안 됐어요. 한 번 더요',
		'지금은 번역이 막혔어요. 다시 시도해 주세요',
		'번역 연결이 끊겼어요. 다시 보내 주세요'
	]);
}

/** Talking AI 답변 생성 실패 */
export function failTalkingReply() {
	return pick([
		'답변에 실패했어요. 다시 보내 주세요',
		'AI가 잠깐 멈췄어요. 다시 말해 주세요',
		'지금은 답하기 어려워요. 한 번 더요',
		'응답을 받지 못했어요. 다시 시도해 주세요'
	]);
}

/** 음성을 글자로 못 바꿨을 때(브라우저 STT·Whisper 둘 다 비었을 때 등) */
export function failSpeechRecognize() {
	return pick([
		'음성을 알아듣지 못했어요. 다시 말해 주세요',
		'잘 안 들렸어요. 조금 더 또박또박 말해 주세요',
		'인식이 안 됐어요. 한 번 더 부탁해요',
		'목소리가 짧거나 작았어요. 다시 말해 주세요'
	]);
}

/** 사용자가 마이크 권한을 거절했을 때 */
export function failMicDenied() {
	return pick([
		'마이크 권한을 허용해 주세요',
		'마이크 사용이 막혀 있어요. 설정에서 허용해 주세요',
		'마이크 권한이 필요해요'
	]);
}

/** getUserMedia는 있는데 연결·장치 오류 */
export function failMicConnect() {
	return pick([
		'마이크에 연결하지 못했어요',
		'마이크를 찾지 못했어요. 연결을 확인해 주세요',
		'마이크 준비가 안 됐어요. 다시 눌러 주세요'
	]);
}

/** HTTPS가 아니거나 getUserMedia 자체가 없을 때 — 글자 입력으로 유도 */
export function failMicUnavailable() {
	return pick([
		'이 환경에서는 마이크를 쓸 수 없어요',
		'마이크는 보안 연결(https)에서만 쓸 수 있어요',
		'지금은 마이크를 열 수 없어요. 글자로 입력해 주세요'
	]);
}

/** 브라우저 SpeechRecognition 미지원(구형·일부 모바일) */
export function failSttUnsupported() {
	return pick([
		'이 브라우저는 음성 인식이 약해요. Chrome을 써 주세요',
		'음성 인식이 지원되지 않아요. 글자로 입력해 주세요',
		'말하기는 Chrome에서 더 잘 돼요'
	]);
}

/** localStorage 대화 기록 파싱 실패 */
export function failLoadHistory() {
	return pick([
		'이전 대화를 불러오지 못했어요',
		'저장된 기록을 읽지 못했어요',
		'대화 기록을 열 수 없어요'
	]);
}

/** Talking 시나리오 오프닝 멘트 생성 실패 */
export function failScenarioStart() {
	return pick([
		'시작 멘트를 만들지 못했어요',
		'상황을 준비하지 못했어요. 다시 눌러 주세요',
		'대화를 시작하지 못했어요. 한 번 더요'
	]);
}

/**
 * Talking/STT에서 API 키·결제(쿼터)·음성 실패를 구분해 안내.
 * raw 메시지에 키워드가 있으면 그에 맞는 사용자 문구로 바꿉니다.
 * @param {string} [raw] 서버·예외 원문(화면에 그대로 안 보여 줌)
 */
export function failTalkingQuotaOrKey(raw = '') {
	const t = String(raw).toLowerCase();
	if (t.includes('openai_api_key') || t.includes('api key') || t.includes('503')) {
		return pick([
			'AI 연결 설정이 필요해요. 잠시 후 다시 시도해 주세요',
			'지금은 AI에 연결되지 않았어요'
		]);
	}
	if (
		t.includes('quota') ||
		t.includes('credit') ||
		t.includes('billing') ||
		t.includes('429') ||
		t.includes('insufficient') ||
		t.includes('사용량')
	) {
		return pick([
			'AI 사용량이 부족해요. 잠시 후 다시 시도해 주세요',
			'지금은 AI를 쓸 수 없어요. 나중에 다시 말해 주세요'
		]);
	}
	if (
		t.includes('audio') ||
		t.includes('transcription') ||
		t.includes('whisper') ||
		t.includes('음성') ||
		t.includes('알아듣지')
	) {
		return failSpeechRecognize();
	}
	if (t.includes('연결되지') || t.includes('연결 설정')) {
		return pick([
			'AI 연결 설정이 필요해요. 잠시 후 다시 시도해 주세요',
			'지금은 AI에 연결되지 않았어요'
		]);
	}
	return failTalkingReply();
}

/** 일반 네트워크·서버 도달 실패 */
export function failNetwork() {
	return pick([
		'연결이 불안정해요. 잠시 후 다시 시도해 주세요',
		'서버에 닿지 못했어요. 인터넷을 확인해 주세요',
		'잠시 후 다시 시도해 주세요'
	]);
}

/**
 * 고른 A/B 언어 쌍과 다른 글자로 말했을 때(resolveSpeaker가 null).
 * @param {string} langALabel
 * @param {string} langBLabel
 */
export function failWrongLangPair(langALabel, langBLabel) {
	return pick([
		`선택한 언어(${langALabel} / ${langBLabel})로 말해 주세요`,
		`${langALabel} 또는 ${langBLabel}로 말해 주세요`,
		'지금 고른 언어로만 말해 주세요'
	]);
}

/** A와 B에 같은 언어가 잡혀 번역이 의미 없을 때 */
export function failSameLang() {
	return pick([
		'양쪽 언어가 같아요. 언어를 바꿔 주세요',
		'서로 다른 언어를 골라 주세요',
		'같은 언어끼리는 번역할 수 없어요'
	]);
}

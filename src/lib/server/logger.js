/**
 * logger.js — 서버 콘솔에 “언제 / 어떤 수준 / 어느 API / 무슨 일”을 찍는 작은 로거입니다.
 *
 * 무엇을 하나요?
 * - info / warn / error 레벨로 같은 형식의 한 줄을 남깁니다.
 * - detail이 있으면 그다음에 객체·에러도 함께 출력합니다.
 *
 * 왜 쓰나요?
 * - stt·talking 같은 API가 실패했을 때, 브라우저 문구만으로는 원인을 못 봅니다.
 *   서버 터미널에서 태그(tag)로 어느 엔드포인트인지 바로 찾게 하려고 만듦.
 */

/**
 * 실제 console.* 호출.
 * @param {'info' | 'warn' | 'error'} level 심각도 — error는 console.error로 구분
 * @param {string} tag 어느 기능인지(예: 'stt', 'talking/reply')
 * @param {string} message 짧은 설명
 * @param {unknown} [detail] 선택: 에러 객체·추가 데이터
 */
function write(level, tag, message, detail) {
	// ISO 시각: 로그를 시간순으로 맞춰 볼 때 쓰기 좋음
	const stamp = new Date().toISOString();
	const line = `[${stamp}] [${level.toUpperCase()}] [${tag}] ${message}`;
	if (level === 'error') {
		if (detail !== undefined) console.error(line, detail);
		else console.error(line);
		return;
	}
	if (level === 'warn') {
		if (detail !== undefined) console.warn(line, detail);
		else console.warn(line);
		return;
	}
	if (detail !== undefined) console.log(line, detail);
	else console.log(line);
}

/** 바깥에서 쓰는 로거 객체 — write를 직접 호출하지 않고 레벨별 메서드만 씀 */
export const logger = {
	/** @param {string} tag @param {string} message @param {unknown} [detail] */
	info(tag, message, detail) {
		write('info', tag, message, detail);
	},
	/** @param {string} tag @param {string} message @param {unknown} [detail] */
	warn(tag, message, detail) {
		write('warn', tag, message, detail);
	},
	/** @param {string} tag @param {string} message @param {unknown} [detail] */
	error(tag, message, detail) {
		write('error', tag, message, detail);
	}
};

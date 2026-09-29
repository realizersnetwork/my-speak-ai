<!--
	ConversationStudy.svelte — “My Translate” 실시간 대화 번역 화면의 본체입니다.

	무엇을 하나요?
	- 두 사람(A/B)이 각자 언어로 말하면, 상대 언어로 번역한 말풍선을 쌓아 줍니다.
	- 마이크(브라우저 음성인식 + Whisper 녹음) 또는 글자 입력으로 한 턴을 만듭니다.
	- 날짜별로 localStorage에 저장하고, 말풍선을 크게 보거나 TTS로 들을 수 있습니다.

	왜 이 파일에 모아 두었나요?
	- /translate 페이지는 이 컴포넌트만 렌더합니다. UI·마이크·번역·저장이 한곳에 있어야
	  흐름(듣기 → 말 끝 → 번역 → 말풍선)을 따라가기 쉽습니다.
-->
<script>
	import { onDestroy, onMount, tick } from 'svelte';
	import { speakTts, stopTts, warmTtsVoices } from '$lib/tts.js';
	import { translateText } from '$lib/translate.js';
	import DebugPanel from '$lib/components/DebugPanel.svelte';
	import {
		failLoadHistory,
		failMicConnect,
		failMicDenied,
		failMicUnavailable,
		failSameLang,
		failSpeechRecognize,
		failTalkingQuotaOrKey,
		failTranslate,
		failWrongLangPair
	} from '$lib/userMessages.js';

	// localStorage에 날짜별 대화를 넣을 때 쓰는 열쇠 이름
	// v3: 예전 카드형(v1/v2)과 구분 — 불러올 때 형식이 다르면 깨지지 않게
	const storageKey = 'my-speak-ai-live-translation-v3';
	// 말이 들린 뒤, 이 시간(밀리초) 동안 음량이 계속 작으면 “말 끝”으로 보고 듣기를 멈춤
	// 3000 = 약 3초 — 너무 짧으면 숨 쉴 때 끊기고, 너무 길면 다음 말이 늦어짐
	const silenceMs = 3000;
	// RMS(평균 음량)가 이 값보다 크면 “소리 있음”으로 봄
	// 0.025: 숨소리·아주 작은 잡음은 무시하고, 말소리는 잡히게 잡은 값
	const loudThreshold = 0.025;

	/** @typedef {'ko' | 'en' | 'ja'} AppLang */
	/** @typedef {'a' | 'b'} Speaker */
	/**
	 * 대화 한 턴(말풍선 하나).
	 * - speaker: 왼쪽(A) / 오른쪽(B) 누가 말했는지 → 말풍선 위치·색
	 * - source: 화자가 말한 원문 (말풍선 아래 작게)
	 * - target: 상대방 언어로 번역된 문장 (말풍선에 크게 표시)
	 * - createdAt: 만든 시각(ms) — 정렬·TTS·확대 보기 키로도 씀
	 */
	/** @typedef {{ speaker: Speaker; source: string; sourceLang: AppLang; target: string; targetLang: AppLang; createdAt: number }} ChatMessage */

	// 화면 라벨 / 브라우저 음성인식 코드 / API에 넘길 짧은 코드
	// speech: SpeechRecognition.lang 에 넣는 BCP-47 (예: ko-KR)
	// api: /api/translate·/api/stt 에 넘기는 'ko'|'en'|'ja'
	const langMeta = {
		ko: { label: '한국어', speech: 'ko-KR', api: 'ko' },
		en: { label: 'English', speech: 'en-US', api: 'en' },
		ja: { label: '日本語', speech: 'ja-JP', api: 'ja' }
	};

	// 언어 선택 버튼·메뉴에 나열할 순서 (지원 언어 전체)
	const appLangs = /** @type {AppLang[]} */ (['ko', 'en', 'ja']);

	// 오늘 날짜 문자열 YYYY-MM-DD — “오늘 대화” 칸의 기본 키
	const today = new Date().toISOString().slice(0, 10);
	/** 날짜(또는 보관 세션 키) → 그날의 메시지 배열. 화면에 보이는 채팅의 원본 창고 */
	/** @type {Record<string, ChatMessage[]>} */
	let records = $state({});
	/** 지금 채팅 영역에 보여줄 날짜/세션. 바꾸면 말풍선 목록이 통째로 바뀜 */
	let selectedDate = $state(today);
	/** true면 마이크 듣는 중 — 빨간 마이크 버튼·상태문구가 “듣는 중”으로 바뀜 */
	let isListening = $state(false);
	/** true면 번역/음성인식 API 처리 중 — 입력·보내기·마이크를 막아 중복 요청 방지 */
	let isTranslating = $state(false);
	/** 마이크 옆·아래 상태 한 줄. 사용자에게 “지금 뭐 하는지/실패했는지”를 보여 줌 */
	let statusText = $state('한국어 ↔ English · 말하면 상대 언어로 보여요');
	/** true면 채팅 아래 “지난 대화” 목록 패널이 열림 */
	let showHistory = $state(false);
	/** 말이 들린 뒤 조용한 초(0~3). 상태문구에 “조용함 2/3초”처럼 표시 */
	let quietSeconds = $state(0);

	/**
	 * 대화 상대 A / B 가 쓰는 언어 (파파고 대화모드와 같음).
	 * A가 langA로 말하면 → B에게 langB 번역이 말풍선에 크게 뜸
	 * B가 langB로 말하면 → A에게 langA 번역
	 * 기본: A=한국어, B=영어 — 가장 흔한 연습 쌍
	 */
	/** @type {AppLang} */
	let langA = $state('ko');
	/** @type {AppLang} */
	let langB = $state('en');

	/**
	 * 화자 지정 모드(상단 칩).
	 * - 'auto': 글자(한글/가나/알파벳)로 A/B를 판별 — 성문인식보다 가볍고 확실함
	 * - 'a'|'b': 그 사람만 말하는 중으로 고정 (잘못 섞여 번역되는 것 방지)
	 * @type {'auto' | Speaker}
	 */
	let speakerMode = $state('auto');

	/** 아래 입력창에 직접 친 글. 보내면 비우고 한 턴 번역으로 들어감 */
	let manualText = $state('');
	/**
	 * 커스텀 언어 드롭다운이 열려 있는지.
	 * 네이티브 <select>는 Windows에서 흰 글씨 버그가 나서 버튼+목록으로 직접 만듦.
	 * null=닫힘, 'a'|'b'=그쪽 메뉴 열림
	 */
	/** @type {null | 'a' | 'b'} */
	let openLangMenu = $state(null);
	/** 채팅 스크롤 영역 DOM — 새 말풍선 후 맨 아래로 내리기 위해 보관 */
	/** @type {HTMLDivElement | undefined} */
	let chatScrollEl = $state();
	/** 지금 TTS로 읽는 메시지의 createdAt. null이면 재생 중 아님(UI 하이라이트용) */
	let speakingAt = $state(/** @type {number | null} */ (null));
	/** 말풍선을 탭했을 때 전체화면 확대 대상. null이면 확대 레이어 숨김 — 상대방이 멀리서 읽기 쉽게 */
	let focusedMessage = $state(/** @type {ChatMessage | null} */ (null));
	/** 개발 모드 DebugPanel에 보여줄 마지막 오류 문자열(사용자 문구와 별도) */
	let lastDebugError = $state('');

	/** 브라우저 SpeechRecognition 인스턴스. 듣는 중에만 살아 있음 */
	/** @type {SpeechRecognition | null} */
	let recognition = null;
	/** 이번 듣기 세션에서 확정된(isFinal) 인식 문장 누적 */
	let finalTranscript = '';
	/** true면 onend 후에도 인식을 다시 시작(연속 듣기). stopListening에서 false로 끔 */
	let keepListening = false;
	/** 이번 세션에서 말소리(또는 인식 글자)를 한 번이라도 들었는지 — 침묵 타이머 시작 조건 */
	let heardSound = false;
	/** 마지막으로 “소리 큼”이 감지된 시각(ms). silenceMs 계산에 사용 */
	let lastLoudAt = 0;
	/** auto 모드에서 A↔B 음성인식 언어를 번갈아 쓸 때 인덱스 */
	let speechCycleIndex = 0;
	/** auto 모드에서 글자 점수로 “이 언어다”가 정해지면 고정. stop 시 Whisper 힌트로도 넘김 */
	/** @type {AppLang | null} */
	let lockedSpeechLang = null;

	/** getUserMedia로 연 마이크 스트림. 끝나면 트랙 stop 필수(표시등 꺼짐) */
	/** @type {MediaStream | null} */
	let micStream = null;
	/** 음량(RMS) 측정용 Web Audio 컨텍스트 */
	/** @type {AudioContext | null} */
	let audioContext = null;
	/** 마이크 PCM을 읽어 loudThreshold와 비교하는 분석 노드 */
	/** @type {AnalyserNode | null} */
	let analyser = null;
	/** analyser에서 매 프레임 채우는 PCM 버퍼 */
	/** @type {Float32Array | null} */
	let pcmData = null;
	/** requestAnimationFrame id — 침묵 감시 루프. stop 시 cancel */
	/** @type {number | null} */
	let monitorRaf = null;
	/** SpeechRecognition이 끊긴 뒤 짧게 기다렸다가 재시작할 타이머 */
	/** @type {ReturnType<typeof setTimeout> | null} */
	let restartTimer = null;
	/** Whisper(/api/stt)용 녹음기 — 모바일에서 브라우저 STT가 약할 때 대비 */
	/** @type {MediaRecorder | null} */
	let mediaRecorder = null;
	/** MediaRecorder가 만든 오디오 조각들 → stop 시 하나의 Blob으로 합침 */
	/** @type {Blob[]} */
	let recordedChunks = [];

	/** 선택된 날짜의 메시지를 오래된→최신 순으로 정렬 — 채팅처럼 아래에서 이어지게 */
	let messages = $derived(
		[...(records[selectedDate] ?? [])].sort((a, b) => a.createdAt - b.createdAt)
	);
	/** 지난 대화 패널에 보여줄 날짜 키 목록(최신 날짜가 위) */
	let historyDates = $derived(Object.keys(records).sort((a, b) => b.localeCompare(a)));

	/**
	 * 개발 모드에서만 DebugPanel에 찍는 상태 줄들.
	 * 사용자 화면에는 안 보이고, 마이크/보안/STT 지원 여부를 한눈에 보려고 만듦.
	 */
	let debugLines = $derived.by(() => {
		if (!import.meta.env.DEV) return [];
		const secure =
			typeof window !== 'undefined'
				? window.isSecureContext
					? 'secure'
					: 'insecure(http)'
				: '?';
		const mic =
			typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia
				? 'mic:ok'
				: 'mic:없음';
		const stt =
			typeof window !== 'undefined' &&
			(window.SpeechRecognition || window.webkitSpeechRecognition)
				? 'stt:ok'
				: 'stt:없음';
		return [
			`translate · ${langA}↔${langB} · speaker=${speakerMode}`,
			`listen=${isListening} translate=${isTranslating} quiet=${quietSeconds}s msgs=${messages.length}`,
			`${secure} · ${mic} · ${stt} · recorder=${mediaRecorder ? 'on' : 'off'}`,
			...(lastDebugError ? [`lastError: ${lastDebugError}`] : [])
		];
	});

	// 페이지를 떠날 때: 소리 재생·마이크를 끄고 권한/리소스 누수 방지
	onDestroy(() => {
		stopTts();
		void stopListening(false);
	});

	/**
	 * 예전 카드형 localStorage(v1/v2)를 지금 말풍선 형식으로 한 번만 변환.
	 * 새 키가 비어 있을 때만 호출되어, 업데이트 후에도 옛 기록이 안 사라지게 함.
	 */
	function migrateLegacy() {
		const legacyKeys = ['my-speak-ai-live-translation-v2', 'my-speak-ai-live-translation'];
		for (const key of legacyKeys) {
			const raw = localStorage.getItem(key);
			if (!raw) continue;
			try {
				const old = JSON.parse(raw);
				/** @type {Record<string, ChatMessage[]>} */
				const migrated = {};
				for (const [date, items] of Object.entries(old)) {
					migrated[date] = /** @type {any[]} */ (items).map((item) => {
						const sourceLang = /** @type {AppLang} */ (item.sourceLang ?? 'ko');
						const line = item.translations?.[0];
						const targetLang = /** @type {AppLang} */ (line?.lang ?? item.targetLang ?? 'en');
						const target = line?.text ?? item.target ?? '';
						return {
							speaker: sourceLang === langB ? 'b' : 'a',
							source: item.source,
							sourceLang,
							target,
							targetLang,
							createdAt: item.createdAt
						};
					});
				}
				records = migrated;
				localStorage.setItem(storageKey, JSON.stringify(records));
				return;
			} catch {
				/* 깨진 JSON이면 다음 예전 키 시도 */
			}
		}
	}

	/**
	 * 오늘(또는 선택된 날짜) 메시지 배열을 records에 반영하고 localStorage에 즉시 저장.
	 * @param {ChatMessage[]} nextMessages
	 */
	function save(nextMessages) {
		records = { ...records, [selectedDate]: nextMessages };
		localStorage.setItem(storageKey, JSON.stringify(records));
	}

	/** DOM이 새 말풍선을 그린 뒤(tick) 스크롤을 맨 아래로 — 최신 말이 보이게 */
	async function scrollChatToBottom() {
		await tick();
		if (chatScrollEl) chatScrollEl.scrollTop = chatScrollEl.scrollHeight;
	}

	/**
	 * 번역문을 해당 언어 네이티브 TTS로 재생 (한국어 보이스로 영어 읽는 “콩글리시” 방지).
	 * @param {string} text 읽을 문장(보통 target)
	 * @param {AppLang} lang 그 문장의 언어
	 * @param {number} [createdAt] 재생 중 표시용 메시지 id
	 */
	function speakText(text, lang, createdAt) {
		void speakTts(text, lang, {
			onStart: () => {
				speakingAt = createdAt ?? null;
			},
			onEnd: () => {
				speakingAt = null;
			}
		});
	}

	/** 말풍선 탭 → 전체화면 확대. 상대방이 멀리서도 읽기 쉽게 */
	/** @param {ChatMessage} item */
	function openFocus(item) {
		focusedMessage = item;
	}

	/** 확대 레이어 닫기(배경 탭·Esc·닫기 버튼) */
	function closeFocus() {
		focusedMessage = null;
	}

	/** 확대 화면이 열린 동안 Esc로 닫기 */
	function onFocusKeydown(event) {
		if (event.key === 'Escape' && focusedMessage) closeFocus();
	}

	// 첫 화면 진입: TTS 보이스 목록 미리 로드 + 저장된 대화 불러오기
	onMount(() => {
		warmTtsVoices();
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				records = JSON.parse(saved);
			} else {
				migrateLegacy();
			}
		} catch {
			statusText = failLoadHistory();
		}
	});

	/**
	 * 선택 쌍(langA/langB) 안에서의 “이 언어 글자가 얼마나 많은지” 점수만 계산.
	 * 예: 일본어↔영어인데 한글이 와도 한국어로 번역하지 않음(쌍 밖 언어는 점수 0).
	 * 가중치: 한글×2, 가나×3+한자, 알파벳×2 — 짧은 문장에서도 방향이 잘 나오게.
	 * @param {string} text
	 * @param {AppLang} lang
	 */
	function scriptScore(text, lang) {
		const hangul = (text.match(/[\uac00-\ud7a3]/g) || []).length;
		const kana = (text.match(/[\u3040-\u30ff]/g) || []).length;
		const kanji = (text.match(/[\u4e00-\u9faf]/g) || []).length;
		const latin = (text.match(/[A-Za-z]/g) || []).length;
		if (lang === 'ko') return hangul * 2;
		if (lang === 'ja') return kana * 3 + kanji;
		if (lang === 'en') return latin * 2;
		return 0;
	}

	/**
	 * 문장 → 누가 말했는지(speaker) + 번역 방향(sourceLang→targetLang).
	 * 반드시 화면에서 고른 langA ↔ langB 로만 방향을 정합니다.
	 * null이면 “고른 언어가 아님” → 잘못된 번역 대신 안내 문구.
	 * @param {string} text
	 * @returns {{ speaker: Speaker; sourceLang: AppLang; targetLang: AppLang } | null}
	 */
	function resolveSpeaker(text) {
		if (speakerMode === 'a' || speakerMode === 'b') {
			const sourceLang = speakerMode === 'a' ? langA : langB;
			const targetLang = speakerMode === 'a' ? langB : langA;
			// 고정 화자여도, 글자가 그 언어가 전혀 아니면 잘못된 번역을 막음
			if (scriptScore(text, sourceLang) === 0) {
				const other = scriptScore(text, targetLang);
				const hangul = (text.match(/[\uac00-\ud7a3]/g) || []).length;
				const latin = (text.match(/[A-Za-z]/g) || []).length;
				const kana = (text.match(/[\u3040-\u30ff]/g) || []).length;
				if (other > 0 || hangul > 0 || latin > 0 || kana > 0) {
					return null;
				}
			}
			return {
				speaker: speakerMode,
				sourceLang,
				targetLang
			};
		}

		const scoreA = scriptScore(text, langA);
		const scoreB = scriptScore(text, langB);

		// 선택 쌍 글자가 거의 없으면(예: ja↔en인데 한글만) 잘못된 ko|en 번역을 막음
		if (scoreA === 0 && scoreB === 0) {
			return null;
		}

		if (scoreB > scoreA) {
			return { speaker: 'b', sourceLang: langB, targetLang: langA };
		}
		return { speaker: 'a', sourceLang: langA, targetLang: langB };
	}

	/**
	 * /api/translate 프록시를 통해 from→to 한 문장 번역.
	 * @param {string} text
	 * @param {AppLang} from
	 * @param {AppLang} to
	 */
	async function translateOne(text, from, to) {
		return translateText(text, from, to);
	}

	/**
	 * 한 턴을 대화에 추가: 원문 + 상대 언어 번역 → 말풍선 저장·스크롤.
	 * 실패 시 statusText만 바꾸고, 이전 말풍선은 그대로 둠.
	 * @param {string} source 인식·입력된 원문
	 */
	async function addChatTurn(source) {
		isTranslating = true;
		statusText = '번역 중이에요…';
		try {
			const resolved = resolveSpeaker(source);
			if (!resolved) {
				statusText = failWrongLangPair(langMeta[langA].label, langMeta[langB].label);
				return;
			}

			const { speaker, sourceLang, targetLang } = resolved;
			if (sourceLang === targetLang) {
				statusText = failSameLang();
				return;
			}

			statusText = `${langMeta[sourceLang].label} → ${langMeta[targetLang].label}`;
			const target = await translateOne(source, sourceLang, targetLang);

			/** @type {ChatMessage} */
			const message = {
				speaker,
				source,
				sourceLang,
				target,
				targetLang,
				createdAt: Date.now()
			};

			save([...(records[selectedDate] ?? []), message]);
			statusText = describeLangPair();
			await scrollChatToBottom();
		} catch (err) {
			lastDebugError = err instanceof Error ? err.message : String(err);
			statusText = failTranslate();
		} finally {
			isTranslating = false;
		}
	}

	/**
	 * 현재 마이크 프레임의 RMS(루트 평균 제곱) 음량.
	 * 0에 가까우면 조용, loudThreshold 이상이면 “말하는 중”.
	 */
	function measureRms() {
		if (!analyser || !pcmData) return 0;
		analyser.getFloatTimeDomainData(pcmData);
		let sum = 0;
		for (let i = 0; i < pcmData.length; i++) {
			const sample = pcmData[i];
			sum += sample * sample;
		}
		return Math.sqrt(sum / pcmData.length);
	}

	/** 듣는 중 상태문구: 인식 미리보기 + “조용함 n/3초” 진행 표시 */
	function updateListeningStatus() {
		const preview = finalTranscript.trim();
		if (heardSound && quietSeconds > 0) {
			statusText = preview
				? `${preview} · 조용함 ${quietSeconds}/3초`
				: `듣고 있어요 · 조용함 ${quietSeconds}/3초`;
		} else {
			statusText = preview || '듣고 있어요 · 각자 언어로 말해 보세요';
		}
	}

	/**
	 * 매 프레임 음량을 보고, 말 들린 뒤 silenceMs 동안 조용하면 자동으로 듣기 종료→번역.
	 * keepListening이 false면 루프를 멈춤.
	 */
	function tickSilenceMonitor() {
		if (!keepListening) return;

		const rms = measureRms();
		const now = Date.now();

		if (rms >= loudThreshold) {
			heardSound = true;
			lastLoudAt = now;
			quietSeconds = 0;
		} else if (heardSound) {
			const quietFor = now - lastLoudAt;
			quietSeconds = Math.min(3, Math.floor(quietFor / 1000));
			if (quietFor >= silenceMs) {
				void stopListening(true);
				return;
			}
		}

		updateListeningStatus();
		monitorRaf = requestAnimationFrame(tickSilenceMonitor);
	}

	/**
	 * 마이크 권한·음량 감시·Whisper용 MediaRecorder를 한꺼번에 준비.
	 * echoCancellation/noiseSuppression: 스피커 울림·잡음을 줄여 침묵 판정이 덜 흔들리게.
	 */
	async function setupMicMonitor() {
		micStream = await navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: true, noiseSuppression: true }
		});
		audioContext = new AudioContext();
		// 일부 브라우저는 사용자 제스처 직후에도 suspended → resume 해야 분석이 돌아감
		if (audioContext.state === 'suspended') await audioContext.resume();
		analyser = audioContext.createAnalyser();
		// fftSize 2048: 음량 샘플 해상도. 클수록 정밀하지만 비용↑ — 침묵 감시에 충분
		analyser.fftSize = 2048;
		pcmData = new Float32Array(analyser.fftSize);
		audioContext.createMediaStreamSource(micStream).connect(analyser);

		// Whisper용 녹음 (브라우저 STT와 병행 — 모바일에서 SpeechRecognition이 약함)
		recordedChunks = [];
		mediaRecorder = null;
		// webm/opus 우선, 안 되면 mp4(iOS 계열), 둘 다 안 되면 브라우저 기본
		const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
			? 'audio/webm;codecs=opus'
			: MediaRecorder.isTypeSupported('audio/mp4')
				? 'audio/mp4'
				: '';
		try {
			mediaRecorder = mime
				? new MediaRecorder(micStream, { mimeType: mime })
				: new MediaRecorder(micStream);
			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) recordedChunks.push(event.data);
			};
			// 250ms마다 조각 — 끊어도 지금까지 말한 구간이 Blob에 남게
			mediaRecorder.start(250);
		} catch {
			mediaRecorder = null;
		}

		tickSilenceMonitor();
	}

	/**
	 * MediaRecorder를 멈추고 녹음 Blob을 돌려줌. 없으면 null.
	 * Whisper에 올리기 전에 호출 — 트랙 stop보다 먼저여야 파일이 완성됨.
	 * @returns {Promise<Blob | null>}
	 */
	function stopRecorder() {
		return new Promise((resolve) => {
			const recorder = mediaRecorder;
			mediaRecorder = null;
			if (!recorder || recorder.state === 'inactive') {
				resolve(null);
				return;
			}
			recorder.onstop = () => {
				const type = recorder.mimeType || 'audio/webm';
				const blob =
					recordedChunks.length > 0 ? new Blob(recordedChunks, { type }) : null;
				recordedChunks = [];
				resolve(blob && blob.size > 0 ? blob : null);
			};
			try {
				recorder.stop();
			} catch {
				recordedChunks = [];
				resolve(null);
			}
		});
	}

	/** SpeechRecognition 재시작 예약 타이머 취소 */
	function clearRestartTimer() {
		if (restartTimer !== null) {
			clearTimeout(restartTimer);
			restartTimer = null;
		}
	}

	/**
	 * 음량 감시 루프·AudioContext만 정리.
	 * 마이크 트랙은 recorder가 끝난 뒤 releaseMicStream에서 끊음(녹음 잘림 방지).
	 */
	function stopMicMonitor() {
		if (monitorRaf !== null) {
			cancelAnimationFrame(monitorRaf);
			monitorRaf = null;
		}
		void audioContext?.close().catch(() => {});
		audioContext = null;
		analyser = null;
		pcmData = null;
	}

	/** 마이크 하드웨어 트랙 stop — 브라우저 탭 녹음 표시등이 꺼짐 */
	function releaseMicStream() {
		micStream?.getTracks().forEach((track) => track.stop());
		micStream = null;
	}

	/** 음성인식에 쓸 언어 목록: A/B만 (두 사람 대화에 맞춤). 같으면 하나 */
	function speechLangs() {
		return langA === langB ? [langA] : [langA, langB];
	}

	/**
	 * 지금 SpeechRecognition.lang에 넣을 BCP-47 코드.
	 * 화자 고정 → 그 언어 / 글자로 잠금 → 그 언어 / 아니면 A↔B 순환.
	 */
	function currentSpeechCode() {
		if (speakerMode === 'a') return langMeta[langA].speech;
		if (speakerMode === 'b') return langMeta[langB].speech;
		if (lockedSpeechLang) return langMeta[lockedSpeechLang].speech;
		const cycle = speechLangs();
		return langMeta[cycle[speechCycleIndex % cycle.length]].speech;
	}

	/**
	 * SpeechRecognition 이벤트(결과·오류·종료)를 한 인스턴스에 연결.
	 * continuous+interim: 말하는 동안 미리보기를 상태줄에 보여 줌.
	 * @param {SpeechRecognition} instance
	 */
	function attachRecognitionHandlers(instance) {
		instance.lang = currentSpeechCode();
		instance.continuous = true;
		instance.interimResults = true;

		instance.onresult = (event) => {
			let interim = '';
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const piece = event.results[i][0].transcript;
				if (event.results[i].isFinal) finalTranscript += piece;
				else interim += piece;
			}
			heardSound = true;
			lastLoudAt = Date.now();
			quietSeconds = 0;

			const preview = `${finalTranscript}${interim}`.trim();
			if (preview) {
				// 선택 쌍 안에서만 인식 언어를 고정(다음 재시작·Whisper 힌트에 사용)
				if (speakerMode === 'auto') {
					const scoreA = scriptScore(preview, langA);
					const scoreB = scriptScore(preview, langB);
					if (scoreB > scoreA) lockedSpeechLang = langB;
					else if (scoreA > 0) lockedSpeechLang = langA;
				}
				statusText = preview;
			}
		};

		instance.onerror = (event) => {
			if (event.error === 'not-allowed') {
				keepListening = false;
				statusText = failMicDenied();
			}
		};

		// 브라우저는 중간중간 onend를 냄 → keepListening이면 짧게 쉬고 다시 start
		instance.onend = () => {
			if (!keepListening) return;
			clearRestartTimer();
			restartTimer = setTimeout(() => {
				if (!keepListening) return;
				// 아직 글자도 잠금도 없으면 다른 언어로 바꿔 재시도(자동 모드)
				if (speakerMode === 'auto' && !finalTranscript.trim() && !lockedSpeechLang) {
					speechCycleIndex += 1;
				}
				try {
					const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
					if (!SpeechRecognitionAPI) return;
					recognition = new SpeechRecognitionAPI();
					attachRecognitionHandlers(recognition);
					recognition.start();
				} catch {
					/* 다음 onend/타이머에서 다시 시도 */
				}
			}, 150); // 150ms: 너무 짧으면 즉시 충돌, 너무 길면 말 앞부분이 잘림
		};
	}

	/**
	 * Whisper(/api/stt)에 넘길 language 힌트.
	 * 화자가 고정돼 있으면 그 언어, auto면 잠긴 언어, 없으면 ''(서버가 자동 감지).
	 * @param {AppLang | null} [locked]
	 * @returns {AppLang | ''}
	 */
	function sttLanguageHint(locked = lockedSpeechLang) {
		if (speakerMode === 'a') return langA;
		if (speakerMode === 'b') return langB;
		if (locked) return locked;
		return '';
	}

	/**
	 * 녹음 Blob → POST /api/stt → Whisper 텍스트.
	 * language 폼 필드는 있을 때만 붙여 인식률을 올림.
	 * @param {Blob} audioBlob
	 * @param {AppLang | null} [langLocked]
	 */
	async function fetchTranscriptFromAudio(audioBlob, langLocked = null) {
		const form = new FormData();
		const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
		form.append('audio', audioBlob, `speech.${ext}`);
		const hint = sttLanguageHint(langLocked);
		if (hint) form.append('language', hint);

		const res = await fetch('/api/stt', { method: 'POST', body: form });
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			lastDebugError = `stt ${res.status}: ${data.error || 'fail'}`;
			throw new Error(data.error || 'stt failed');
		}
		lastDebugError = '';
		return /** @type {string} */ (data.text ?? '').trim();
	}

	/**
	 * 듣기 종료.
	 * @param {boolean} finishWithTranslation
	 *   true: 녹음/브라우저 STT 결과를 번역까지 진행(마이크 버튼·침묵 자동 종료)
	 *   false: 자원만 정리하고 번역하지 않음(페이지 떠남·새 대화)
	 */
	async function stopListening(finishWithTranslation) {
		keepListening = false;
		clearRestartTimer();
		stopMicMonitor();

		try {
			recognition?.stop();
		} catch {
			/* already stopped */
		}
		recognition = null;

		isListening = false;
		quietSeconds = 0;

		const browserText = finalTranscript.trim();
		finalTranscript = '';
		heardSound = false;
		lastLoudAt = 0;
		// stop 전에 잠긴 언어를 복사 — 아래에서 Whisper 힌트로 씀
		const langLockedAtStop = lockedSpeechLang;
		lockedSpeechLang = null;

		const audioBlob = await stopRecorder();
		releaseMicStream();

		if (!finishWithTranslation) {
			if (!isTranslating) statusText = describeLangPair();
			return;
		}

		// 1순위: 녹음 → Whisper (모바일에서 브라우저 STT가 자주 실패)
		if (audioBlob) {
			isTranslating = true;
			statusText = '음성 인식 중…';
			try {
				const text = await fetchTranscriptFromAudio(audioBlob, langLockedAtStop);
				isTranslating = false;
				if (text) {
					await addChatTurn(text);
					return;
				}
			} catch (err) {
				isTranslating = false;
				const msg = err instanceof Error ? err.message : '';
				lastDebugError = msg || 'stt failed';
				// Whisper 실패해도 브라우저 STT 문장이 있으면 그걸로 번역 시도
				if (browserText) {
					await addChatTurn(browserText);
					return;
				}
				statusText = failTalkingQuotaOrKey(msg);
				return;
			}
		}

		if (browserText) {
			await addChatTurn(browserText);
		} else if (!isTranslating) {
			statusText = failSpeechRecognize();
		}
	}

	/**
	 * 마이크 듣기 시작: TTS 중단 → 상태 초기화 → 음량감시+인식(가능하면) 시작.
	 * SpeechRecognition이 없어도 MediaRecorder+Whisper만으로 동작 가능.
	 */
	async function startListening() {
		stopTts();
		speakingAt = null;
		lastDebugError = '';
		if (!navigator.mediaDevices?.getUserMedia) {
			lastDebugError = `getUserMedia 없음 · secure=${window.isSecureContext}`;
			statusText = failMicUnavailable();
			return;
		}

		finalTranscript = '';
		heardSound = false;
		lastLoudAt = 0;
		quietSeconds = 0;
		lockedSpeechLang = null;
		speechCycleIndex = 0;
		keepListening = true;
		isListening = true;
		statusText = '듣고 있어요 · 각자 언어로 말해 보세요';

		try {
			await setupMicMonitor();
			const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
			if (SpeechRecognitionAPI) {
				recognition = new SpeechRecognitionAPI();
				attachRecognitionHandlers(recognition);
				recognition.start();
			}
			// SpeechRecognition 없어도 MediaRecorder+Whisper로 진행 가능
		} catch (err) {
			keepListening = false;
			isListening = false;
			await stopRecorder();
			stopMicMonitor();
			releaseMicStream();
			lastDebugError =
				err instanceof DOMException
					? `${err.name}: ${err.message}`
					: err instanceof Error
						? err.message
						: String(err);
			if (err instanceof DOMException && err.name === 'NotAllowedError') {
				statusText = failMicDenied();
			} else {
				statusText = failMicConnect();
			}
		}
	}

	/** 빨간 마이크 버튼: 듣는 중이면 종료(+번역), 아니면 시작 */
	function toggleMicrophone() {
		if (isListening) {
			void stopListening(true);
			return;
		}
		void startListening();
	}

	/** 아래 입력창 “보내기” — 마이크/번역 중이 아닐 때만 한 턴 추가 */
	async function submitManualText() {
		const text = manualText.trim();
		if (!text || isListening || isTranslating) return;
		manualText = '';
		await addChatTurn(text);
	}

	/** Enter=보내기, Shift+Enter=줄바꿈(기본 textarea 동작) */
	function onManualKeydown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			void submitManualText();
		}
	}

	/**
	 * A/B 언어가 같아지면 B를 다른 지원 언어로 자동 교체.
	 * (같은 언어끼리는 번역할 수 없음)
	 */
	function onLangChange() {
		if (langA === langB) {
			langB = appLangs.find((lang) => lang !== langA) ?? 'en';
		}
		statusText = describeLangPair();
	}

	/** 언어 메뉴에서 한쪽 언어를 고름. 듣는/번역 중에는 잠금 */
	/** @param {'a' | 'b'} side @param {AppLang} lang */
	function pickLang(side, lang) {
		if (isListening || isTranslating) return;
		if (side === 'a') langA = lang;
		else langB = lang;
		openLangMenu = null;
		onLangChange();
	}

	/** A 또는 B 언어 드롭다운 열기/닫기 토글 */
	function toggleLangMenu(side) {
		if (isListening || isTranslating) return;
		openLangMenu = openLangMenu === side ? null : side;
	}

	/** A↔B 언어 자리 바꾸기(가운데 화살표 버튼) */
	function swapLangs() {
		if (isListening || isTranslating) return;
		openLangMenu = null;
		const prev = langA;
		langA = langB;
		langB = prev;
		statusText = describeLangPair();
	}

	/** 대기 상태일 때 기본 안내 문구(선택한 언어 쌍 반영) */
	function describeLangPair() {
		return `${langMeta[langA].label} ↔ ${langMeta[langB].label} · 말하면 상대 언어로 보여요`;
	}

	/**
	 * 새 대화: 오늘 칸에 있던 말을 타임스탬프 키로 히스토리에 남기고 오늘 칸을 비움.
	 * 지난 대화는 시계 아이콘 패널에서 다시 열 수 있음.
	 */
	function startNewConversation() {
		stopTts();
		if (isListening) void stopListening(false);
		showHistory = false;

		/** @type {Record<string, ChatMessage[]>} */
		const next = { ...records };
		const todays = next[today] ?? [];

		// 오늘 칸에 메시지가 있으면 타임스탬프 키로 보관 후 비움
		if (todays.length > 0) {
			next[`${today}_${Date.now()}`] = todays;
		}
		next[today] = [];
		records = next;
		localStorage.setItem(storageKey, JSON.stringify(records));
		selectedDate = today;
		statusText = describeLangPair();
	}

	/** 지난 대화 목록에서 날짜/세션을 고르면 채팅 영역이 그 기록으로 바뀜 */
	function selectDate(date) {
		selectedDate = date;
		showHistory = false;
		statusText =
			date === today ? describeLangPair() : '저장된 대화 · 새 대화로 이어서 말할 수 있어요';
		void scrollChatToBottom();
	}

	/**
	 * 날짜 키를 한국어 짧은 날짜(·시간)로 표시.
	 * 보관 세션 키(YYYY-MM-DD_밀리초)면 시·분까지 보여 “몇 시에 새 대화했는지” 구분.
	 */
	function formatDate(date) {
		// 보관 세션: 2026-09-18_1710000000000
		if (date.includes('_')) {
			const ms = Number(date.split('_')[1]);
			const d = Number.isFinite(ms) ? new Date(ms) : new Date();
			return new Intl.DateTimeFormat('ko-KR', {
				month: 'short',
				day: 'numeric',
				weekday: 'short',
				hour: '2-digit',
				minute: '2-digit'
			}).format(d);
		}
		return new Intl.DateTimeFormat('ko-KR', {
			month: 'short',
			day: 'numeric',
			weekday: 'short'
		}).format(new Date(`${date}T00:00:00`));
	}
</script>

<svelte:window onkeydown={onFocusKeydown} />

<!--
	메신저형 레이아웃:
	- flex-1 + min-h-0: 부모(+layout) 남은 높이를 채우되, 안쪽 채팅만 스크롤되게
	- 위: 언어/화자 툴바(오늘만) · 가운데: 채팅 · 아래: 마이크·입력(오늘만)
-->
<div class="flex min-h-0 flex-1 flex-col">
	{#if selectedDate === today}
		<!-- shrink-0: 툴바 높이는 고정, 채팅이 줄어들며 스크롤 -->
		<!-- px-3 / sm:px-4: 좁은 화면은 여백 작게, 넓으면 조금 더 -->
		<div class="shrink-0 space-y-2 px-3 pt-2 sm:px-4">
			<!-- 언어 A | 바꾸기 | 언어 B — rounded-xl·테두리로 한 덩어리처럼 보이게 -->
			<div class="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-900/80 p-1">
				<div class="relative min-w-0 flex-1">
					<!-- min-w-0 flex-1: 긴 언어명도 잘리지 않고 양쪽이 같은 폭으로 나뉨 -->
					<button
						type="button"
						class="flex w-full items-center justify-center rounded-lg bg-zinc-800 px-2 py-2 text-xs font-medium text-zinc-100 disabled:opacity-50 sm:text-sm"
						onclick={() => toggleLangMenu('a')}
						disabled={isListening || isTranslating}
						aria-expanded={openLangMenu === 'a'}
					>
						{langMeta[langA].label}
					</button>
					{#if openLangMenu === 'a'}
						<!-- absolute + z-20: 채팅 위로 메뉴가 겹쳐 보이게 / 흰 배경: Windows select 흰글씨 버그 회피 -->
						<ul
							class="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl"
							role="listbox"
						>
							{#each appLangs as lang (lang)}
								<li>
									<button
										type="button"
										class="flex w-full px-3 py-2.5 text-left text-sm font-medium {lang === langA
											? 'bg-red-500 text-white'
											: 'text-zinc-900 hover:bg-red-500 hover:text-white'}"
										onclick={() => pickLang('a', lang)}
									>
										{langMeta[lang].label}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				<!-- 가운데 스왑: 고정 정사각(h-9 w-9)이라 언어 버튼 폭이 흔들리지 않음 -->
				<button
					type="button"
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 disabled:opacity-40"
					onclick={swapLangs}
					disabled={isListening || isTranslating}
					aria-label="언어 바꾸기"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path
							d="M7 8h11M15 5l3 3-3 3M17 16H6M9 13l-3 3 3 3"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
				<div class="relative min-w-0 flex-1">
					<button
						type="button"
						class="flex w-full items-center justify-center rounded-lg bg-zinc-800 px-2 py-2 text-xs font-medium text-zinc-100 disabled:opacity-50 sm:text-sm"
						onclick={() => toggleLangMenu('b')}
						disabled={isListening || isTranslating}
						aria-expanded={openLangMenu === 'b'}
					>
						{langMeta[langB].label}
					</button>
					{#if openLangMenu === 'b'}
						<ul
							class="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl"
							role="listbox"
						>
							{#each appLangs as lang (lang)}
								<li>
									<button
										type="button"
										class="flex w-full px-3 py-2.5 text-left text-sm font-medium {lang === langB
											? 'bg-red-500 text-white'
											: 'text-zinc-900 hover:bg-red-500 hover:text-white'}"
										onclick={() => pickLang('b', lang)}
									>
										{langMeta[lang].label}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<!-- 화자 모드 칩: overflow-x-auto — 좁은 폰에서 가로 스크롤 -->
			<div class="flex items-center gap-1 overflow-x-auto pb-0.5">
				{#each /** @type {const} */ (['auto', 'a', 'b']) as mode (mode)}
					<button
						type="button"
						class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition {speakerMode ===
						mode
							? mode === 'a'
								? 'bg-sky-500 text-white'
								: mode === 'b'
									? 'bg-rose-500 text-white'
									: 'bg-white text-zinc-900'
							: 'text-zinc-400 hover:bg-white/10 hover:text-white'}"
						onclick={() => (speakerMode = mode)}
						disabled={isListening || isTranslating}
					>
						{mode === 'auto' ? '자동' : mode === 'a' ? langMeta[langA].label : langMeta[langB].label}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!--
		채팅 카드:
		- flex-1 min-h-0: 남는 세로 공간을 모두 차지
		- overflow-hidden + 안쪽 overflow-y-auto: 카드 밖은 안 넘치고 말풍선만 스크롤
		- rounded-2xl bg-zinc-900/80: 어두운 반투명으로 레이아웃 배경과 구분
	-->
	<section
		class="mx-3 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 sm:mx-4"
	>
		<!--
			채팅 카드 헤더 (날짜 + 버튼들)
			- shrink-0: 아래 말풍선만 스크롤되고, 이 줄은 항상 위에 고정
			- border-b: 헤더와 말풍선 영역을 가로선으로 구분
		-->
		<header class="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
			<!-- truncate: 긴 날짜/세션 이름이 오른쪽 버튼을 밀지 않게 말줄임 -->
			<span class="min-w-0 truncate text-xs font-medium text-zinc-400">{formatDate(selectedDate)}</span>
			<!-- shrink-0: 아이콘 버튼 두 개는 줄어들지 않음 -->
			<div class="flex shrink-0">
				<!--
					새 대화(+) 버튼
					- h-8 w-8: 손가락으로 누르기 쉬운 정사각
					- hover:bg-white/10: 올리면 살짝 밝아져 “누를 수 있음” 표시
					- 누르면 startNewConversation → 오늘 칸을 비우고 예전 말은 히스토리로 보관
				-->
				<button
					type="button"
					class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
					onclick={startNewConversation}
					aria-label="새 대화"
					title="새 대화"
				>
					<!-- h-4 w-4: 버튼 칸보다 작은 플러스(+) 아이콘 -->
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"
						><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" /></svg
					>
				</button>
				<!--
					지난 대화(시계) 버튼
					- showHistory를 true/false로 토글
					- true면 아래 “날짜 목록” 패널이 열림
				-->
				<button
					type="button"
					class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
					onclick={() => (showHistory = !showHistory)}
					aria-label="지난 대화"
					title="지난 대화"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="8" />
						<path d="M12 7v5l3 2" />
					</svg>
				</button>
			</div>
		</header>

		<!--
			말풍선이 쌓이는 스크롤 영역
			- flex-1 min-h-0: 카드 안에서 남는 세로 공간을 전부 차지
			- overflow-y-auto: 말이 많으면 이 상자만 위아래로 스크롤
			- overscroll-contain: 맨 끝에서 스크롤해도 바깥 페이지가 덜 끌림
			- gap-2.5: 말풍선과 말풍선 사이 간격
			- bind:this={chatScrollEl}: 새 말 추가 후 맨 아래로 내리기 위해 DOM을 기억
		-->
		<div
			bind:this={chatScrollEl}
			class="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain p-3"
		>
			{#if messages.length === 0}
				<!-- m-auto: 말풍선이 없을 때 안내 문구를 세로·가로 가운데에 둠 -->
				<p class="m-auto px-3 text-center text-xs leading-5 text-zinc-500">
					왼쪽 {langMeta[langA].label} · 오른쪽 {langMeta[langB].label}<br />
					말하면 상대 언어로 말풍선이 쌓입니다.
				</p>
			{/if}
			<!-- createdAt을 key로 씀 → 같은 글이라도 턴마다 구분 -->
			{#each messages as item (item.createdAt)}
				<!--
					한 줄(말풍선 자리):
					- speaker 'b' → justify-end (오른쪽, B)
					- 그 외(A) → justify-start (왼쪽)
					메신저처럼 “누가 말했는지”를 위치로 보여 줌
				-->
				<div class="flex {item.speaker === 'b' ? 'justify-end' : 'justify-start'}">
					<!--
						말풍선 본체 (탭하면 전체화면 확대 openFocus)
						- max-w-[88%]: 화면 전체를 덮지 않게 가로 폭 제한
						- B=rose(분홍), A=흰 반투명 → 색으로도 A/B 구분
						- rounded-br-md / rounded-bl-md: 말 나가는 쪽 모서리만 덜 둥글게(“꼬리” 느낌)
						- active:scale-[0.99]: 눌렀을 때 살짝 줄어들어 터치 피드백
						- role=button + Enter/Space: 키보드로도 확대 가능
					-->
					<div
						role="button"
						tabindex="0"
						class="max-w-[88%] cursor-pointer rounded-2xl px-3 py-2 text-left active:scale-[0.99] {item.speaker ===
						'b'
							? 'rounded-br-md bg-rose-500/90 text-white'
							: 'rounded-bl-md bg-white/10 text-zinc-100'}"
						onclick={() => openFocus(item)}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								openFocus(item);
							}
						}}
						aria-label="크게 보기"
					>
						<!-- 말풍선 맨 위 줄: 왼쪽=언어 라벨, 오른쪽=재생(▶) 버튼 -->
						<div class="mb-0.5 flex items-center justify-between gap-2">
							<!--
								아주 작은 글씨(text-[10px]): “한국어 → English”처럼
								원문 언어 → 번역 언어를 보여 줌
								B 말풍선은 분홍 톤, A는 회색 톤으로 배경과 맞춤
							-->
							<p
								class="truncate text-[10px] font-medium {item.speaker === 'b'
									? 'text-rose-100/80'
									: 'text-zinc-500'}"
							>
								{langMeta[item.sourceLang].label} → {langMeta[item.targetLang].label}
							</p>
							<!--
								번역문 TTS 재생 버튼(▶)
								- stopPropagation: 재생만 하고, 말풍선 클릭(확대)은 막음
								- h-6 w-6 rounded-full: 작은 원형 터치 영역
							-->
							<button
								type="button"
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full {item.speaker ===
								'b'
									? 'bg-white/20'
									: 'bg-white/10'}"
								onclick={(event) => {
									event.stopPropagation();
									speakText(item.target, item.targetLang, item.createdAt);
								}}
								aria-label="번역 듣기"
							>
								<svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"
									><path d="M8 5v14l11-7L8 5Z" /></svg
								>
							</button>
						</div>
						<!--
							크게 보이는 본문 = 번역문(item.target)
							상대방이 실제로 읽는 문장. text-sm + leading-6으로 읽기 쉽게
							break-words: 긴 단어/URL이 말풍선 밖으로 안 나가게
						-->
						<p class="text-sm font-medium leading-6 break-words">{item.target}</p>
						<!--
							작게 보이는 줄 = 원문(item.source)
							말한 사람이 뭐라고 했는지 확인용. mt-1로 번역문과 살짝 띄움
							B면 text-rose-100/70(분홍 위 옅은 글씨), A면 text-zinc-500(회색)
						-->
						<p
							class="mt-1 text-[11px] leading-4 break-words {item.speaker === 'b'
								? 'text-rose-100/70'
								: 'text-zinc-500'}"
						>
							{item.source}
						</p>
					</div>
				</div>
			{/each}
		</div>

		<!--
			지난 대화 패널 (시계 버튼으로 showHistory=true 일 때만 보임)
			채팅 카드 맨 아래에 붙음
		-->
		{#if showHistory}
			<!--
				- max-h-36: 높이 상한 ≈9rem → 말풍선 영역을 다 가리지 않음
				- overflow-y-auto: 날짜가 많으면 이 패널만 스크롤
				- shrink-0: 위 말풍선이 줄어들어도 이 패널 높이는 유지
				- border-t + bg-black/20: 말풍선 영역과 시각적으로 구분
			-->
			<div class="max-h-36 shrink-0 overflow-y-auto border-t border-white/10 bg-black/20 p-2">
				{#if historyDates.length}
					<!-- 날짜(또는 세션 키)마다 한 줄 버튼 → 누르면 그 날 대화를 다시 봄 -->
					{#each historyDates as date (date)}
						<button
							type="button"
							class="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-300 hover:bg-white/10"
							onclick={() => selectDate(date)}
						>
							<!-- 왼쪽: 사람이 읽기 쉬운 날짜 글자 (길면 truncate) -->
							<span class="min-w-0 truncate">{formatDate(date)}</span>
							<!-- 오른쪽: 그 날짜에 쌓인 말풍선 개수 -->
							<span class="shrink-0 text-zinc-500">{records[date].length}</span>
						</button>
					{/each}
				{:else}
					<!-- 아직 보관한 날이 없을 때 안내 -->
					<p class="px-2 py-3 text-xs text-zinc-500">지난 대화가 없어요.</p>
				{/if}
			</div>
		{/if}
	</section>

	{#if selectedDate === today}
		<!-- 하단 고정 입력 영역: shrink-0 — 채팅이 늘어나도 마이크·입력창은 항상 보임 -->
		<div class="shrink-0 space-y-2 px-3 py-2 sm:px-4">
			<div class="flex items-center gap-2">
				<!--
					마이크 토글:
					- h-12 w-12 rounded-full: 손가락으로 누르기 쉬운 크기
					- 듣는 중=흰 배경+빨간 아이콘(멈춤 느낌), 대기=빨간 배경(녹음 시작)
				-->
				<button
					type="button"
					class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg transition {isListening
						? 'bg-white text-red-500'
						: 'bg-red-500 text-white'}"
					onclick={toggleMicrophone}
					disabled={isTranslating}
					aria-label={isListening ? '번역 종료' : '말하기 시작'}
				>
					{#if isListening || isTranslating}
						<!-- 네모: “정지/처리 중” 시각 신호 -->
						<span class="h-4 w-4 rounded-sm bg-current"></span>
					{:else}
						<svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"
							><path
								d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
							/></svg
						>
					{/if}
				</button>
				<!-- flex-1 min-w-0: 긴 상태문구가 버튼을 밀지 않고 줄바꿈·말줄임 -->
				<p
					class="min-w-0 flex-1 text-xs leading-4 break-words {isListening
						? 'text-red-200'
						: 'text-zinc-400'}"
				>
					{statusText}
				</p>
			</div>

			<!-- 직접 입력 폼: 마이크 없이도 같은 번역 파이프라인으로 보냄 -->
			<form
				class="flex items-end gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 p-2"
				onsubmit={(event) => {
					event.preventDefault();
					void submitManualText();
				}}
			>
				<label class="sr-only" for="manual-translate">대화 입력</label>
				<!-- max-h-28: 여러 줄 입력은 허용하되 화면을 다 먹지는 않게 -->
				<textarea
					id="manual-translate"
					class="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-white placeholder:text-zinc-500 outline-none disabled:opacity-50"
					placeholder="직접 입력…"
					bind:value={manualText}
					onkeydown={onManualKeydown}
					disabled={isListening || isTranslating}
					rows="1"
				></textarea>
				<button
					type="submit"
					class="shrink-0 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-zinc-900 disabled:opacity-40"
					disabled={isListening || isTranslating || !manualText.trim()}
				>
					{isTranslating ? '…' : '보내기'}
				</button>
			</form>
		</div>
	{/if}

	<!-- 개발 모드에서만 보이는 디버그 줄(마이크/보안/오류) -->
	<DebugPanel lines={debugLines} />

	{#if focusedMessage}
		<!--
			전체화면 확대 레이어:
			- fixed inset-0 z-50: 앱 전체를 덮어 상대방이 큰 글씨로 읽게
			- safe-area padding: 노치·홈 인디케이터에 글자가 안 가리게
			- backdrop-blur: 뒤 채팅을 살짝 흐리게
		-->
		<div
			class="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-sm"
			style="padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))"
			role="dialog"
			aria-modal="true"
			aria-label="번역 크게 보기"
			tabindex="-1"
			onclick={closeFocus}
			onkeydown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') closeFocus();
			}}
		>
			<div class="mb-3 flex items-center justify-between gap-2">
				<p class="min-w-0 truncate text-xs text-zinc-400">
					{langMeta[focusedMessage.sourceLang].label} → {langMeta[focusedMessage.targetLang].label}
				</p>
				<div class="flex shrink-0 gap-2">
					<button
						type="button"
						class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
						onclick={(event) => {
							event.stopPropagation();
							const msg = focusedMessage;
							if (!msg) return;
							speakText(msg.target, msg.targetLang, msg.createdAt);
						}}
						aria-label="번역 듣기"
					>
						<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"
							><path d="M8 5v14l11-7L8 5Z" /></svg
						>
					</button>
					<button
						type="button"
						class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
						onclick={(event) => {
							event.stopPropagation();
							closeFocus();
						}}
						aria-label="닫기"
					>
						<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"
							><path
								d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z"
							/></svg
						>
					</button>
				</div>
			</div>
			<!-- 가운데 큰 글씨: sm에서 text-4xl로 더 크게 — 멀리서 읽기용 -->
			<button
				type="button"
				class="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto text-center"
				onclick={(event) => {
					event.stopPropagation();
					closeFocus();
				}}
			>
				<p class="max-w-3xl text-2xl font-semibold leading-snug break-words text-white sm:text-4xl">
					{focusedMessage.target}
				</p>
				<p class="mt-6 max-w-2xl text-sm break-words text-zinc-500 sm:text-lg">{focusedMessage.source}</p>
				<p class="mt-8 text-xs text-zinc-600">탭하면 닫힙니다</p>
			</button>
		</div>
	{/if}
</div>

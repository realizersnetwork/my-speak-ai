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
		failScenarioStart,
		failTalkingQuotaOrKey
	} from '$lib/userMessages.js';
	import {
		formatTalkingUsageLine,
		getTalkingUsage,
		recordTalkingUsage
	} from '$lib/talkingUsage.js';

	// My Talking AI — 번역(My Translate)과 별도 서비스
	const storageKey = 'my-speak-ai-chatbot-v2';
	const silenceMs = 3000;
	const loudThreshold = 0.025;

	/** @typedef {'ko' | 'en' | 'ja'} AppLang */
	/** @typedef {{ role: 'user' | 'bot'; text: string; note?: string; createdAt: number }} BotMessage */
	/** @typedef {{ id: string; createdAt: number; scenarioId: string; practiceLang: AppLang; messages: BotMessage[] }} ChatSession */

	const langMeta = {
		ko: { label: '한국어', speech: 'ko-KR', api: 'ko' },
		en: { label: 'English', speech: 'en-US', api: 'en' },
		ja: { label: '日本語', speech: 'ja-JP', api: 'ja' }
	};
	const appLangs = /** @type {AppLang[]} */ (['ko', 'en', 'ja']);

	/** 상황별 오프닝 + 키워드 응답 (한국어 원본 → 연습 언어로 번역해 보냄) */
	const scenarios = [
		{
			id: 'free',
			label: '자유 대화',
			opening: '안녕하세요! 오늘 뭐 하고 지냈어요? 편하게 이야기해 봐요.',
			replies: [
				{ keys: ['안녕', 'hello', 'hi', 'こんにちは'], reply: '반가워요! 오늘은 어떤 이야기를 할까요?' },
				{ keys: ['날씨', 'weather', '天気'], reply: '날씨 이야기 좋네요. 그쪽은 지금 날씨가 어때요?' },
				{ keys: ['음식', '먹', 'food', '食べる'], reply: '음식 이야기도 좋아요! 좋아하는 음식이 있어요?' },
				{ keys: ['여행', 'travel', '旅行'], reply: '여행 가고 싶네요. 어디로 가 보고 싶어요?' },
				{ keys: ['고마', 'thank', 'ありがとう'], reply: '천만에요! 또 궁금한 거 있으면 말해 주세요.' },
				{ keys: ['바이', 'bye', 'さようなら'], reply: '오늘 대화 즐거웠어요. 다음에 또 만나요!' }
			],
			fallback: '흥미로운 이야기예요. 조금만 더 자세히 말해 줄래요?'
		},
		{
			id: 'cafe',
			label: '카페',
			opening: '어서 오세요! 주문 도와드릴까요? 음료나 디저트 뭐 드시겠어요?',
			replies: [
				{ keys: ['커피', 'coffee', 'コーヒー'], reply: '아메리카노, 라떼 중에 고르실 수 있어요. 어떤 걸로 하실래요?' },
				{ keys: ['라떼', 'latte'], reply: '라떼 좋죠! 아이스로 드릴까요, 핫으로 드릴까요?' },
				{ keys: ['아메리카노', 'americano'], reply: '아메리카노요. 사이즈는 레귤러와 라지 있어요.' },
				{ keys: ['케이크', '디저트', 'cake', 'デザート'], reply: '오늘 치즈케이크랑 초콜릿 머핀이 있어요.' },
				{ keys: ['계산', '카드', 'bill', '会計'], reply: '여기 카드 단말기 있어요. 결제 도와드릴게요.' },
				{ keys: ['포장', 'take', '持ち帰り'], reply: '포장해 드릴게요. 조금만요!' }
			],
			fallback: '네, 알겠어요. 다른 메뉴도 추천해 드릴까요?'
		},
		{
			id: 'travel',
			label: '여행',
			opening: '여행 도우미예요. 공항, 호텔, 길 찾기 뭐든 물어보세요!',
			replies: [
				{ keys: ['공항', 'airport', '空港'], reply: '공항이군요. 체크인 카운터는 보통 출발 2시간 전에 열어요.' },
				{ keys: ['호텔', 'hotel', 'ホテル'], reply: '호텔 체크인은 보통 오후 3시부터예요. 예약 번호 있으세요?' },
				{ keys: ['길', '어디', 'where', 'どこ'], reply: '어디로 가고 싶으세요? 가까운 역이나 랜드마크를 알려 주세요.' },
				{ keys: ['택시', 'taxi', 'タクシー'], reply: '택시 타려면 공항 출구의 택시 승강장을 찾아보세요.' },
				{ keys: ['예약', 'reserv', '予約'], reply: '예약 확인해 드릴게요. 이름과 날짜를 말해 주세요.' }
			],
			fallback: '좋아요. 여행 중에 더 필요한 게 있으면 말해 주세요!'
		}
	];

	/** @type {AppLang} */
	let practiceLang = $state('en');
	let scenarioId = $state('free');
	/** @type {Record<string, ChatSession>} */
	let sessions = $state({});
	let activeSessionId = $state('');
	let showHistory = $state(false);
	let isListening = $state(false);
	let isThinking = $state(false);
	/** 챗봇이 소리 내어 읽는 중 */
	let isSpeaking = $state(false);
	/** 봇 답변 자동 재생 (회화는 듣는 게 기본) */
	let autoSpeak = $state(true);
	let statusText = $state('연습할 언어를 고르고 말해 보세요');
	let manualText = $state('');
	let quietSeconds = $state(0);
	let openLangMenu = $state(false);
	/** @type {HTMLDivElement | undefined} */
	let chatScrollEl = $state();
	/** 지금 재생 중인 메시지(다시듣기 표시용) */
	let speakingAt = $state(/** @type {number | null} */ (null));
	/** 개발용 마지막 오류 */
	let lastDebugError = $state('');
	/** 오늘 Talking API 사용 요약 (이 기기) */
	let usageLine = $state('오늘 API 0회');

	/** @type {SpeechRecognition | null} */
	let recognition = null;
	let finalTranscript = '';
	let keepListening = false;
	let heardSound = false;
	let lastLoudAt = 0;
	/** @type {MediaStream | null} */
	let micStream = null;
	/** @type {AudioContext | null} */
	let audioContext = null;
	/** @type {AnalyserNode | null} */
	let analyser = null;
	/** @type {Float32Array | null} */
	let pcmData = null;
	/** @type {number | null} */
	let monitorRaf = null;
	/** @type {ReturnType<typeof setTimeout> | null} */
	let restartTimer = null;
	/** 무음 종료 후 Whisper로 보낼 녹음 */
	/** @type {MediaRecorder | null} */
	let mediaRecorder = null;
	/** @type {Blob[]} */
	let recordedChunks = [];

	let scenario = $derived(scenarios.find((s) => s.id === scenarioId) ?? scenarios[0]);
	let messages = $derived(sessions[activeSessionId]?.messages ?? []);
	let historySessions = $derived(
		Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt)
	);

	/** 개발 모드 DebugPanel용 */
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
			`talking · lang=${practiceLang} · scenario=${scenarioId}`,
			`listen=${isListening} think=${isThinking} speak=${isSpeaking} msgs=${messages.length}`,
			`${secure} · ${mic} · ${stt} · recorder=${mediaRecorder ? 'on' : 'off'}`,
			usageLine,
			...(lastDebugError ? [`lastError: ${lastDebugError}`] : [])
		];
	});

	onMount(() => {
		warmTtsVoices();
		usageLine = formatTalkingUsageLine(getTalkingUsage());
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				const data = JSON.parse(saved);
				if (data.practiceLang) practiceLang = data.practiceLang;
				if (data.scenarioId) scenarioId = data.scenarioId;
				if (typeof data.autoSpeak === 'boolean') autoSpeak = data.autoSpeak;
				if (data.sessions && typeof data.sessions === 'object') {
					sessions = data.sessions;
					activeSessionId = data.activeSessionId || Object.keys(sessions)[0] || '';
					if (activeSessionId && sessions[activeSessionId]) {
						scenarioId = sessions[activeSessionId].scenarioId || scenarioId;
						practiceLang = sessions[activeSessionId].practiceLang || practiceLang;
						return;
					}
				}
			} else {
				// v1(단일 messages) → v2 세션으로 이전
				const legacy = localStorage.getItem('my-speak-ai-chatbot-v1');
				if (legacy) {
					const data = JSON.parse(legacy);
					if (data.practiceLang) practiceLang = data.practiceLang;
					if (data.scenarioId) scenarioId = data.scenarioId;
					if (typeof data.autoSpeak === 'boolean') autoSpeak = data.autoSpeak;
					if (Array.isArray(data.messages) && data.messages.length) {
						const id = `s-${Date.now()}`;
						sessions = {
							[id]: {
								id,
								createdAt: Date.now(),
								scenarioId,
								practiceLang,
								messages: data.messages
							}
						};
						activeSessionId = id;
						persist();
						return;
					}
				}
			}
		} catch {
			statusText = failLoadHistory();
		}
		void startNewChat(true);
	});

	onDestroy(() => {
		stopTts();
		void stopListening(false);
	});

	function persist() {
		localStorage.setItem(
			storageKey,
			JSON.stringify({ practiceLang, scenarioId, autoSpeak, sessions, activeSessionId })
		);
	}

	/** 활성 세션의 messages만 갱신 */
	function setMessages(nextMessages) {
		if (!activeSessionId || !sessions[activeSessionId]) return;
		sessions = {
			...sessions,
			[activeSessionId]: {
				...sessions[activeSessionId],
				messages: nextMessages,
				scenarioId,
				practiceLang
			}
		};
		persist();
	}

	async function scrollToBottom() {
		await tick();
		if (chatScrollEl) chatScrollEl.scrollTop = chatScrollEl.scrollHeight;
	}

	/**
	 * 연습 언어 네이티브 TTS로 챗봇 문장을 읽습니다 (콩글리시 방지).
	 * @param {string} text
	 * @param {number} [createdAt]
	 */
	function speakBot(text, createdAt) {
		void speakTts(text, practiceLang, {
			onStart: () => {
				isSpeaking = true;
				speakingAt = createdAt ?? null;
				statusText = 'AI가 말하고 있어요 · 잘 들어 보세요';
			},
			onEnd: () => {
				isSpeaking = false;
				speakingAt = null;
				if (!isListening && !isThinking) {
					statusText = `${langMeta[practiceLang].label}로 대답해 보세요`;
				}
			}
		});
	}

	/**
	 * @param {string} text
	 * @param {AppLang} from
	 * @param {AppLang} to
	 */
	async function translateOne(text, from, to) {
		return translateText(text, from, to);
	}

	/** 연습 언어로 봇 멘트를 맞춤 (템플릿은 한국어) */
	async function toPractice(textKo) {
		const text = await translateOne(textKo, 'ko', practiceLang);
		// 한국어가 아닐 때 작은 글씨로 원문 힌트
		const note = practiceLang === 'ko' ? undefined : textKo;
		return { text, note };
	}

	/**
	 * 내가 한 말에 번역 달기 — 챗봇과 같은 방식
	 * (연습 언어가 한국어면 영어 번역, 아니면 한국어 번역)
	 * @param {string} spoken
	 */
	async function noteForUser(spoken) {
		if (practiceLang === 'ko') {
			return translateOne(spoken, 'ko', 'en');
		}
		return translateOne(spoken, practiceLang, 'ko');
	}

	/**
	 * 키워드 응답 대신 OpenAI에 넘길 최근 대화
	 * @returns {{ role: 'user' | 'bot'; text: string }[]}
	 */
	function historyPayload() {
		return messages.slice(-12).map((m) => ({ role: m.role, text: m.text }));
	}

	/**
	 * 텍스트 → Talking 답변 API
	 * @param {string} userText
	 */
	async function fetchReplyFromText(userText) {
		const res = await fetch('/api/talking/reply', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				text: userText,
				practiceLang,
				scenarioId,
				scenarioLabel: scenario.label,
				history: historyPayload()
			})
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			lastDebugError = `reply ${res.status}: ${data.error || 'fail'}`;
			throw new Error(data.error || 'reply failed');
		}
		lastDebugError = '';
		usageLine = formatTalkingUsageLine(
			recordTalkingUsage({ kind: 'reply', tokens: Number(data.tokens) || 0 })
		);
		return /** @type {string} */ (data.reply);
	}

	/**
	 * 녹음 → STT + 답변 API
	 * @param {Blob} audioBlob
	 */
	async function fetchTurnFromAudio(audioBlob) {
		const form = new FormData();
		const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
		form.append('audio', audioBlob, `speech.${ext}`);
		form.append('practiceLang', practiceLang);
		form.append('scenarioId', scenarioId);
		form.append('scenarioLabel', scenario.label);
		form.append('history', JSON.stringify(historyPayload()));

		const res = await fetch('/api/talking/turn', { method: 'POST', body: form });
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			lastDebugError = `turn ${res.status}: ${data.error || 'fail'}`;
			throw new Error(data.error || 'turn failed');
		}
		lastDebugError = '';
		// 말하기 1회 = STT+채팅 (과금 체감용으로 1회로 표시, 토큰은 채팅분)
		usageLine = formatTalkingUsageLine(
			recordTalkingUsage({ kind: 'turn', tokens: Number(data.tokens) || 0 })
		);
		return {
			userText: /** @type {string} */ (data.userText),
			reply: /** @type {string} */ (data.reply)
		};
	}

	/**
	 * 키워드로 응답을 고름 — API 키 없이 가벼운 회화 연습용 (오프라인 폴백)
	 * @param {string} userText
	 */
	function pickReplyKo(userText) {
		const lower = userText.toLowerCase();
		for (const item of scenario.replies) {
			if (item.keys.some((key) => lower.includes(key.toLowerCase()))) {
				return item.reply;
			}
		}
		return scenario.fallback;
	}

	/**
	 * @param {string} userText
	 * @param {string} [replyOverride] 이미 API에서 받은 답이면 재호출 안 함
	 */
	async function sendUserMessage(source, replyOverride) {
		const text = source.trim();
		if (!text || isThinking || isListening) return;

		ensureSession();
		stopTts();
		isThinking = true;
		statusText = 'AI 답변 준비 중…';

		try {
			const userNote = await noteForUser(text).catch(() => '');
			const withUser = [
				...messages,
				{
					role: 'user',
					text,
					note: userNote || undefined,
					createdAt: Date.now()
				}
			];
			setMessages(withUser);
			await scrollToBottom();

			let replyText = replyOverride?.trim() ?? '';
			if (!replyText) {
				try {
					replyText = await fetchReplyFromText(text);
				} catch {
					// 키 없거나 API 실패 시 기존 키워드+번역 폴백
					const replyKo = pickReplyKo(text);
					const translated = await toPractice(replyKo);
					replyText = translated.text;
					const createdAt = Date.now();
					setMessages([
						...withUser,
						{
							role: 'bot',
							text: replyText,
							note: translated.note,
							createdAt
						}
					]);
					statusText = `${langMeta[practiceLang].label}로 대답해 보세요`;
					await scrollToBottom();
					if (autoSpeak) speakBot(replyText, createdAt);
					return;
				}
			}

			const note =
				practiceLang === 'ko'
					? undefined
					: await translateOne(replyText, practiceLang, 'ko').catch(() => undefined);
			const createdAt = Date.now();
			setMessages([
				...withUser,
				{
					role: 'bot',
					text: replyText,
					note: note || undefined,
					createdAt
				}
			]);
			statusText = `${langMeta[practiceLang].label}로 대답해 보세요`;
			await scrollToBottom();
			if (autoSpeak) speakBot(replyText, createdAt);
		} catch (err) {
			lastDebugError = err instanceof Error ? err.message : String(err);
			statusText = failTalkingQuotaOrKey(
				err instanceof Error ? err.message : String(err)
			);
		} finally {
			isThinking = false;
		}
	}
	/** 활성 세션이 없으면 하나 만듦 */
	function ensureSession() {
		if (activeSessionId && sessions[activeSessionId]) return;
		const id = `s-${Date.now()}`;
		sessions = {
			...sessions,
			[id]: {
				id,
				createdAt: Date.now(),
				scenarioId,
				practiceLang,
				messages: []
			}
		};
		activeSessionId = id;
		persist();
	}

	/**
	 * 새 대화: 현재 세션은 히스토리에 두고 빈 세션을 연 뒤 오프닝
	 * @param {boolean} [isInitial]
	 */
	async function startNewChat(isInitial = false) {
		stopTts();
		if (isListening) void stopListening(false);
		showHistory = false;

		const current = sessions[activeSessionId];
		// 아직 말 한마디도 없는 빈 세션이면 새로 만들지 않고 오프닝만 다시
		if (!isInitial && current && current.messages.length === 0) {
			await startScenario(scenarioId, true);
			return;
		}

		const id = `s-${Date.now()}`;
		sessions = {
			...sessions,
			[id]: {
				id,
				createdAt: Date.now(),
				scenarioId,
				practiceLang,
				messages: []
			}
		};
		activeSessionId = id;
		persist();
		await startScenario(scenarioId, true);
	}

	/** @param {string} id */
	function selectSession(id) {
		if (!sessions[id]) return;
		stopTts();
		if (isListening) void stopListening(false);
		activeSessionId = id;
		scenarioId = sessions[id].scenarioId || scenarioId;
		practiceLang = sessions[id].practiceLang || practiceLang;
		showHistory = false;
		statusText = `${langMeta[practiceLang].label}로 대답해 보세요`;
		persist();
		void scrollToBottom();
	}

	/** @param {ChatSession} session */
	function formatSessionTitle(session) {
		const label = scenarios.find((s) => s.id === session.scenarioId)?.label ?? '대화';
		const d = new Date(session.createdAt);
		const when = d.toLocaleString('ko-KR', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
		return `${label} · ${when}`;
	}

	async function startScenario(id, reset = true) {
		stopTts();
		scenarioId = id;
		openLangMenu = false;
		ensureSession();
		if (reset) setMessages([]);
		isThinking = true;
		statusText = '상황 준비 중…';
		const current = scenarios.find((s) => s.id === id) ?? scenarios[0];
		try {
			const opening = await toPractice(current.opening);
			const createdAt = Date.now();
			setMessages([
				{
					role: 'bot',
					text: opening.text,
					note: opening.note,
					createdAt
				}
			]);
			statusText = `${langMeta[practiceLang].label}로 대답해 보세요`;
			await scrollToBottom();
			if (autoSpeak) speakBot(opening.text, createdAt);
		} catch {
			statusText = failScenarioStart();
		} finally {
			isThinking = false;
		}
	}

	function measureRms() {
		if (!analyser || !pcmData) return 0;
		analyser.getFloatTimeDomainData(pcmData);
		let sum = 0;
		for (let i = 0; i < pcmData.length; i++) sum += pcmData[i] * pcmData[i];
		return Math.sqrt(sum / pcmData.length);
	}

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
		const preview = finalTranscript.trim();
		statusText =
			heardSound && quietSeconds > 0
				? `${preview || '듣고 있어요'} · 조용함 ${quietSeconds}/3초`
				: preview || '듣고 있어요';
		monitorRaf = requestAnimationFrame(tickSilenceMonitor);
	}

	async function setupMicMonitor() {
		micStream = await navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: true, noiseSuppression: true }
		});
		audioContext = new AudioContext();
		if (audioContext.state === 'suspended') await audioContext.resume();
		analyser = audioContext.createAnalyser();
		analyser.fftSize = 2048;
		pcmData = new Float32Array(analyser.fftSize);
		audioContext.createMediaStreamSource(micStream).connect(analyser);

		// Whisper용 녹음 (브라우저 STT와 병행)
		recordedChunks = [];
		mediaRecorder = null;
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
			mediaRecorder.start(250);
		} catch {
			mediaRecorder = null;
		}

		tickSilenceMonitor();
	}

	/** @returns {Promise<Blob | null>} */
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

	function clearRestartTimer() {
		if (restartTimer !== null) {
			clearTimeout(restartTimer);
			restartTimer = null;
		}
	}

	function stopMicMonitor() {
		if (monitorRaf !== null) {
			cancelAnimationFrame(monitorRaf);
			monitorRaf = null;
		}
		// 트랙은 recorder stop 이후에 끊기도록 stopListening에서 처리
		void audioContext?.close().catch(() => {});
		audioContext = null;
		analyser = null;
		pcmData = null;
	}

	function releaseMicStream() {
		micStream?.getTracks().forEach((t) => t.stop());
		micStream = null;
	}

	function attachRecognitionHandlers(instance) {
		instance.lang = langMeta[practiceLang].speech;
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
			if (preview) statusText = preview;
		};

		instance.onerror = (event) => {
			if (event.error === 'not-allowed') {
				keepListening = false;
				statusText = failMicDenied();
			}
		};

		instance.onend = () => {
			if (!keepListening) return;
			clearRestartTimer();
			restartTimer = setTimeout(() => {
				if (!keepListening || !recognition) return;
				try {
					recognition.start();
				} catch {
					/* retry */
				}
			}, 150);
		};
	}

	/** @param {boolean} submit */
	async function stopListening(submit) {
		keepListening = false;
		clearRestartTimer();
		stopMicMonitor();
		try {
			recognition?.stop();
		} catch {
			/* */
		}
		recognition = null;
		isListening = false;
		quietSeconds = 0;

		const browserText = finalTranscript.trim();
		finalTranscript = '';
		heardSound = false;
		lastLoudAt = 0;

		const audioBlob = await stopRecorder();
		releaseMicStream();

		if (!submit) {
			if (!isThinking) statusText = `${langMeta[practiceLang].label}로 대답해 보세요`;
			return;
		}

		// 1순위: 녹음 → Whisper + GPT / 2순위: 브라우저 STT 텍스트
		if (audioBlob) {
			isThinking = true;
			statusText = '음성 인식·답변 중…';
			try {
				const { userText, reply } = await fetchTurnFromAudio(audioBlob);
				isThinking = false;
				await sendUserMessage(userText, reply);
				return;
			} catch (err) {
				isThinking = false;
				const msg = err instanceof Error ? err.message : '';
				lastDebugError = msg || 'turn failed';
				if (browserText) {
					await sendUserMessage(browserText);
					return;
				}
				statusText = failTalkingQuotaOrKey(msg);
				return;
			}
		}

		if (browserText) await sendUserMessage(browserText);
		else if (!isThinking) statusText = `${langMeta[practiceLang].label}로 대답해 보세요`;
	}

	async function startListening() {
		lastDebugError = '';
		if (!navigator.mediaDevices?.getUserMedia) {
			lastDebugError = `getUserMedia 없음 · secure=${window.isSecureContext}`;
			statusText = failMicUnavailable();
			return;
		}
		// 말할 때는 AI 음성 중지 (겹치면 인식이 깨짐)
		stopTts();
		finalTranscript = '';
		heardSound = false;
		lastLoudAt = 0;
		quietSeconds = 0;
		keepListening = true;
		isListening = true;
		statusText = '듣고 있어요';
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
			statusText =
				err instanceof DOMException && err.name === 'NotAllowedError'
					? failMicDenied()
					: failMicConnect();
		}
	}

	function toggleMicrophone() {
		if (isListening) void stopListening(true);
		else void startListening();
	}

	async function submitManual() {
		const text = manualText.trim();
		if (!text || isListening || isThinking) return;
		manualText = '';
		await sendUserMessage(text);
	}

	function onManualKeydown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			void submitManual();
		}
	}

	async function pickPracticeLang(lang) {
		if (isListening || isThinking) return;
		practiceLang = lang;
		openLangMenu = false;
		await startScenario(scenarioId, true);
	}
</script>

<!--
	ConversationChatbot 화면 뼈대 (메신저형)
	- 위: 연습 언어·자동말하기·상황 칩 (shrink-0, 항상 보임)
	- 가운데: 채팅 카드 flex-1 (말풍선만 스크롤)
	- 아래: 마이크·상태문구·직접 입력 (shrink-0, 항상 보임)
	- min-h-0 flex-1: 부모 레이아웃 높이 안에서만 늘어나고, 안쪽 스크롤이 깨지지 않게
-->
<div class="flex min-h-0 flex-1 flex-col">
	<!-- 상단 툴바: 언어 선택 + 스피커 토글 + 상황(시나리오) 칩 -->
	<div class="shrink-0 space-y-2 px-3 pt-2 sm:px-4">
		<!-- 한 줄: 왼쪽=연습 언어 드롭다운, 오른쪽=AI 자동 말하기 on/off -->
		<div class="flex items-center gap-2">
			<!-- relative: 아래 흰 드롭다운이 이 버튼 바로 밑에 절대위치로 붙게 -->
			<div class="relative min-w-0 flex-1">
				<!--
					연습 언어 버튼
					- rounded-xl border: 어두운 카드 위 입력칸처럼 보이게
					- disabled: 듣거나 AI 생각 중엔 언어 바꾸면 대화가 꼬여서 잠금
					- sm:text-sm: 넓은 화면에서 글자 조금 키움
				-->
				<button
					type="button"
					class="flex w-full items-center justify-between rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-left text-xs font-medium text-zinc-100 disabled:opacity-50 sm:text-sm"
					onclick={() => (openLangMenu = !openLangMenu)}
					disabled={isListening || isThinking}
				>
					<span>연습: {langMeta[practiceLang].label}</span>
					<!-- ▾: 메뉴가 아래로 열린다는 힌트 -->
					<span class="text-zinc-500">▾</span>
				</button>
				{#if openLangMenu}
					<!--
						언어 목록 패널
						- absolute z-20: 채팅 위에 겹쳐 보이게
						- bg-white: Windows에서 흰 글씨 버그 피하려고 밝은 메뉴 사용
						- min-w-40: 짧은 라벨도 누르기 쉬운 폭
					-->
					<ul
						class="absolute left-0 z-20 mt-1 min-w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl"
						role="listbox"
					>
						{#each appLangs as lang (lang)}
							<li>
								<!-- 고른 언어=빨간 배경, 나머지=검정 글씨 + 호버 시 빨강 -->
								<button
									type="button"
									class="flex w-full px-3 py-2.5 text-left text-sm font-medium {lang === practiceLang
										? 'bg-red-500 text-white'
										: 'text-zinc-900 hover:bg-red-500 hover:text-white'}"
									onclick={() => pickPracticeLang(lang)}
								>
									{langMeta[lang].label}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			<!--
				자동 말하기(TTS) 토글
				- on=빨간 배경+🔊: AI 답이 나오면 바로 읽어 줌
				- off=테두리만+🔇: 읽지 않음. 끌 때 stopTts로 재생 중이면 멈춤
				- persist(): 선택을 localStorage에 저장해 새로고침 후에도 유지
			-->
			<button
				type="button"
				class="shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-medium {autoSpeak
					? 'bg-red-500 text-white'
					: 'border border-white/15 text-zinc-400'}"
				onclick={() => {
					autoSpeak = !autoSpeak;
					if (!autoSpeak) stopTts();
					persist();
				}}
			>
				{autoSpeak ? '🔊' : '🔇'}
			</button>
		</div>

		<!--
			상황(시나리오) 칩 가로 스크롤
			- overflow-x-auto: 칩이 많으면 좌우로 밀기
			- scrollbar 숨김 유틸: 스크롤바는 안 보이게, 스와이프는 가능
			- whitespace-nowrap: 칩 글자가 두 줄로 안 깨지게
		-->
		<div class="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			{#each scenarios as s (s.id)}
				<button
					type="button"
					class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap {scenarioId ===
					s.id
						? 'bg-white text-zinc-900'
						: 'border border-white/15 text-zinc-400'}"
					onclick={() => startScenario(s.id)}
					disabled={isListening || isThinking}
				>
					{s.label}
				</button>
			{/each}
		</div>
	</div>

	<!--
		채팅 카드
		- flex-1 min-h-0: 위·아래 툴바를 빼고 남은 높이를 전부 사용
		- overflow-hidden: 카드 밖으로 말풍선이 안 넘침 → 안쪽만 스크롤
		- rounded-2xl bg-zinc-900/80: 어두운 반투명 박스로 배경과 구분
	-->
	<section
		class="mx-3 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 sm:mx-4"
	>
		<!-- 헤더: 상황·언어 요약 + 새대화(+) + 지난대화(시계). shrink-0으로 고정 -->
		<header class="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
			<p class="min-w-0 truncate text-xs font-medium text-zinc-400">
				{scenario.label} · {langMeta[practiceLang].label}
			</p>
			<div class="flex shrink-0">
				<!-- 새 대화: 지금 세션을 비우고(히스토리에 남긴 뒤) 같은 상황으로 다시 시작 -->
				<button
					type="button"
					class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
					onclick={() => startNewChat()}
					disabled={isListening || isThinking}
					aria-label="새 대화"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"
						><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" /></svg
					>
				</button>
				<!-- 시계: showHistory 토글 → 아래 지난 세션 목록 열고 닫기 -->
				<button
					type="button"
					class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
					onclick={() => (showHistory = !showHistory)}
					aria-label="지난 대화"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" />
					</svg>
				</button>
			</div>
		</header>

		<!--
			말풍선 스크롤 영역
			- overscroll-contain: 끝에서 스크롤해도 바깥 페이지가 덜 따라옴
			- bind:this: 새 메시지 후 맨 아래로 스크롤할 때 사용
		-->
		<div
			bind:this={chatScrollEl}
			class="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain p-3"
		>
			{#if messages.length === 0 && !isThinking}
				<!-- 빈 화면 안내를 카드 한가운데(m-auto)에 배치 -->
				<p class="m-auto px-3 text-center text-xs leading-5 text-zinc-500">
					상황을 고르고 말해 보세요.
				</p>
			{/if}
			{#each messages as item (item.createdAt)}
				<!-- user=오른쪽(나), bot=왼쪽(AI) — 메신저 정렬 -->
				<div class="flex {item.role === 'user' ? 'justify-end' : 'justify-start'}">
					<!--
						말풍선
						- max-w-[88%]: 너무 넓지 않게
						- 나=분홍(rose), AI=흰 반투명
						- rounded-br-md / rounded-bl-md: 말 나가는 쪽 모서리만 덜 둥글게
					-->
					<article
						class="max-w-[88%] rounded-2xl px-3 py-2 {item.role === 'user'
							? 'rounded-br-md bg-rose-500/90 text-white'
							: 'rounded-bl-md bg-white/10 text-zinc-100'}"
					>
						<!-- 위줄: ‘나/AI’ 라벨 + (AI면) 다시 듣기 -->
						<div class="mb-0.5 flex items-center justify-between gap-2">
							<p
								class="text-[10px] font-medium {item.role === 'user'
									? 'text-rose-100/80'
									: 'text-zinc-500'}"
							>
								{item.role === 'user' ? '나' : 'AI'}
								<!-- speakingAt이 이 말풍선이면 “말하는 중” 표시 (TTS 재생 중) -->
								{#if item.role === 'bot' && speakingAt === item.createdAt}· 말하는 중{/if}
							</p>
							{#if item.role === 'bot'}
								<button
									type="button"
									class="text-[10px] text-zinc-400 hover:text-white"
									onclick={() => speakBot(item.text, item.createdAt)}
								>
									다시 듣기
								</button>
							{/if}
						</div>
						<!-- 본문: 내가 말한 글 또는 AI 답변 -->
						<p class="text-sm font-medium leading-6 break-words">{item.text}</p>
						{#if item.note}
							<!-- note: 교정·힌트 같은 보조 줄 (있을 때만) -->
							<p
								class="mt-1 text-[11px] leading-4 break-words {item.role === 'user'
									? 'text-rose-100/75'
									: 'text-zinc-500'}"
							>
								{item.note}
							</p>
						{/if}
					</article>
				</div>
			{/each}
			{#if isThinking}
				<!-- API 응답 대기 중 표시 (말풍선 대신 짧은 안내) -->
				<p class="text-xs text-zinc-500">AI가 입력 중…</p>
			{/if}
		</div>

		<!-- 지난 세션 목록: 시계 버튼으로 열림 -->
		{#if showHistory}
			<!--
				max-h-36: 히스토리가 채팅을 다 덮지 않게 높이 제한
				overflow-y-auto: 세션이 많으면 이 칸만 스크롤
			-->
			<div class="max-h-36 shrink-0 overflow-y-auto border-t border-white/10 bg-black/20 p-2">
				{#if historySessions.length}
					{#each historySessions as session (session.id)}
						<!--
							한 세션 한 줄
							- 지금 보고 있는 세션이면 bg-white/15로 강조
							- 오른쪽 숫자: 그 세션의 메시지 개수
						-->
						<button
							type="button"
							class="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs {session.id ===
							activeSessionId
								? 'bg-white/15 text-white'
								: 'text-zinc-300 hover:bg-white/10'}"
							onclick={() => selectSession(session.id)}
						>
							<span class="min-w-0 truncate">{formatSessionTitle(session)}</span>
							<span class="shrink-0 text-zinc-500">{session.messages.length}</span>
						</button>
					{/each}
				{:else}
					<p class="px-2 py-3 text-xs text-zinc-500">지난 대화가 없어요.</p>
				{/if}
			</div>
		{/if}
	</section>

	<!-- 하단: 마이크 + 상태문구 + 직접 입력. shrink-0이라 채팅이 늘어나도 항상 보임 -->
	<div class="shrink-0 space-y-2 px-3 py-2 sm:px-4">
		<div class="flex items-center gap-2">
			<!--
				마이크 토글
				- h-12 w-12 rounded-full: 크게 눌러 쉽게
				- 듣는 중=흰 배경(정지 느낌), 대기=빨간 배경(녹음 시작)
				- isThinking이면 disabled: 답 오는 중에 또 녹음하지 않게
			-->
			<button
				type="button"
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg {isListening
					? 'bg-white text-red-500'
					: 'bg-red-500 text-white'}"
				onclick={toggleMicrophone}
				disabled={isThinking}
				aria-label={isListening ? '말하기 종료' : '말하기 시작'}
			>
				{#if isListening || isThinking}
					<!-- 네모 아이콘: “지금 듣거나 처리 중” -->
					<span class="h-4 w-4 rounded-sm bg-current"></span>
				{:else}
					<svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"
						><path
							d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
						/></svg
					>
				{/if}
			</button>
			<!-- flex-1 min-w-0: 긴 상태 문구가 마이크를 밀지 않고 줄바꿈 -->
			<p
				class="min-w-0 flex-1 text-xs leading-4 break-words {isListening
					? 'text-red-200'
					: 'text-zinc-400'}"
			>
				{statusText}
			</p>
		</div>

		<!-- 직접 입력 폼: 마이크 없이도 같은 회화 API로 보냄 -->
		<form
			class="flex items-end gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 p-2"
			onsubmit={(event) => {
				// form 기본 submit(페이지 새로고침) 막기
				event.preventDefault();
				void submitManual();
			}}
		>
			<!-- sr-only: 화면엔 안 보이지만 스크린리더용 라벨 -->
			<label class="sr-only" for="chatbot-input">회화 입력</label>
			<!--
				- max-h-28: 여러 줄은 되지만 화면을 다 먹지는 않음
				- resize-none: 사용자가 상자 크기를 드래그로 못 바꾸게 (레이아웃 고정)
				- bg-transparent: 바깥 폼 배경만 보이게
			-->
			<textarea
				id="chatbot-input"
				class="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-white placeholder:text-zinc-500 outline-none disabled:opacity-50"
				placeholder="직접 입력…"
				bind:value={manualText}
				onkeydown={onManualKeydown}
				disabled={isListening || isThinking}
				rows="1"
			></textarea>
			<!-- 빈 글·듣/생각 중이면 disabled:opacity-40 -->
			<button
				type="submit"
				class="shrink-0 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-zinc-900 disabled:opacity-40"
				disabled={isListening || isThinking || !manualText.trim()}
			>
				보내기
			</button>
		</form>
		<!--
			과금 체감용 한 줄 (text-[10px]로 아주 작게)
			오늘 이 기기에서 성공한 API 횟수·토큰. 실제 청구 금액은 OpenAI Usage 기준
		-->
		<p class="px-0.5 text-[10px] leading-4 text-zinc-600" title="이 기기 기준 · 실제 금액은 OpenAI Usage">
			{usageLine}
		</p>
	</div>

	<!-- 개발 모드에서만 마이크/보안/오류 디버그 줄 -->
	<DebugPanel lines={debugLines} />
</div>

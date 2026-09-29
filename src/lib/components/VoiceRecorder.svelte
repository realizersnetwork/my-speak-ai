<script>
	import { onDestroy } from 'svelte';

	/** @type {'idle' | 'recording' | 'paused' | 'ready'} */
	let status = $state('idle');
	let error = $state('');
	let elapsedMs = $state(0);
	let playbackTime = $state(0);
	let duration = $state(0);
	let audioUrl = $state('');
	let fileSize = $state(0);
	let mimeType = $state('');
	let isPlaying = $state(false);
	let levels = $state(/** @type {number[]} */ (Array.from({ length: 28 }, () => 0.08)));

	/** @type {HTMLAudioElement | undefined} */
	let audioEl = $state();
	/** @type {MediaRecorder | null} */
	let recorder = null;
	/** @type {MediaStream | null} */
	let stream = null;
	/** @type {Blob[]} */
	let chunks = [];
	/** @type {number | null} */
	let timerId = null;
	/** @type {number | null} */
	let visualRaf = null;
	/** @type {AudioContext | null} */
	let audioContext = null;
	/** @type {AnalyserNode | null} */
	let analyser = null;
	/** @type {Uint8Array | null} */
	let frequencyData = null;
	let startedAt = 0;
	let accumulatedMs = 0;

	const canRecord = $derived(status === 'idle' || status === 'ready');
	const isLive = $derived(status === 'recording' || status === 'paused');

	function formatTime(ms) {
		const total = Math.max(0, Math.floor(ms / 1000));
		const m = Math.floor(total / 60)
			.toString()
			.padStart(2, '0');
		const s = (total % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	function pickMimeType() {
		const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
		return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
	}

	function stopTimer() {
		if (timerId !== null) {
			clearInterval(timerId);
			timerId = null;
		}
	}

	function startTimer() {
		stopTimer();
		startedAt = Date.now();
		timerId = setInterval(() => {
			elapsedMs = accumulatedMs + (Date.now() - startedAt);
		}, 80);
	}

	function stopVisualizer() {
		if (visualRaf !== null) {
			cancelAnimationFrame(visualRaf);
			visualRaf = null;
		}
		levels = Array.from({ length: 28 }, () => 0.08);
	}

	function tickVisualizer() {
		if (!analyser || !frequencyData) return;
		analyser.getByteFrequencyData(frequencyData);
		const bucket = Math.floor(frequencyData.length / levels.length);
		levels = levels.map((_, i) => {
			let sum = 0;
			for (let j = 0; j < bucket; j++) sum += frequencyData[i * bucket + j];
			return Math.max(0.08, Math.min(1, sum / bucket / 180));
		});
		visualRaf = requestAnimationFrame(tickVisualizer);
	}

	async function setupAudioGraph(mediaStream) {
		audioContext = new AudioContext();
		if (audioContext.state === 'suspended') await audioContext.resume();
		analyser = audioContext.createAnalyser();
		analyser.fftSize = 128;
		frequencyData = new Uint8Array(analyser.frequencyBinCount);
		const source = audioContext.createMediaStreamSource(mediaStream);
		source.connect(analyser);
		tickVisualizer();
	}

	function revokeUrl() {
		if (audioUrl) URL.revokeObjectURL(audioUrl);
		audioUrl = '';
	}

	async function releaseStream() {
		stopVisualizer();
		stream?.getTracks().forEach((track) => track.stop());
		stream = null;
		await audioContext?.close().catch(() => {});
		audioContext = null;
		analyser = null;
		frequencyData = null;
	}

	function resetPlayback() {
		isPlaying = false;
		playbackTime = 0;
		duration = 0;
		if (audioEl) {
			audioEl.pause();
			audioEl.currentTime = 0;
		}
	}

	async function startRecording() {
		error = '';
		if (!navigator.mediaDevices?.getUserMedia) {
			error = '이 브라우저에서는 마이크 녹음을 지원하지 않습니다.';
			return;
		}

		try {
			resetPlayback();
			revokeUrl();
			chunks = [];
			elapsedMs = 0;
			accumulatedMs = 0;
			fileSize = 0;

			stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true }
			});
			mimeType = pickMimeType();
			recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
			mimeType = recorder.mimeType || mimeType;

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunks.push(event.data);
			};
			recorder.onstop = async () => {
				stopTimer();
				const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
				fileSize = blob.size;
				revokeUrl();
				audioUrl = URL.createObjectURL(blob);
				status = 'ready';
				await releaseStream();
			};
			recorder.onerror = () => {
				error = '녹음 중 오류가 발생했습니다. 다시 시도해 주세요.';
				status = 'idle';
			};

			await setupAudioGraph(stream);
			recorder.start(200);
			status = 'recording';
			startTimer();
		} catch (err) {
			await releaseStream();
			status = 'idle';
			if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
				error = '마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.';
			} else if (err instanceof DOMException && err.name === 'NotFoundError') {
				error = '사용 가능한 마이크를 찾지 못했습니다.';
			} else {
				error = '마이크에 연결하지 못했습니다.';
			}
		}
	}

	function pauseRecording() {
		if (recorder?.state !== 'recording') return;
		recorder.pause();
		accumulatedMs += Date.now() - startedAt;
		stopTimer();
		status = 'paused';
	}

	function resumeRecording() {
		if (recorder?.state !== 'paused') return;
		recorder.resume();
		status = 'recording';
		startTimer();
	}

	function stopRecording() {
		if (!recorder || (recorder.state !== 'recording' && recorder.state !== 'paused')) return;
		if (recorder.state === 'paused') {
			accumulatedMs += 0;
			elapsedMs = accumulatedMs;
		} else {
			elapsedMs = accumulatedMs + (Date.now() - startedAt);
		}
		recorder.stop();
		recorder = null;
	}

	function discardRecording() {
		resetPlayback();
		revokeUrl();
		chunks = [];
		elapsedMs = 0;
		fileSize = 0;
		status = 'idle';
		error = '';
	}

	function togglePlayback() {
		if (!audioEl) return;
		if (audioEl.paused) {
			audioEl.play();
		} else {
			audioEl.pause();
		}
	}

	function onTimeUpdate() {
		if (!audioEl) return;
		playbackTime = audioEl.currentTime * 1000;
		if (Number.isFinite(audioEl.duration)) duration = audioEl.duration * 1000;
	}

	function onLoadedMeta() {
		if (!audioEl || !Number.isFinite(audioEl.duration)) return;
		duration = audioEl.duration * 1000;
	}

	function seek(event) {
		if (!audioEl || !duration) return;
		const value = Number(event.currentTarget.value);
		audioEl.currentTime = value / 1000;
		playbackTime = value;
	}

	function download() {
		if (!audioUrl) return;
		const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
		const link = document.createElement('a');
		link.href = audioUrl;
		link.download = `voice-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
		link.click();
	}

	onDestroy(async () => {
		stopTimer();
		if (recorder && recorder.state !== 'inactive') recorder.stop();
		await releaseStream();
		revokeUrl();
	});
</script>

<section
	class="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-violet-950/40 backdrop-blur-md sm:p-8"
>
	<div class="flex items-start justify-between gap-4">
		<div>
			<p class="text-sm font-medium tracking-wide text-violet-200/80">VOICE INPUT</p>
			<h2 class="mt-1 text-2xl font-semibold text-white">내 목소리 녹음</h2>
			<p class="mt-2 text-sm leading-6 text-zinc-300">
				마이크 버튼을 눌러 녹음한 뒤, 바로 재생해서 확인할 수 있습니다.
			</p>
		</div>
		<div
			class="shrink-0 rounded-full px-3 py-1 text-xs font-medium
				{status === 'recording'
				? 'bg-rose-500/20 text-rose-200'
				: status === 'paused'
					? 'bg-amber-500/20 text-amber-200'
					: status === 'ready'
						? 'bg-emerald-500/20 text-emerald-200'
						: 'bg-zinc-700/60 text-zinc-300'}"
		>
			{status === 'recording'
				? '녹음 중'
				: status === 'paused'
					? '일시정지'
					: status === 'ready'
						? '확인 가능'
						: '대기'}
		</div>
	</div>

	<div class="mt-8 flex h-16 items-end justify-center gap-1" aria-hidden="true">
		{#each levels as level, i (i)}
			<span
				class="w-1.5 rounded-full transition-[height] duration-75 {status === 'recording'
					? 'bg-violet-300'
					: 'bg-zinc-500/70'}"
				style="height: {isLive ? level * 64 : 8}px"
			></span>
		{/each}
	</div>

	<p class="mt-5 text-center font-mono text-4xl tabular-nums tracking-widest text-white">
		{formatTime(isLive ? elapsedMs : duration || elapsedMs)}
	</p>
	<p class="mt-1 text-center text-xs text-zinc-400">
		{#if status === 'ready'}
			길이 {formatTime(duration || elapsedMs)}
			{#if fileSize}· {(fileSize / 1024).toFixed(1)} KB{/if}
		{:else if status === 'recording'}
			말하는 동안 파형이 움직입니다
		{:else if status === 'paused'}
			이어서 녹음하거나 종료할 수 있습니다
		{:else}
			녹음을 시작하면 시간이 표시됩니다
		{/if}
	</p>

	<div class="mt-8 flex flex-wrap items-center justify-center gap-3">
		{#if canRecord}
			<button
				type="button"
				class="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition hover:bg-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200"
				onclick={startRecording}
				aria-label="녹음 시작"
			>
				<svg class="h-8 w-8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path
						d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
					/>
				</svg>
			</button>
		{/if}

		{#if status === 'recording'}
			<button
				type="button"
				class="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
				onclick={pauseRecording}
			>
				일시정지
			</button>
			<button
				type="button"
				class="flex h-20 w-20 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-400"
				onclick={stopRecording}
				aria-label="녹음 종료"
			>
				<span class="h-6 w-6 rounded-sm bg-white"></span>
			</button>
		{/if}

		{#if status === 'paused'}
			<button
				type="button"
				class="rounded-full bg-violet-500 px-5 py-2 text-sm font-medium text-white hover:bg-violet-400"
				onclick={resumeRecording}
			>
				이어 녹음
			</button>
			<button
				type="button"
				class="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-400"
				onclick={stopRecording}
				aria-label="녹음 종료"
			>
				<span class="h-5 w-5 rounded-sm bg-white"></span>
			</button>
		{/if}
	</div>

	{#if status === 'ready' && audioUrl}
		<div class="mt-8 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
			<p class="text-sm font-medium text-zinc-200">녹음 확인</p>
			<audio
				bind:this={audioEl}
				src={audioUrl}
				preload="metadata"
				onplay={() => (isPlaying = true)}
				onpause={() => (isPlaying = false)}
				onended={() => (isPlaying = false)}
				ontimeupdate={onTimeUpdate}
				onloadedmetadata={onLoadedMeta}
			></audio>

			<div class="flex items-center gap-3">
				<button
					type="button"
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-zinc-200"
					onclick={togglePlayback}
					aria-label={isPlaying ? '일시정지' : '재생'}
				>
					{#if isPlaying}
						<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M7 5h3v14H7V5Zm7 0h3v14h-3V5Z" />
						</svg>
					{:else}
						<svg class="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M8 5v14l11-7L8 5Z" />
						</svg>
					{/if}
				</button>
				<input
					class="h-1.5 w-full cursor-pointer accent-violet-400"
					type="range"
					min="0"
					max={Math.max(duration, elapsedMs, 1)}
					step="50"
					value={playbackTime}
					oninput={seek}
					aria-label="재생 위치"
				/>
				<span class="w-12 shrink-0 text-right font-mono text-xs text-zinc-400">
					{formatTime(playbackTime)}
				</span>
			</div>

			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
					onclick={togglePlayback}
				>
					{isPlaying ? '일시정지' : '다시 듣기'}
				</button>
				<button
					type="button"
					class="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
					onclick={startRecording}
				>
					다시 녹음
				</button>
				<button
					type="button"
					class="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
					onclick={download}
				>
					파일 저장
				</button>
				<button
					type="button"
					class="rounded-full px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10"
					onclick={discardRecording}
				>
					삭제
				</button>
			</div>
		</div>
	{/if}

	{#if error}
		<p class="mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100" role="alert">
			{error}
		</p>
	{/if}
</section>

<script>
	/**
	 * 개발 서버(npm run dev)에서만 보이는 디버그 패널
	 * @type {{ lines: string[] }}
	 */
	let { lines = [] } = $props();

	const enabled = import.meta.env.DEV;
</script>

{#if enabled && lines.length}
	<details
		class="mx-3 mb-2 shrink-0 rounded-lg border border-amber-500/30 bg-amber-950/40 px-2 py-1.5 sm:mx-4"
	>
		<summary class="cursor-pointer select-none text-[10px] font-medium tracking-wide text-amber-200/90">
			DEBUG · 개발 전용
		</summary>
		<ul class="mt-1 space-y-0.5 font-mono text-[10px] leading-4 text-amber-100/80">
			{#each lines as line, i (i)}
				<li class="break-all">{line}</li>
			{/each}
		</ul>
	</details>
{/if}

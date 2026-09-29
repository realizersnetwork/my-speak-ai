<!--
	+layout.svelte — 앱 전체의 “겉껍데기”입니다.

	무엇을 하나요?
	- 모든 페이지(+page) 위에 공통 헤더(브랜드 + Translate/Talking 메뉴)를 그립니다.
	- 다크 배경·빨간 그라데이션 분위기를 한곳에서 정해, 하위 페이지가 통일되게 보이게 합니다.
	- children 자리에 /translate, /chatbot 등 실제 화면이 들어갑니다.

	왜 레이아웃에 높이·스크롤을 잠그나요?
	- 채팅/번역 화면은 “안쪽만 스크롤”이 중요합니다.
	  바깥(이 파일)이 h-dvh + overflow-hidden 이어야 모바일에서 주소창·키보드에
	  전체 페이지가 출렁이지 않습니다.
-->
<script>
	import { page } from '$app/state';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	/** 하위 라우트(+page)가 여기에 렌더됩니다 */
	let { children } = $props();

	/**
	 * 상단 탭 메뉴.
	 * - href: 이동 경로
	 * - label: 탭에 보이는 짧은 이름
	 * - aria/title: 길이가 짧아 의미가 덜 보일 때(스크린리더·툴팁) 쓰는 풀네임
	 */
	const menus = [
		{ href: '/translate', label: 'Translate', aria: 'My Translate' },
		{ href: '/chatbot', label: 'Talking', aria: 'My Talking AI' }
	];
</script>

<!-- 브라우저 탭 아이콘 -->
<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<!--
	루트 셸:
	- h-dvh: 동적 뷰포트 높이(모바일 브라우저 UI 변화 반영)로 화면을 꽉 채움
	- flex-col: 위=헤더, 아래=본문
	- overflow-hidden: 바깥 스크롤 금지 → 안쪽 채팅만 스크롤
	- bg-zinc-950 text-zinc-100: 거의 검정 배경 + 밝은 글씨(다크 UI)
	- radial-gradient(...red...): 위쪽에만 옅은 빨간 빛 — 브랜드 포인트, 전체가 납작한 검정처럼 안 보이게
	- safe-area padding: 아이폰 노치·홈바에 글자/버튼이 가리지 않게
-->
<div
	class="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100 [background-image:radial-gradient(circle_at_top,_rgba(239,68,68,0.18),_transparent_42%)]"
	style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom)"
>
	<!-- shrink-0: 헤더는 높이 고정, 본문이 줄어들며 스크롤 -->
	<header class="shrink-0 border-b border-white/10 px-3 py-2 sm:px-4">
		<!-- max-w-3xl: 본문과 같은 가로 폭으로 맞춰 큰 모니터에서 메뉴가 너무 안 벌어지게 -->
		<div class="mx-auto flex max-w-3xl items-center justify-between gap-2">
			<!-- truncate: 좁은 화면에서 긴 브랜드명이 메뉴를 밀지 않게 말줄임 -->
			<p class="truncate text-sm font-semibold tracking-tight text-white sm:text-base">My Speak AI</p>
			<!--
				탭 묶음:
				- rounded-full + border: 알약형 세그먼트 컨트롤처럼 보이게
				- bg-zinc-900/80: 반투명 어두운 받침
			-->
			<nav
				class="flex shrink-0 gap-0.5 rounded-full border border-white/10 bg-zinc-900/80 p-0.5"
				aria-label="서비스 메뉴"
			>
				{#each menus as item (item.href)}
					<a
						href={item.href}
						aria-label={item.aria}
						title={item.aria}
						class="rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm {page.url.pathname.startsWith(
							item.href
						)
							? 'bg-white text-zinc-900'
							: 'text-zinc-400 hover:bg-white/10 hover:text-white'}"
					>
						<!-- 활성 탭=흰 배경(지금 어디인지 한눈에), 비활성=회색·호버 시 밝아짐 -->
						{item.label}
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<!--
		본문 래퍼:
		- min-h-0 flex-1: 헤더 아래 남은 높이를 전부 주고, 자식이 min-h-0으로 내부 스크롤 가능
		- max-w-3xl mx-auto: 가로 최대폭 제한(말풍선·채팅이 너무 넓어지지 않게)
		- w-full: 좁은 화면에서는 가로를 꽉 씀
	-->
	<div class="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
		{@render children()}
	</div>
</div>

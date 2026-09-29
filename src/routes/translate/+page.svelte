<!--
	/translate (+page) — “My Translate” 실시간 대화 번역 화면 진입점입니다.

	무엇을 하나요?
	- 브라우저 탭 제목을 Translate용으로 바꾸고,
	- 실제 마이크·번역·말풍선·저장 UI는 ConversationStudy 컴포넌트에 맡깁니다.

	왜 페이지는 이렇게 얇은가요?
	- 공통 껍데기(+layout)와 기능 본체(ConversationStudy)를 나누면
	  메뉴/배경을 고쳐도 번역 로직을 건드리지 않아도 됩니다.
-->
<script>
	import ConversationStudy from '$lib/components/ConversationStudy.svelte';
</script>

<svelte:head><title>My Translate · My Speak AI</title></svelte:head>

<!--
	main:
	- flex-1 min-h-0: 레이아웃이 준 세로 공간을 채우고, 안쪽만 스크롤
	- flex-col: ConversationStudy의 메신저형 세로 배치를 그대로 받음
-->
<main class="flex min-h-0 flex-1 flex-col">
	<ConversationStudy />
</main>

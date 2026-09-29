<!--
	/chatbot (+page) — “My Talking AI” 회화 연습 화면 진입점입니다.

	무엇을 하나요?
	- 브라우저 탭 제목을 Talking용으로 바꾸고,
	- 실제 UI·마이크·AI 답변 로직은 ConversationChatbot 컴포넌트에 맡깁니다.

	왜 페이지는 이렇게 얇은가요?
	- 레이아웃(+layout)이 이미 헤더·배경·높이를 담당하므로,
	  여기선 “남는 높이를 채우는 main”만 두고 본체를 끼워 넣으면 됩니다.
-->
<script>
	import ConversationChatbot from '$lib/components/ConversationChatbot.svelte';
</script>

<svelte:head><title>My Talking AI · My Speak AI</title></svelte:head>

<!--
	main:
	- flex-1 min-h-0: 레이아웃 본문 높이를 꽉 채우되, 안쪽 채팅만 스크롤되게
	- flex-col: ConversationChatbot이 세로로 툴바·채팅·입력을 쌓을 수 있게
-->
<main class="flex min-h-0 flex-1 flex-col">
	<ConversationChatbot />
</main>

/**
 * 채팅 하단 입력 View.
 * 글자를 치고 “전송”하면 부모(ChatView)의 onSubmit이 Nest로 질문을 보냅니다.
 */
import { type FormEvent } from 'react';

type Props = {
	/** 입력창에 보이는 글자 (부모가 소유한 상태) */
	value: string;
	/** true면 입력·전송 잠금 (AI 답 기다리는 중) */
	loading: boolean;
	/** 타이핑할 때마다 부모 상태를 갱신 */
	onChange: (v: string) => void;
	/** form submit 시 호출 (페이지 새로고침 없이 전송) */
	onSubmit: (e: FormEvent) => void;
};

/** 하단 입력창 + 전송 버튼 */
export function UserInputView({ value, loading, onChange, onSubmit }: Props) {
	return (
		// chat-form: 입력 + 버튼을 가로로 배치하는 하단 바 (스타일은 ChatView.css)
		<form className="chat-form" onSubmit={onSubmit}>
			<input
				type="text"
				value={value}
				// 칠 때마다 부모 input 상태 갱신 → 화면 글자도 같이 바뀜
				onChange={(e) => onChange(e.target.value)}
				placeholder="메시지를 입력하세요…"
				// 로딩 중엔 타이핑 불가 (답이 오기 전에 또 보내지 않게)
				disabled={loading}
				// 브라우저가 예전 입력을 자동완성하지 않게
				autoComplete="off"
				// 스크린 리더용 이름
				aria-label="메시지 입력"
			/>
			<button
				type="submit"
				// 로딩 중이거나 공백만 있으면 전송 불가
				disabled={loading || !value.trim()}
			>
				전송
			</button>
		</form>
	);
}

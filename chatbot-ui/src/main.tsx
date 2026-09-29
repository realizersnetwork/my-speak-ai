/**
 * 이 파일은 React 앱을 브라우저 화면에 “처음 붙이는” 입구입니다.
 * HTML의 #root 칸을 찾아 App 컴포넌트를 그려 넣습니다.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 전역 기본 글자·배경 스타일 (앱 전체 공통)
import './index.css';
// 실제 화면(탭·챗봇·테스트 페이지)을 담는 최상위 컴포넌트
import App from './App.tsx';

// document.getElementById('root')! : index.html 안의 <div id="root">를 찾음
// createRoot(...).render(...) : 그 안에 React 트리를 그림
createRoot(document.getElementById('root')!).render(
	// StrictMode: 개발 중에 잘못된 사용을 더 잘 잡기 위해 일부 로직을 두 번 돌리기도 함
	// 배포(프로덕션) 동작은 같게 두고, 개발 품질만 높이는 안전장치
	<StrictMode>
		<App />
	</StrictMode>
);

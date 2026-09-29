/**
 * Nest 서버를 켜는 시작점(진입점).
 * React chatbot-ui·Postman이 여기로 API를 보냄.
 * 이 파일에서: DTO 검증 파이프, CORS, 포트, 로거를 한 번에 설정한다.
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/app-logger.service';

/** 서버를 실제로 만들고 포트에 묶는 함수 — 맨 아래에서 한 번 호출됨 */
async function bootstrap() {
	// bufferLogs:true → 앱이 완전히 뜨기 전 로그를 모아 두었다가 커스텀 로거로 넘김
	const app = await NestFactory.create(AppModule, { bufferLogs: true });
	// DI 컨테이너에서 AppLogger를 꺼내 Nest 기본 로거 대신 씀
	const logger = app.get(AppLogger);
	app.useLogger(logger);

	// 모든 요청 body를 ValidationPipe로 검사 (DTO class-validator 규칙 적용)
	app.useGlobalPipes(
		new ValidationPipe({
			// whitelist:true → DTO에 없는 필드는 버림 (이상한/악의적 요청 방지)
			whitelist: true,
			// forbidNonWhitelisted:true → 허용 목록 밖 필드가 오면 400 에러 (조용히 버리지 않음)
			forbidNonWhitelisted: true,
			// transform:true → plain JSON을 DTO 클래스 인스턴스로 바꿔 getter 등 사용 가능
			transform: true
		})
	);
	// CORS 허용 — React(chatbot-ui) localhost:5173 등 다른 origin에서도 API 호출 가능
	app.enableCors();

	// 포트: .env의 PORT가 있으면 그걸 쓰고, 없으면 3000
	// 3000인 이유: 과제 표본 lim-server와 맞춰 Postman 테스트하기 쉽게
	const port = Number(process.env.PORT) || 3000;
	await app.listen(port);
	// 기동 성공 로그 — 채팅 API 경로를 바로 보여 줌
	logger.log(`서버 시작 · http://localhost:${port}/openai/chat`, 'Bootstrap');
}

// 이 파일을 node/nest가 실행하면 바로 서버를 켠다
bootstrap();

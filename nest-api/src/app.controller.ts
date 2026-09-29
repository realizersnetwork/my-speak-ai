/**
 * 루트 경로(/)용 컨트롤러.
 * 서버가 살아 있는지 간단히 확인하는 “헬스/인사” 엔드포인트를 제공한다.
 * 실제 AI 채팅은 openai.controller.ts 쪽(/openai/...)에서 처리한다.
 */
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/** @Controller() → 경로 접두사 없음 = http://localhost:3000/ */
@Controller()
export class AppController {
	/** Nest가 AppService를 자동 주입(DI) — 문구를 Service에 둬 컨트롤러는 얇게 유지 */
	constructor(private readonly appService: AppService) {}

	/** GET / — “서버 켜짐” 확인용 문자열 반환 */
	@Get()
	getHello(): string {
		return this.appService.getHello();
	}
}

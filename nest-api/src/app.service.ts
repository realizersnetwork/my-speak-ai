/**
 * 루트 GET(/)에 돌려줄 문구를 담는 서비스.
 * 비즈니스 로직은 없고, 컨트롤러가 바로 문자열을 쓰지 않도록 한 줄 분리용이다.
 */
import { Injectable } from '@nestjs/common';

/** @Injectable() → Nest DI 컨테이너에 등록되어 컨트롤러에 주입됨 */
@Injectable()
export class AppService {
	/** 브라우저·Postman에서 GET / 했을 때 보이는 서버 식별 문구 */
	getHello(): string {
		return 'My Speak AI Nest Server';
	}
}

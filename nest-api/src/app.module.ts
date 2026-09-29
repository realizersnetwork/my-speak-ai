/**
 * Nest 앱의 루트(최상위) 모듈.
 * 어떤 컨트롤러·서비스를 쓸지, .env를 어디서 읽을지, OpenAI 기능을 붙일지를 여기서 조립한다.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppLogger } from './common/logger/app-logger.service';
import { OpenaiModule } from './openai/openai.module';

/**
 * AppModule — 전체 앱의 “부품 목록”
 * - ConfigModule: .env의 OPENAI_API_KEY, REDIS_URL 등을 어디서든 읽게 함
 * - OpenaiModule: 채팅·RAG·캐싱·스트리밍 API
 * - AppController/AppService: 루트(/) 헬스 확인용
 * - AppLogger: 콘솔에 시각·컨텍스트를 붙인 로그
 */
@Module({
	imports: [
		ConfigModule.forRoot({
			// isGlobal:true → 다른 모듈에서 ConfigModule을 또 import하지 않아도 process.env / ConfigService 사용 가능
			isGlobal: true,
			// nest-api/.env를 먼저 보고, 없으면 상위 프로젝트(my-speak-ai/.env)를 봄
			envFilePath: ['.env', '../.env']
		}),
		// 채팅·지식검색·문맥캐시 기능을 한 덩어리로 가져옴
		OpenaiModule
	],
	// 루트 URL(/) 응답을 담당하는 컨트롤러
	controllers: [AppController],
	// 루트 서비스 + 전역에서 쓰는 로거
	providers: [AppService, AppLogger]
})
export class AppModule {}

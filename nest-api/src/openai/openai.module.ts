/**
 * OpenAI 기능 묶음 모듈.
 * 채팅 컨트롤러·서비스를 등록하고, Redis(문맥)·RAG(지식검색) 모듈을 가져와 Service에 주입 가능하게 한다.
 */
import { Module } from '@nestjs/common';
import { OpenaiController } from './openai.controller';
import { OpenaiService } from './openai.service';
import { AppLogger } from '../common/logger/app-logger.service';
import { RedisModule } from '../redis/redis.module';
import { RagModule } from '../rag/rag.module';

/**
 * OpenaiModule
 * imports: RedisModule(대화 캐시), RagModule(문서 검색)
 * controllers: HTTP /openai/* 진입
 * providers: 실제 API 호출 로직 + 로거
 * exports: 다른 모듈에서 OpenaiService를 쓰고 싶을 때 재사용
 */
@Module({
	imports: [RedisModule, RagModule],
	controllers: [OpenaiController],
	providers: [OpenaiService, AppLogger],
	exports: [OpenaiService]
})
export class OpenaiModule {}

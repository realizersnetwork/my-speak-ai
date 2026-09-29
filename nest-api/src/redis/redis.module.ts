/**
 * 대화 문맥 캐시(Redis/메모리)를 Nest에 등록하는 모듈.
 * OpenaiModule이 이 모듈을 import해 ConversationCacheService를 주입받는다.
 */
import { Module } from '@nestjs/common';
import { AppLogger } from '../common/logger/app-logger.service';
import { ConversationCacheService } from './conversation-cache.service';

@Module({
	// ConversationCacheService: 실제 저장/조회 / AppLogger: 연결·저장 로그
	providers: [ConversationCacheService, AppLogger],
	// exports: 다른 모듈(OpenaiModule)에서 캐시 서비스를 쓸 수 있게 공개
	exports: [ConversationCacheService]
})
export class RedisModule {}

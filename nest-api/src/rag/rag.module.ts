/**
 * RAG(임베딩·벡터/메모리 검색)를 Nest에 등록하는 모듈.
 * OpenaiModule이 import해 RagService를 채팅·지식 API에 주입한다.
 */
import { Module } from '@nestjs/common';
import { AppLogger } from '../common/logger/app-logger.service';
import { RagService } from './rag.service';

@Module({
	// RagService: 인덱싱·검색 / AppLogger: 인덱싱·검색 로그
	providers: [RagService, AppLogger],
	// exports: OpenaiService 등에서 RagService 주입 가능
	exports: [RagService]
})
export class RagModule {}

/**
 * 앱 전역에서 쓰는 간단한 로깅 서비스.
 * Nest ConsoleLogger를 확장해 메시지 앞에 ISO 시각을 붙여,
 * “언제·어떤 컨텍스트에서” 로그가 났는지 콘솔에서 추적하기 쉽게 한다.
 */
import { ConsoleLogger, Injectable, LogLevel, Scope } from '@nestjs/common';

/**
 * Scope.DEFAULT = 싱글톤 — 요청마다 새 인스턴스를 만들지 않음
 * main.ts에서 app.useLogger(logger)로 Nest 기본 로거를 교체
 */
@Injectable({ scope: Scope.DEFAULT })
export class AppLogger extends ConsoleLogger {
	/**
	 * PID(프로세스 번호) 출력 끄기
	 * 과제·로컬 콘솔에서는 시각·메시지가 더 중요해서 빈 문자열 반환
	 */
	protected formatPid() {
		return '';
	}

	/** 일반 정보 로그 (기동, 요청 도착, 완료 등) */
	log(message: unknown, context?: string) {
		super.log(this.withStamp(message), context);
	}

	/**
	 * 에러 로그
	 * stackOrContext: 스택 트레이스 또는 컨텍스트( Nest ConsoleLogger 시그니처 호환 )
	 */
	error(message: unknown, stackOrContext?: string, context?: string) {
		super.error(this.withStamp(message), stackOrContext, context);
	}

	/** 경고 — 키 없음, Redis 폴백 등 “동작은 하지만 주의” */
	warn(message: unknown, context?: string) {
		super.warn(this.withStamp(message), context);
	}

	/** 디버그 — 상세 개발용 (기본 레벨에서는 안 보일 수 있음) */
	debug(message: unknown, context?: string) {
		super.debug(this.withStamp(message), context);
	}

	/** 더 자세한 verbose 레벨 (지원 시) */
	verbose(message: unknown, context?: string) {
		super.verbose?.(this.withStamp(message), context);
	}

	/** 어떤 레벨을 콘솔에 낼지 Nest에 전달 (log/warn/error 등) */
	setLogLevels(levels: LogLevel[]) {
		super.setLogLevels(levels);
	}

	/**
	 * ISO 시각을 앞에 붙여 추적하기 쉽게
	 * 예: [2026-09-22T02:20:00.000Z] 서버 시작 · ...
	 */
	private withStamp(message: unknown): string {
		const stamp = new Date().toISOString();
		return `[${stamp}] ${String(message)}`;
	}
}

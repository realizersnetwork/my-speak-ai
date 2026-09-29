import { ConsoleLogger, LogLevel } from '@nestjs/common';
export declare class AppLogger extends ConsoleLogger {
    protected formatPid(): string;
    log(message: unknown, context?: string): void;
    error(message: unknown, stackOrContext?: string, context?: string): void;
    warn(message: unknown, context?: string): void;
    debug(message: unknown, context?: string): void;
    verbose(message: unknown, context?: string): void;
    setLogLevels(levels: LogLevel[]): void;
    private withStamp;
}

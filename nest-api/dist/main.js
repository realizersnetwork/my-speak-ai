"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const app_logger_service_1 = require("./common/logger/app-logger.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bufferLogs: true });
    const logger = app.get(app_logger_service_1.AppLogger);
    app.useLogger(logger);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
    }));
    app.enableCors();
    const port = Number(process.env.PORT) || 3000;
    await app.listen(port);
    logger.log(`서버 시작 · http://localhost:${port}/openai/chat`, 'Bootstrap');
}
bootstrap();
//# sourceMappingURL=main.js.map
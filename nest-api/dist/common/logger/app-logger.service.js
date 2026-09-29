"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppLogger = void 0;
const common_1 = require("@nestjs/common");
let AppLogger = class AppLogger extends common_1.ConsoleLogger {
    formatPid() {
        return '';
    }
    log(message, context) {
        super.log(this.withStamp(message), context);
    }
    error(message, stackOrContext, context) {
        super.error(this.withStamp(message), stackOrContext, context);
    }
    warn(message, context) {
        super.warn(this.withStamp(message), context);
    }
    debug(message, context) {
        super.debug(this.withStamp(message), context);
    }
    verbose(message, context) {
        super.verbose?.(this.withStamp(message), context);
    }
    setLogLevels(levels) {
        super.setLogLevels(levels);
    }
    withStamp(message) {
        const stamp = new Date().toISOString();
        return `[${stamp}] ${String(message)}`;
    }
};
exports.AppLogger = AppLogger;
exports.AppLogger = AppLogger = __decorate([
    (0, common_1.Injectable)({ scope: common_1.Scope.DEFAULT })
], AppLogger);
//# sourceMappingURL=app-logger.service.js.map

// logging.ts
export enum LogLevel { Debug = 10, Info = 20, Warn = 30, Error = 40, Off = 99 }
export type LogCtx = Record<string, unknown>;

export interface Logger {
    level: LogLevel;
    child(bindings: LogCtx): Logger;
    debug(msg: string, ctx?: LogCtx): void;
    info(msg: string, ctx?: LogCtx): void;
    warn(msg: string, ctx?: LogCtx): void;
    error(msg: string, ctx?: LogCtx): void;
}

export class NoopLogger implements Logger {
    level = LogLevel.Off;
    child(): Logger { return this; }
    debug(): void { } info(): void { } warn(): void { } error(): void { }
}

export class ConsoleLogger implements Logger {
    constructor(public level: LogLevel = LogLevel.Warn, private readonly bindings: LogCtx = {}) { }
    child(bindings: LogCtx): Logger { return new ConsoleLogger(this.level, { ...this.bindings, ...bindings }); }
    private out(kind: "debug" | "info" | "warn" | "error", msg: string, ctx?: LogCtx): void {
        // eslint-disable-next-line no-console
        console[kind]({ msg, ...this.bindings, ...(ctx ?? {}) });
    }
    debug(msg: string, ctx?: LogCtx) { if (this.level <= LogLevel.Debug) this.out("debug", msg, ctx); }
    info(msg: string, ctx?: LogCtx) { if (this.level <= LogLevel.Info) this.out("info", msg, ctx); }
    warn(msg: string, ctx?: LogCtx) { if (this.level <= LogLevel.Warn) this.out("warn", msg, ctx); }
    error(msg: string, ctx?: LogCtx) { if (this.level <= LogLevel.Error) this.out("error", msg, ctx); }
}

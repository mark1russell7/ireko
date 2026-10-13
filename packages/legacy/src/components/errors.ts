// errors.ts
export type ErrorCode =
    | "LIMIT_MAX_DEPTH"
    | "LIMIT_MAX_NODES"
    | "LIMIT_MAX_CHILDREN"
    | "LIMIT_MAX_EDGES"
    | "INVALID_CONFIG";

export class LayoutError extends Error {
    constructor(public code: ErrorCode, message: string, public readonly details?: Record<string, unknown>) {
        super(message);
        this.name = "LayoutError";
    }
}
export class LimitError extends LayoutError {
    constructor(code: Exclude<ErrorCode, "INVALID_CONFIG">, message: string, details?: Record<string, unknown>) {
        super(code, message, details);
        this.name = "LimitError";
    }
}
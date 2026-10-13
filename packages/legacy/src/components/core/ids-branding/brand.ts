// brand.ts
// Generic, reusable branding for ANY type (Vector, ids, enums, etc.)

export const kBrand = Symbol("brand");

export type Brand<Name extends string> = { readonly [kBrand]: Name };
export type Branded<T, Name extends string> = T & Brand<Name>;

// Attach a non-enumerable runtime brand for debugging; erases at type-level into an opaque type.
export function brand<T, Name extends string>(value: T, name: Name): Branded<T, Name> {
    try { Object.defineProperty(value as object, kBrand, { value: name, enumerable: false }); } catch {}
    return value as Branded<T, Name>;
}
export function brandOf(v: unknown): string | undefined {
    try { return (v as any)?.[kBrand] as string | undefined; } catch { return undefined; }
}
export function isBranded<Name extends string>(v: unknown, name: Name): boolean {
    return brandOf(v) === name;
}

// Common opaque aliases you can adopt progressively (no breaking changes required)
export type NodeId   = Branded<string, "NodeId">;
export type EdgeId   = Branded<string, "EdgeId">;
export type LayoutId = Branded<string, "LayoutId">;

export const asNodeId   = (s: string): NodeId   => brand(s, "NodeId");
export const asEdgeId   = (s: string): EdgeId   => brand(s, "EdgeId");
export const asLayoutId = (s: string): LayoutId => brand(s, "LayoutId");

export class Config<T extends Record<string, any>> {
  constructor(
    private settings: T,
    private readonly defaults: T = { ...settings } // shallow copy
  ) {
    Object.freeze(this.defaults);
  }

  public set<K extends keyof T>(key: K, value: T[K]): void {
    this.settings[key] = value;
  }

  public get<K extends keyof T>(key: K): T[K] {
    return this.settings[key];
  }

  public reset<K extends keyof T>(key: K): void {
    this.settings[key] = this.defaults[key];
  }

  public resetAll(): void {
    this.settings = { ...this.defaults };
  }

  /** Read current effective settings (shallow copy). */
  public snapshot(): T {
    return { ...this.settings };
  }

  /** Create a derived, immutable Config view with overrides applied. */
  public derive(overrides: Partial<T>): Config<T> {
    const next = { ...this.settings, ...overrides } as T;
    // keep original defaults (so reset() on the derived refers to the base defaults)
    return new Config<T>(next, this.defaults);
  }
}

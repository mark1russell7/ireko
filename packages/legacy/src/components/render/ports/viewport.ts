export type ViewportState = { x: number; y: number; scale: number };
type Handler = (s: ViewportState) => void;

export class ViewportController {
  private s: ViewportState = { x: 0, y: 0, scale: 1 };
  private hs = new Set<Handler>();
  private min = 0.1;
  private max = 8;
  private wheelZoom = true;

  get(): ViewportState { return { ...this.s }; }
  set(next: Partial<ViewportState>): void {
    const x = Number.isFinite(next.x ?? this.s.x) ? (next.x ?? this.s.x) : this.s.x;
    const y = Number.isFinite(next.y ?? this.s.y) ? (next.y ?? this.s.y) : this.s.y;
    const sc = Number.isFinite(next.scale ?? this.s.scale) ? (next.scale ?? this.s.scale) : this.s.scale;
    const scale = Math.min(this.max, Math.max(this.min, sc));
    this.s = { x, y, scale };
    this.emit();
  }
  onChange(fn: Handler): () => void { this.hs.add(fn); fn(this.get()); return () => this.hs.delete(fn); }
  private emit() { const snap = this.get(); for (const h of this.hs) h(snap); }

  /** Fit world bounds (w×h) into the container with padding (px) */
  fitTo(container: HTMLElement | null, bounds: { position: { x: number, y: number }, size: { x: number, y: number } }, pad = 24): void {
    if (!container) return;
    const W = container.clientWidth, H = container.clientHeight;
    const w = Math.max(1, bounds.size.x), h = Math.max(1, bounds.size.y);
    const scale = Math.max(this.min, Math.min(this.max, Math.min((W - pad * 2) / w, (H - pad * 2) / h)));
    // Center it: choose x,y so the world’s top-left (after subtracting bounds) is centered with padding
    const x = Math.round((W - w * scale) / 2);
    const y = Math.round((H - h * scale) / 2);
    this.s = { x, y, scale };
    this.emit();
  }

  /** Attach wheel + drag; returns detach handler */
  attachWheelAndDrag(el: HTMLElement): () => void {
    let dragging = false;
    let sx = 0, sy = 0, ox = 0, oy = 0;

    const onWheel = (e: WheelEvent) => {
      if (!this.wheelZoom) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;  // screen coords relative to element
      const py = e.clientY - rect.top;

      // exponential zoom (smooth across trackpads)
      const dz = -e.deltaY;
      const k = Math.exp(dz * 0.0015);  // sens
      const prev = this.s.scale;
      const next = Math.min(this.max, Math.max(this.min, prev * k));

      // keep pointer-stationary focal zoom
      const { x, y } = this.s;
      const nx = px - (px - x) * (next / prev);
      const ny = py - (py - y) * (next / prev);

      this.s = { x: nx, y: ny, scale: next };
      this.emit();
    };

    const onDown = (e: PointerEvent) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragging = true; sx = e.clientX; sy = e.clientY; ox = this.s.x; oy = this.s.y;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      this.s = { ...this.s, x: ox + dx, y: oy + dy };
      this.emit();
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    return () => {
      el.removeEventListener("wheel", onWheel as any);
      el.removeEventListener("pointerdown", onDown as any);
      el.removeEventListener("pointermove", onMove as any);
      el.removeEventListener("pointerup", onUp as any);
      el.removeEventListener("pointercancel", onUp as any);
    };
  }
}

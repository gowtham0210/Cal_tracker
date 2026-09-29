/** Small in-memory cache with expiry, used to avoid paying for identical AI calls. */
export class TtlCache<V> {
  private map = new Map<string, { value: V; expires: number }>();
  constructor(private ttlMs: number, private max = 5000) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value!);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}

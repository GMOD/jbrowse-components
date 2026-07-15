// Vendored and converted to TypeScript from hic-straw (igvteam, MIT license)
// https://github.com/igvteam/hic-straw

export default class LRU<K, V> {
  private max: number
  private map = new Map<K, V>()

  constructor(max = 10) {
    this.max = max
  }

  get(key: K) {
    const item = this.map.get(key)
    if (item !== undefined) {
      // refresh key
      this.map.delete(key)
      this.map.set(key, item)
    }
    return item
  }

  set(key: K, val: V) {
    if (this.map.has(key)) {
      // refresh key
      this.map.delete(key)
    } else if (this.map.size === this.max) {
      // evict oldest
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) {
        this.map.delete(oldest)
      }
    }
    this.map.set(key, val)
  }

  has(key: K) {
    return this.map.has(key)
  }

  clear() {
    this.map.clear()
  }
}

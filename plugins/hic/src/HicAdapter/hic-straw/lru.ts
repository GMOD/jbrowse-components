// Vendored and converted to TypeScript from hic-straw (igvteam, MIT license)
// https://github.com/igvteam/hic-straw

/**
 * Optional second bound, for a cache whose entries differ wildly in size.
 *
 * An entry cap is a memory bound only while entries are interchangeable, and the
 * block cache's are not: a block holds every contact in its bin square, so one
 * can be a few thousand contacts or a few hundred thousand depending on binsize
 * and distance from the diagonal. Capping entries therefore forced one number to
 * answer two questions — how many blocks a fetch needs at once, and how much
 * memory the biggest of them may hold — and the memory question won, which is
 * what left the cache too small to serve a multi-region fetch (see hicFile.ts).
 *
 * Splitting them lets the entry cap track the working set while `maxBytes`
 * stays the backstop it was standing in for.
 */
interface WeightOpts<V> {
  maxBytes: number
  weigh: (value: V) => number
}

export default class LRU<K, V> {
  private max: number
  private map = new Map<K, V>()
  private weight = 0
  private weightOpts: WeightOpts<V> | undefined

  constructor(max = 10, weightOpts?: WeightOpts<V>) {
    this.max = max
    this.weightOpts = weightOpts
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
      // refresh key, and drop its old weight — `set` on an existing key
      // replaces the value, so the weight it contributed goes with it
      this.delete(key)
    }
    this.map.set(key, val)
    this.weight += this.weightOpts?.weigh(val) ?? 0

    // Entry cap first, then the byte budget. `size > 1` keeps a single entry
    // larger than the whole budget rather than evicting it and looping forever
    // on an empty map — a cache that can't hold the thing just asked for should
    // still answer the caller that asked.
    while (
      this.map.size > this.max ||
      (this.weightOpts !== undefined &&
        this.weight > this.weightOpts.maxBytes &&
        this.map.size > 1)
    ) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) {
        break
      }
      this.delete(oldest)
    }
  }

  // Used to evict a rejected in-flight promise so the next caller retries
  // rather than resolving against a cached failure forever.
  delete(key: K) {
    const existing = this.map.get(key)
    if (existing !== undefined) {
      this.weight -= this.weightOpts?.weigh(existing) ?? 0
    }
    this.map.delete(key)
  }
}

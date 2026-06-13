// Per-(region, pass) buffer registry shared by WebGL2Hal and WebGPUHal.
// Owns the nested map and the destroy semantics so the two HALs only have to
// supply a leaf-buffer type and its destroy hook. Both HALs used to ship
// near-identical deleteBuffer/deleteRegion/deleteAll/prune/getOrCreate
// implementations; centralizing avoids drift when one side's lifecycle is
// tweaked and the other isn't. Contract pinned by regionRegistry.test.ts.
const passKey = (regionKey: number, passId: string) => `${regionKey}:${passId}`

export class RegionRegistry<Buf> {
  private regions = new Map<number, Map<string, Buf>>()

  // Non-undefined only between beginUpload() and endUpload(). Holds the
  // `regionKey:passId` of every buffer written during the open transaction so
  // endUpload() can destroy the ones that weren't.
  private written: Set<string> | undefined

  constructor(private readonly destroy: (buf: Buf) => void) {}

  get(regionKey: number, passId: string): Buf | undefined {
    return this.regions.get(regionKey)?.get(passId)
  }

  // Set the buffer for (regionKey, passId), auto-creating the region map on
  // first write. Caller is responsible for destroying any prior entry first
  // (typically via deleteBuffer); set itself does NOT call destroy.
  set(regionKey: number, passId: string, buf: Buf): void {
    let region = this.regions.get(regionKey)
    if (!region) {
      region = new Map()
      this.regions.set(regionKey, region)
    }
    region.set(passId, buf)
    this.written?.add(passKey(regionKey, passId))
  }

  // Open a full-rebuild transaction. Every set() until endUpload() records its
  // (region, pass); endUpload() then destroys every buffer NOT rewritten. This
  // makes "one sync rebuilds the live buffer set" correct by construction: a
  // pass the caller stops uploading (its data went empty) is swept, so a buffer
  // can never outlive the data that produced it — no per-pass `if (n > 0)` skip
  // can leave a stale buffer on screen. Callers that never call beginUpload()
  // are unaffected; recording stays off.
  beginUpload(): void {
    this.written = new Set()
  }

  // Close the transaction opened by beginUpload(), destroying every buffer not
  // written since. No-op (and leaves recording off) if no transaction is open.
  endUpload(): void {
    const written = this.written
    this.written = undefined
    if (written) {
      for (const [regionKey, region] of this.regions) {
        for (const passId of region.keys()) {
          if (!written.has(passKey(regionKey, passId))) {
            this.deleteBuffer(regionKey, passId)
          }
        }
        if (region.size === 0) {
          this.regions.delete(regionKey)
        }
      }
    }
  }

  // Destroy and remove one (regionKey, passId) entry. No-op if absent.
  deleteBuffer(regionKey: number, passId: string): void {
    const region = this.regions.get(regionKey)
    if (region) {
      const buf = region.get(passId)
      if (buf) {
        this.destroy(buf)
        region.delete(passId)
      }
    }
  }

  // Destroy every buffer in `regionKey` and remove the region entry.
  deleteRegion(regionKey: number): void {
    const region = this.regions.get(regionKey)
    if (region) {
      for (const buf of region.values()) {
        this.destroy(buf)
      }
      this.regions.delete(regionKey)
    }
  }

  // Destroy every buffer everywhere and clear the registry.
  deleteAll(): void {
    for (const region of this.regions.values()) {
      for (const buf of region.values()) {
        this.destroy(buf)
      }
    }
    this.regions.clear()
  }

  // Delete every region whose key is NOT in `active`.
  prune(active: Iterable<number>): void {
    const activeSet = new Set(active)
    for (const regionKey of this.regions.keys()) {
      if (!activeSet.has(regionKey)) {
        this.deleteRegion(regionKey)
      }
    }
  }

  // Visit every existing buffer for `passId` across all regions. WebGPUHal
  // uses this in uploadTexture to refresh per-region bind groups that
  // reference the newly-uploaded texture.
  forEachInPass(passId: string, visit: (buf: Buf, regionKey: number) => void) {
    for (const [regionKey, region] of this.regions) {
      const buf = region.get(passId)
      if (buf) {
        visit(buf, regionKey)
      }
    }
  }
}

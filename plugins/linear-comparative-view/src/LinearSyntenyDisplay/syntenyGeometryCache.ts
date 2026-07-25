import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { PickIndex } from './syntenyPickEngine.ts'

// Pairs uploaded geometry with its lazily-built Flatbush pick index. Replacing a
// region's geometry invalidates that key's pick index; the next pick rebuilds it.
export class SyntenyGeometryCache {
  regions = new Map<number, SyntenyInstanceData>()
  pickIndices = new Map<number, PickIndex>()

  set(key: number, data: SyntenyInstanceData) {
    // A colorBy / opacity toggle re-uploads the same geometry with a fresh
    // `colors` lane, which the pick index doesn't depend on. Keying the
    // invalidation on a geometry array (all replaced atomically on RPC
    // refetch, so bp1 identifies the generation) keeps the index across a
    // recolor — same `geomToken` reasoning as GpuSyntenyRenderer.interleaveCache.
    if (this.regions.get(key)?.bp1 !== data.bp1) {
      this.pickIndices.delete(key)
    }
    this.regions.set(key, data)
  }

  delete(key: number) {
    this.regions.delete(key)
    this.pickIndices.delete(key)
  }

  clear() {
    this.regions.clear()
    this.pickIndices.clear()
  }
}

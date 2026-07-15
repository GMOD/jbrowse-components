import type { PickIndex } from './syntenyPickEngine.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

// Pairs uploaded geometry with its lazily-built Flatbush pick index. Mutating a
// region invalidates that key's pick index; the next pick rebuilds it.
export class SyntenyGeometryCache {
  regions = new Map<number, SyntenyInstanceData>()
  pickIndices = new Map<number, PickIndex>()

  set(key: number, data: SyntenyInstanceData) {
    this.regions.set(key, data)
    this.pickIndices.delete(key)
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

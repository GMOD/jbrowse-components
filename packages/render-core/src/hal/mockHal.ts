import { assertUniquePassIds } from './passIds.ts'
import { RegionRegistry } from './regionRegistry.ts'

import type { GpuHal, PipelineDescriptor } from './types.ts'

export interface MockCall {
  method: string
  args: unknown[]
}

interface MockBuffer {
  data: ArrayBufferLike
  count: number
}

export class MockHal implements GpuHal {
  calls: MockCall[] = []

  // The same registry both real HALs use, so buffer lifecycle (delete-on-empty,
  // prune, the beginUpload/endUpload sweep) is shared code rather than a
  // hand-rolled twin that can drift out of parity. There is nothing to free, so
  // the destroy hook is a no-op.
  private regions = new RegionRegistry<MockBuffer>(() => {})
  // Every write of the frame, in order, not just the last. A renderer that
  // rewrites the UBO mid-frame — for a band that reads it differently, or a
  // section with its own offsets — has invariants the final state cannot show:
  // that each write carries the frame-constant slots, that a temporary
  // overwrite doesn't outlive its pass, and how many writes a frame costs at
  // all (the real HALs stage these into a fixed-size ring).
  private uniformWrites: ArrayBuffer[] = []

  // The pass list is here for parity with the WebGL2Hal / WebGPUHal
  // constructors, and it validates for the same reason `createRenderingBackend`
  // does: a duplicate pass id is a silent GPU-only mis-render, so the check
  // belongs everywhere a display hands its registry over. Checking it in the
  // mock is what puts it in front of a unit test — every backend test builds a
  // `MockHal` from its display's real pass list.
  constructor(passes: PipelineDescriptor[]) {
    assertUniquePassIds(passes)
  }

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args })
  }

  errorHandler: ((error: Error) => void) | null = null

  setErrorHandler(handler: (error: Error) => void) {
    this.errorHandler = handler
    this.record('setErrorHandler')
  }

  resize(width: number, height: number) {
    this.record('resize', width, height)
  }

  uploadBuffer(
    regionKey: number,
    passId: string,
    data: ArrayBuffer | ArrayBufferView,
    count: number,
  ) {
    this.record('uploadBuffer', regionKey, passId, data.byteLength, count)
    // Both real HALs delete the prior buffer up front and leave nothing behind
    // on an empty upload; mirroring that here keeps `getBuffer`/`endUpload`
    // bookkeeping honest instead of leaving a count-0 entry the GPU never has.
    this.regions.deleteBuffer(regionKey, passId)
    if (count > 0) {
      const copy = ArrayBuffer.isView(data)
        ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        : data.slice(0)
      this.regions.set(regionKey, passId, { data: copy, count })
    }
  }

  getBufferCount(regionKey: number, passId: string) {
    return this.regions.get(regionKey, passId)?.count ?? 0
  }

  deleteBuffer(regionKey: number, passId: string) {
    this.record('deleteBuffer', regionKey, passId)
    this.regions.deleteBuffer(regionKey, passId)
  }

  deleteRegion(regionKey: number) {
    this.record('deleteRegion', regionKey)
    this.regions.deleteRegion(regionKey)
  }

  pruneRegions(active: Iterable<number>) {
    const activeSet = new Set(active)
    this.record('pruneRegions', [...activeSet])
    this.regions.prune(activeSet)
  }

  beginUpload() {
    this.record('beginUpload')
    this.regions.beginUpload()
  }

  endUpload() {
    this.record('endUpload')
    this.regions.endUpload()
  }

  retainRegion(regionKey: number) {
    this.record('retainRegion', regionKey)
    this.regions.retainRegion(regionKey)
  }

  uploadTexture(
    passId: string,
    data: Uint8Array,
    width: number,
    height: number,
  ) {
    this.record('uploadTexture', passId, data.byteLength, width, height)
  }

  writeUniforms(data: ArrayBuffer) {
    this.uniformWrites.push(data.slice(0))
    this.record('writeUniforms', data.byteLength)
  }

  beginFrame(clearR: number, clearG: number, clearB: number, clearA?: number) {
    this.record('beginFrame', clearR, clearG, clearB, clearA)
  }

  drawPass(passId: string, regionKey: number, bufferPassId?: string) {
    this.record('drawPass', passId, regionKey, bufferPassId)
  }

  endFrame() {
    this.record('endFrame')
  }

  setScissor(x: number, y: number, w: number, h: number) {
    this.record('setScissor', x, y, w, h)
  }

  clearScissor() {
    this.record('clearScissor')
  }

  setViewport(x: number, y: number, w: number, h: number) {
    this.record('setViewport', x, y, w, h)
  }

  clearViewport() {
    this.record('clearViewport')
  }

  dispose() {
    this.record('dispose')
    this.regions.deleteAll()
  }

  // Test helpers

  private get lastUniforms() {
    return this.uniformWrites.at(-1) ?? null
  }

  getLastUniformsF32() {
    return this.lastUniforms ? new Float32Array(this.lastUniforms) : null
  }

  getLastUniformsU32() {
    return this.lastUniforms ? new Uint32Array(this.lastUniforms) : null
  }

  getLastUniformsI32() {
    return this.lastUniforms ? new Int32Array(this.lastUniforms) : null
  }

  // Every write of the frame, in order. `getLastUniforms*` is the same list's
  // tail and stays the right call for a renderer that writes once.
  getUniformWritesF32() {
    return this.uniformWrites.map(u => new Float32Array(u))
  }

  getUniformWritesU32() {
    return this.uniformWrites.map(u => new Uint32Array(u))
  }

  getBuffer(regionKey: number, passId: string) {
    return this.regions.get(regionKey, passId)
  }

  callsOf(method: string) {
    return this.calls.filter(c => c.method === method)
  }

  reset() {
    this.calls = []
    // endUpload first so an in-flight transaction doesn't survive the reset.
    this.regions.endUpload()
    this.regions.deleteAll()
    this.uniformWrites = []
  }
}

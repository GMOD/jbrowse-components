import type { GpuHal, PassDescriptor } from './types.ts'

export interface MockCall {
  method: string
  args: unknown[]
}

export class MockHal implements GpuHal {
  calls: MockCall[] = []

  private buffers = new Map<string, { data: ArrayBufferLike; count: number }>()
  private lastUniforms: ArrayBuffer | null = null

  // Parameter kept for parity with WebGL2Hal / WebGPUHal constructors so
  // tests can swap implementations; pass list isn't needed in the mock.
  constructor(_passes: PassDescriptor[]) {}

  private bufferKey(regionKey: number, passId: string) {
    return `${regionKey}:${passId}`
  }

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args })
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
    const copy = ArrayBuffer.isView(data)
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : data.slice(0)
    this.buffers.set(this.bufferKey(regionKey, passId), { data: copy, count })
  }

  getBufferCount(regionKey: number, passId: string) {
    return this.buffers.get(this.bufferKey(regionKey, passId))?.count ?? 0
  }

  deleteBuffer(regionKey: number, passId: string) {
    this.record('deleteBuffer', regionKey, passId)
    this.buffers.delete(this.bufferKey(regionKey, passId))
  }

  deleteRegion(regionKey: number) {
    this.record('deleteRegion', regionKey)
    for (const key of this.buffers.keys()) {
      if (key.startsWith(`${regionKey}:`)) {
        this.buffers.delete(key)
      }
    }
  }

  pruneRegions(active: Iterable<number>) {
    const activeSet = new Set(active)
    this.record('pruneRegions', [...activeSet])
    for (const key of this.buffers.keys()) {
      const regionKey = Number(key.slice(0, key.indexOf(':')))
      if (!activeSet.has(regionKey)) {
        this.buffers.delete(key)
      }
    }
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
    this.lastUniforms = data.slice(0)
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
    this.buffers.clear()
  }

  // Test helpers

  getLastUniformsF32() {
    return this.lastUniforms ? new Float32Array(this.lastUniforms) : null
  }

  getLastUniformsU32() {
    return this.lastUniforms ? new Uint32Array(this.lastUniforms) : null
  }

  getLastUniformsI32() {
    return this.lastUniforms ? new Int32Array(this.lastUniforms) : null
  }

  getBuffer(regionKey: number, passId: string) {
    return this.buffers.get(this.bufferKey(regionKey, passId))
  }

  callsOf(method: string) {
    return this.calls.filter(c => c.method === method)
  }

  reset() {
    this.calls = []
    this.buffers.clear()
    this.lastUniforms = null
  }
}

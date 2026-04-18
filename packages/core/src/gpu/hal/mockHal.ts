import type { GpuHal, PassDescriptor, RegionMeta } from './types.ts'

export interface MockCall {
  method: string
  args: unknown[]
}

export class MockHal implements GpuHal {
  calls: MockCall[] = []
  passes: PassDescriptor[]

  private buffers = new Map<string, { data: ArrayBufferLike; count: number }>()
  private regionMeta = new Map<number, RegionMeta>()
  private lastUniforms: ArrayBuffer | null = null

  constructor(passes: PassDescriptor[]) {
    this.passes = passes
  }

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

  setRegionMeta(regionKey: number, meta: Partial<RegionMeta>) {
    this.record('setRegionMeta', regionKey, meta)
    const existing = this.regionMeta.get(regionKey) ?? {
      regionStart: 0,
      maxDepth: 0,
    }
    this.regionMeta.set(regionKey, { ...existing, ...meta })
  }

  getRegionMeta(regionKey: number) {
    return this.regionMeta.get(regionKey)
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
    this.regionMeta.delete(regionKey)
  }

  deleteAllRegions() {
    this.record('deleteAllRegions')
    this.buffers.clear()
    this.regionMeta.clear()
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

  drawPickingPass(
    passId: string,
    regionKey: number,
    instanceCount?: number,
    bufferPassId?: string,
  ) {
    this.record(
      'drawPickingPass',
      passId,
      regionKey,
      instanceCount,
      bufferPassId,
    )
  }

  readPickingPixel(_x: number, _y: number) {
    return -1
  }

  async readPickingPixelAsync(_x: number, _y: number) {
    return -1
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
    this.regionMeta.clear()
  }

  // Test helpers

  getLastUniforms() {
    return this.lastUniforms
  }

  getLastUniformsF32() {
    if (!this.lastUniforms) {
      return null
    }
    return new Float32Array(this.lastUniforms)
  }

  getLastUniformsU32() {
    if (!this.lastUniforms) {
      return null
    }
    return new Uint32Array(this.lastUniforms)
  }

  getLastUniformsI32() {
    if (!this.lastUniforms) {
      return null
    }
    return new Int32Array(this.lastUniforms)
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
    this.regionMeta.clear()
    this.lastUniforms = null
  }
}

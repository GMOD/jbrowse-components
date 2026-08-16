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

export interface MockRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * One draw, with the state that was in force when it was issued — the clip, and
 * which `writeUniforms` it reads. `null` scissor/viewport means unclipped, the
 * full canvas, which is what both HALs owe after a `clearScissor` /
 * `clearViewport`.
 *
 * `uniformWrite` indexes {@link MockHal.getUniformWritesF32}, or is `-1` when
 * nothing has been written yet. It is here for the same reason the clip is:
 * uniforms are *state*, so "which values did this draw actually use" is a
 * question about the order of two methods, and a test asking it off `calls` has
 * to re-implement the pairing to find out.
 *
 * **The pairing is by adjacency, and the two HALs mean different things by
 * it.** `WebGPUHal` stages each write into a ring slot and binds slot
 * `uniformSlot - 1` — "whatever was written most recently" — while `WebGL2Hal`
 * does an immediate `bufferSubData` into one UBO. They agree only while a
 * renderer writes then draws, which is the convention every renderer in tree
 * follows and nothing enforces: batching the writes and then issuing the draws
 * is right on WebGL2 and Canvas2D and silently wrong on WebGPU. This field is
 * what lets a backend test pin its renderer's pairing.
 */
export interface MockDraw {
  passId: string
  regionKey: number
  bufferPassId: string | undefined
  scissor: MockRect | null
  viewport: MockRect | null
  uniformWrite: number
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

  // Every id the display registered. Both real HALs key their pipelines by it
  // and return early from `drawPass` on an id they don't hold; keeping the set
  // is what lets `drawPass` below say so instead of recording the call.
  private registered: Set<string>

  /**
   * The clip each draw of the frame went out under — see {@link draws}.
   *
   * Scissor and viewport are the one part of the HAL contract a call log cannot
   * show. They are *state*: set once, they hold over every later draw until
   * changed, so "which columns did the mismatch pass actually paint into" is a
   * question about the order of two different methods, and a test asking it off
   * `calls` has to re-implement the state machine to find out.
   *
   * That is not hypothetical. `clearScissor` on WebGPU used to drop the stored
   * rect without re-issuing a full-canvas one, so every draw after it went on
   * being clipped to the previous block while WebGL2 drew them unclipped — right
   * on Canvas2D, right on WebGL2, wrong on WebGPU alone. Nothing in tree clears
   * mid-frame today, which is exactly why nothing caught it. Recording the
   * effective clip per draw is what makes that assertable at all.
   */
  private scissor: MockRect | null = null
  private viewport: MockRect | null = null
  private drawLog: MockDraw[] = []

  // The pass list is here for parity with the WebGL2Hal / WebGPUHal
  // constructors, and it validates for the same reason `createRenderingBackend`
  // does: a duplicate pass id is a silent GPU-only mis-render, so the check
  // belongs everywhere a display hands its registry over. Checking it in the
  // mock is what puts it in front of a unit test — every backend test builds a
  // `MockHal` from its display's real pass list.
  constructor(passes: PipelineDescriptor[]) {
    assertUniquePassIds(passes)
    this.registered = new Set(passes.map(p => p.id))
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
    // A fresh frame starts unclipped on both real HALs — WebGL2 disables
    // SCISSOR_TEST and sets the full viewport, WebGPU opens a render pass whose
    // initial state is the whole attachment.
    this.scissor = null
    this.viewport = null
  }

  // Throws on an id the display never registered, where both real HALs return
  // early instead — the mock is louder than production on purpose. A `drawPass`
  // naming an unregistered pass draws nothing on either GPU backend, silently,
  // while Canvas2D keeps painting correctly; and because this mock recorded the
  // call anyway, the unit test asserting `callsOf('drawPass')` went green over
  // it. That is the same failure `assertUniquePassIds` above exists for, seen
  // from the draw side, and a typo'd or renamed id has no legitimate use — so
  // there is nothing to preserve by matching the silent skip.
  //
  // `bufferPassId` is checked too: `drawPass(a, key, b)` runs pass `a`'s
  // pipeline over pass `b`'s buffer, and every such pair in tree names two
  // registered passes (canvas's chevron over line, continuation over rect).
  drawPass(passId: string, regionKey: number, bufferPassId?: string) {
    this.assertRegistered(passId, 'passId')
    if (bufferPassId !== undefined) {
      this.assertRegistered(bufferPassId, 'bufferPassId')
    }
    this.record('drawPass', passId, regionKey, bufferPassId)
    this.drawLog.push({
      passId,
      regionKey,
      bufferPassId,
      scissor: this.scissor && { ...this.scissor },
      viewport: this.viewport && { ...this.viewport },
      uniformWrite: this.uniformWrites.length - 1,
    })
  }

  private assertRegistered(passId: string, role: string) {
    if (!this.registered.has(passId)) {
      throw new Error(
        `drawPass ${role} '${passId}' is not a registered pass — this HAL holds ` +
          `${[...this.registered].map(id => `'${id}'`).join(', ') || '(none)'}. ` +
          `Both real HALs drop such a draw without a word, so on the GPU ` +
          `backends this paints nothing while Canvas2D still looks right.`,
      )
    }
  }

  endFrame() {
    this.record('endFrame')
  }

  setScissor(x: number, y: number, w: number, h: number) {
    this.record('setScissor', x, y, w, h)
    this.scissor = { x, y, w, h }
  }

  clearScissor() {
    this.record('clearScissor')
    this.scissor = null
  }

  setViewport(x: number, y: number, w: number, h: number) {
    this.record('setViewport', x, y, w, h)
    this.viewport = { x, y, w, h }
  }

  clearViewport() {
    this.record('clearViewport')
    this.viewport = null
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

  /**
   * Every draw of the frame with the state it went out under, in order — the
   * answer to "which columns did this pass paint into" and "which uniforms did
   * it read", neither of which `callsOf('drawPass')` can give, because clip and
   * uniforms are state rather than arguments. `scissor: null` is unclipped;
   * `uniformWrite` indexes `getUniformWrites*`. See {@link MockDraw} for what
   * each is guarding.
   */
  draws() {
    return this.drawLog
  }

  /**
   * The uniform bytes a recorded draw reads, as f32 — `draws()` joined to
   * `getUniformWritesF32()` for you, since doing it by hand at every call site
   * is how the index and the list drift apart. `null` when the draw preceded
   * any write, which is the case no renderer should rely on: WebGPU clamps it
   * to ring slot 0 and WebGL2 leaves the previous frame's UBO bound, so the two
   * backends disagree about what it even means.
   */
  uniformsOf(draw: MockDraw) {
    const buf = this.uniformWrites[draw.uniformWrite]
    return buf ? new Float32Array(buf) : null
  }

  reset() {
    this.calls = []
    // endUpload first so an in-flight transaction doesn't survive the reset.
    this.regions.endUpload()
    this.regions.deleteAll()
    this.uniformWrites = []
    this.drawLog = []
    this.scissor = null
    this.viewport = null
  }
}

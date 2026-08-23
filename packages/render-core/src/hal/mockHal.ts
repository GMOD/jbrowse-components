import { getDpr } from '../canvas2dUtils.ts'
import { GpuHalBase } from './gpuHalBase.ts'
import { assertUniquePassIds } from './passIds.ts'

import type { GpuHal, PipelineDescriptor, TextureBinding } from './types.ts'

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

export class MockHal extends GpuHalBase<MockBuffer> implements GpuHal {
  calls: MockCall[] = []

  // Every write of the frame, in order, not just the last. A renderer that
  // rewrites the UBO mid-frame — for a band that reads it differently, or a
  // section with its own offsets — has invariants the final state cannot show:
  // that each write carries the frame-constant slots, that a temporary
  // overwrite doesn't outlive its pass, and how many writes a frame costs at
  // all (the real HALs stage these into a fixed-size ring).
  private uniformWrites: ArrayBuffer[] = []

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

  /**
   * `${regionKey}:${passId}` for every buffer the open frame has drawn from,
   * and the ones that were then replaced or deleted before `endFrame`.
   *
   * That sequence is legal — `WebGPUHal` defers the `destroy()` past its submit
   * precisely so it is — but it is the sequence that used to blank a frame, and
   * it stays worth pinning per renderer: alignments re-uploads `OVERLAY_REGION`
   * once per section inside its block loop, so a chain selection spanning two
   * sections lands here, while synteny's mid-frame delete of an undrawn pass
   * does not. A renderer test asserts on which of the two shapes it has.
   */
  private frameOpen = false
  private drawnThisFrame = new Map<number, Set<string>>()
  private replacedWhileDrawnLog: string[] = []

  // The pass list is here for parity with the WebGL2Hal / WebGPUHal
  // constructors, and it validates for the same reason `createRenderingBackend`
  // does: a duplicate pass id is a silent GPU-only mis-render, so the check
  // belongs everywhere a display hands its registry over. Checking it in the
  // mock is what puts it in front of a unit test — every backend test builds a
  // `MockHal` from its display's real pass list.
  constructor(passes: PipelineDescriptor[]) {
    super(passes, 'MockHal')
    assertUniquePassIds(passes)
  }

  // No device behind this HAL, so nothing is ever over-limit: the shells' checks
  // are the real HALs' to make. `descriptors` — the base's map of the same pass
  // list — is what `drawPass` and `uploadTexture` below answer from.
  protected limits() {
    return {
      maxBufferBytes: Number.POSITIVE_INFINITY,
      maxTextureDimensionPx: Number.POSITIVE_INFINITY,
    }
  }

  // The bytes are copied because both real HALs hand them to the driver at
  // upload time, so a caller reusing its scratch array must not be able to
  // change what a test then reads back out of `getBuffer`.
  protected createBuffer(data: ArrayBuffer | ArrayBufferView, count: number) {
    const copy = ArrayBuffer.isView(data)
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : data.slice(0)
    return { data: copy, count }
  }

  protected destroyBuffer() {}

  protected createTexture(
    passId: string,
    binding: TextureBinding,
    data: Uint8Array,
    width: number,
    height: number,
  ) {
    this.record('uploadTexture', passId, data.byteLength, width, height)
  }

  protected releaseResources() {
    this.record('dispose')
    this.regions.deleteAll()
  }

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args })
  }

  errorHandler: ((error: Error) => void) | null = null

  setErrorHandler(handler: (error: Error) => void) {
    super.setErrorHandler(handler)
    this.errorHandler = handler
    this.record('setErrorHandler')
  }

  resize(width: number, height: number) {
    this.record('resize', width, height)
    // The real HALs report the scale their backing store actually got, and
    // every device-px rect a renderer builds comes from this — so a mock
    // returning nothing is a renderer whose rects are all NaN. `getDpr()` is
    // the unclamped answer, which is what a mock canvas of any size would get.
    return { x: getDpr(), y: getDpr() }
  }

  // The overrides below log and then defer to the base's shells, so the buffer
  // lifecycle a test observes (delete-before-count, prune) is the same code both
  // real HALs run rather than a twin that can drift out of parity.
  uploadBuffer(
    regionKey: number,
    passId: string,
    data: ArrayBuffer | ArrayBufferView,
    count: number,
  ) {
    this.record('uploadBuffer', regionKey, passId, data.byteLength, count)
    this.noteReplaced(regionKey, passId)
    super.uploadBuffer(regionKey, passId, data, count)
  }

  deleteBuffer(regionKey: number, passId: string) {
    this.record('deleteBuffer', regionKey, passId)
    this.noteReplaced(regionKey, passId)
    super.deleteBuffer(regionKey, passId)
  }

  deleteRegion(regionKey: number) {
    this.record('deleteRegion', regionKey)
    this.noteRegionReplaced(regionKey)
    super.deleteRegion(regionKey)
  }

  pruneRegions(active: Iterable<number>) {
    const activeSet = new Set(active)
    this.record('pruneRegions', [...activeSet])
    for (const regionKey of this.drawnThisFrame.keys()) {
      if (!activeSet.has(regionKey)) {
        this.noteRegionReplaced(regionKey)
      }
    }
    super.pruneRegions(activeSet)
  }

  private noteReplaced(regionKey: number, passId: string) {
    if (this.frameOpen && this.drawnThisFrame.get(regionKey)?.has(passId)) {
      this.replacedWhileDrawnLog.push(`${regionKey}:${passId}`)
    }
  }

  private noteRegionReplaced(regionKey: number) {
    const drawn = this.drawnThisFrame.get(regionKey)
    if (drawn) {
      for (const passId of drawn) {
        this.noteReplaced(regionKey, passId)
      }
    }
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
    this.frameOpen = true
    this.drawnThisFrame.clear()
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
    // The buffer the draw reads, which `bufferPassId` renames — that is the
    // resource a later upload in this frame would be replacing under it.
    const bufferKey = bufferPassId ?? passId
    let drawn = this.drawnThisFrame.get(regionKey)
    if (!drawn) {
      drawn = new Set()
      this.drawnThisFrame.set(regionKey, drawn)
    }
    drawn.add(bufferKey)
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
    if (!this.descriptors.has(passId)) {
      throw new Error(
        `drawPass ${role} '${passId}' is not a registered pass — this HAL holds ` +
          `${[...this.descriptors.keys()].map(id => `'${id}'`).join(', ') || '(none)'}. ` +
          `Both real HALs drop such a draw without a word, so on the GPU ` +
          `backends this paints nothing while Canvas2D still looks right.`,
      )
    }
  }

  endFrame() {
    this.record('endFrame')
    this.frameOpen = false
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
  /**
   * `${regionKey}:${passId}` for each buffer this run replaced or deleted while
   * the open frame had already drawn from it, in order — empty when a renderer
   * never does that. See the field for why the sequence is worth asserting on
   * either way.
   */
  replacedWhileDrawn() {
    return [...this.replacedWhileDrawnLog]
  }

  uniformsOf(draw: MockDraw) {
    const buf = this.uniformWrites[draw.uniformWrite]
    return buf ? new Float32Array(buf) : null
  }

  reset() {
    this.disposed = false
    this.calls = []
    this.regions.deleteAll()
    this.uniformWrites = []
    this.drawLog = []
    this.scissor = null
    this.viewport = null
    this.frameOpen = false
    this.drawnThisFrame.clear()
    this.replacedWhileDrawnLog = []
  }
}

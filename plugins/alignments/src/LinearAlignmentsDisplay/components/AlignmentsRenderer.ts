import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DAlignmentsRenderer } from './Canvas2DAlignmentsRenderer.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'
import { UNIFORM_SIZE } from './wgsl/common.ts'

export type { ColorPalette, RGBColor, RenderState } from './rendererTypes.ts'

import type {
  AlignmentsBackend,
  ArcsUploadData,
  CigarUploadData,
  ConnectingLinesUploadData,
  CoverageUploadData,
  ModCoverageUploadData,
  ModificationUploadData,
  ReadUploadData,
  RenderBlock,
  RenderState,
  SashimiUploadData,
} from './rendererTypes.ts'

const cache = new WeakMap<HTMLCanvasElement, AlignmentsRenderer>()

export class AlignmentsRenderer {
  private canvas: HTMLCanvasElement
  private backend: AlignmentsBackend | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let r = cache.get(canvas)
    if (!r) {
      r = new AlignmentsRenderer(canvas)
      cache.set(canvas, r)
    }
    return r
  }

  async init() {
    this.backend = await initDualBackend<AlignmentsBackend>(
      this.canvas,
      ALIGNMENTS_PASSES,
      UNIFORM_SIZE,
      hal => new GpuAlignmentsRenderer(hal),
      canvas => new Canvas2DAlignmentsRenderer(canvas),
    )
    return true
  }

  clearLegacyBuffers() {
    this.backend?.clearLegacyBuffers()
  }

  ensureBuffers(regionStart: number) {
    this.backend?.ensureBuffers(regionStart)
  }

  uploadFromTypedArraysForRegion(regionNumber: number, data: ReadUploadData) {
    this.backend?.uploadFromTypedArraysForRegion(regionNumber, data)
  }

  uploadCigarFromTypedArraysForRegion(
    regionNumber: number,
    data: CigarUploadData,
  ) {
    this.backend?.uploadCigarFromTypedArraysForRegion(regionNumber, data)
  }

  uploadModificationsFromTypedArraysForRegion(
    regionNumber: number,
    data: ModificationUploadData,
  ) {
    this.backend?.uploadModificationsFromTypedArraysForRegion(
      regionNumber,
      data,
    )
  }

  uploadCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: CoverageUploadData,
  ) {
    this.backend?.uploadCoverageFromTypedArraysForRegion(regionNumber, data)
  }

  uploadModCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: ModCoverageUploadData,
  ) {
    this.backend?.uploadModCoverageFromTypedArraysForRegion(regionNumber, data)
  }

  uploadSashimiFromTypedArraysForRegion(
    regionNumber: number,
    data: SashimiUploadData,
  ) {
    this.backend?.uploadSashimiFromTypedArraysForRegion(regionNumber, data)
  }

  uploadArcsFromTypedArraysForRegion(
    regionNumber: number,
    data: ArcsUploadData,
  ) {
    this.backend?.uploadArcsFromTypedArraysForRegion(regionNumber, data)
  }

  uploadConnectingLinesForRegion(
    regionNumber: number,
    data: ConnectingLinesUploadData,
  ) {
    this.backend?.uploadConnectingLinesForRegion(regionNumber, data)
  }

  renderBlocks(blocks: RenderBlock[], state: RenderState) {
    this.backend?.renderBlocks(blocks, state)
  }

  destroy() {
    this.backend?.destroy()
    this.backend = null
    cache.delete(this.canvas)
  }
}

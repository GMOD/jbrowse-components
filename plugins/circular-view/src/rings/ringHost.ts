import { getEnv } from '@jbrowse/core/util'
import { BlockSet, wholeBaseRegions } from '@jbrowse/core/util/blockTypes'
import { addDisposer, destroy, types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { maxCanvasCssPx } from '@jbrowse/render-core/canvas2dUtils'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'
import { autorun, computed, observable } from 'mobx'

import { RING_PASSES } from './ringMarks.ts'

import type { Slice } from '../CircularView/slices.ts'
import type { RingCell, RingFrame } from './ringMarks.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util'
import type { PxToBpResult } from '@jbrowse/core/util/Base1DUtils'
import type { BaseBlock, ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { MarkImage } from '@jbrowse/render-core/marks'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { IComputedValue } from 'mobx'
import type { ComponentType } from 'react'

const TWO_PI = 2 * Math.PI

/** CSS px between the ruler's arc and the first ring, and between rings. */
export const RING_GAP_PX = 4

/** The share of the radius the rings may take before they shrink. */
export const MAX_RINGS_RADIUS_FRACTION = 0.5

/**
 * A ring's display: the height and paint count every linear display carries
 * through `TrackHeightMixin` and `RenderLifecycleMixin`, and its component.
 */
export interface RingDisplay {
  id: string
  type: string
  height: number
  paintCount: number
  renderNow: () => void
  configuration: { displayId: string }
  RenderingComponent: ComponentType<{ model: never }>
}

/** The circular view, as its ring host reads it. */
export interface RingHostView {
  id: string
  displayName: string | undefined
  minimized: boolean
  bodyMounted: boolean
  effectiveBodyMounted: boolean
  initialized: boolean
  width: number
  height: number
  bpPerPx: number
  radiusPx: number
  circumferencePx: number
  offsetRadians: number
  centerXY: [number, number]
  figureOriginXY: [number, number]
  displayedRegions: Region[]
  staticSlices: Slice[]
  assemblyNames: string[]
  tracks: { displays: RingDisplay[] }[]
}

/** One ring: a display and the annulus it is drawn on, in CSS px. */
export interface Ring {
  display: RingDisplay
  innerPx: number
  outerPx: number
}

export type RingBackend = PerRegionRenderingBackend<RingCell, RingFrame>

/**
 * The strip's blocks: one content block per drawn slice and one elided block
 * per elided run, laid along the circumference at the strip's scale. No
 * padding blocks — a gap between slices is a gap.
 *
 * A mirrored slice hands its block `reversed`, which every linear display's
 * projection already honours, so a ring over the second genome of a
 * diagonalized circle reads the same way round as its ideogram.
 */
export function stripBlocks(
  slices: readonly Slice[],
  stripRadiusPx: number,
): BlockSet {
  const blocks: BaseBlock[] = []
  let displayedRegionIndex = 0
  for (const slice of slices) {
    const offsetPx = slice.startRadians * stripRadiusPx
    const widthPx = (slice.endRadians - slice.startRadians) * stripRadiusPx
    const { region } = slice
    if (region.elided) {
      blocks.push({
        type: 'ElidedBlock',
        key: slice.key,
        offsetPx,
        widthPx,
      })
      displayedRegionIndex += region.regions.length
    } else {
      const { assemblyName, refName, start, end, reversed } = region
      blocks.push({
        type: 'ContentBlock',
        key: `${slice.key}:${displayedRegionIndex}`,
        assemblyName,
        refName,
        start,
        end,
        reversed: reversed ?? false,
        offsetPx,
        widthPx,
        displayedRegionIndex,
        isLeftEndOfDisplayedRegion: true,
        isRightEndOfDisplayedRegion: true,
      })
      displayedRegionIndex += 1
    }
  }
  return new BlockSet(blocks)
}

/**
 * Where the rings sit: stacked inward from the ruler, each taking its
 * display's height as its band, with a gap between. Past
 * `MAX_RINGS_RADIUS_FRACTION` of the radius every band shrinks in proportion,
 * so a small circle keeps an interior for its chords and ribbons. Once the
 * gaps alone take that share — a handful of rings at the zoom floor — there is
 * no band left to shrink, and a ring with none is left out rather than laid
 * out as an annulus of zero width.
 */
export function layoutRings(
  displays: readonly RingDisplay[],
  radiusPx: number,
): Ring[] {
  const heights = displays.reduce((sum, d) => sum + d.height, 0)
  const gaps = displays.length * RING_GAP_PX
  const room = Math.max(0, radiusPx * MAX_RINGS_RADIUS_FRACTION - gaps)
  const scale = heights > 0 ? Math.min(1, room / heights) : 0
  const rings: Ring[] = []
  let outerPx = radiusPx - RING_GAP_PX
  for (const display of displays) {
    const innerPx = Math.max(0, outerPx - display.height * scale)
    if (outerPx > innerPx) {
      rings.push({ display, innerPx, outerPx })
    }
    outerPx = innerPx - RING_GAP_PX
  }
  return rings
}

/** The radial distance two labelled ticks of a ring's axis keep apart. */
export const RING_AXIS_LABEL_GAP_PX = 11

/** The y axis a ring display declares, as the chrome's `YAxis` shapes it. */
interface RingAxis {
  bandTops?: number[]
  ticks: { items: { value: number; y: number; label?: string }[] }
}

/**
 * A ring display's y axis as radii: each tick of its first single-band scale
 * at the radius its strip row is warped to, labelled where the label clears
 * the one before it. A stacked scale (a multi-wiggle's rows) has no one axis
 * and draws none.
 */
export function ringAxisTicks(ring: Ring) {
  const axis = (ring.display as { axes?: RingAxis[] }).axes?.find(
    a => (a.bandTops ?? [0]).length === 1,
  )
  const scale = stripPerRingPx(ring)
  let lastLabelled = -Infinity
  return (axis?.ticks.items ?? []).flatMap(({ value, y, label }) => {
    const radius = ring.outerPx - y / scale
    if (radius < ring.innerPx - 0.5 || radius > ring.outerPx + 0.5) {
      return []
    }
    const labelled = Math.abs(radius - lastLabelled) >= RING_AXIS_LABEL_GAP_PX
    if (labelled) {
      lastLabelled = radius
    }
    return [{ radius, label: labelled ? (label ?? `${value}`) : undefined }]
  })
}

/** Strip px per ring px, above 1 on a ring that `layoutRings` shrank. */
function stripPerRingPx({ display, innerPx, outerPx }: Ring) {
  const band = outerPx - innerPx
  return band > 0 ? display.height / band : 1
}

/**
 * The strip point under a screen point on the circle, or undefined off every
 * ring. `dx`/`dy` are CSS px from the circle's centre in the screen frame and
 * `x`/`y` are CSS px into the ring's strip.
 */
export function ringHit(
  rings: readonly Ring[],
  dx: number,
  dy: number,
  offsetRadians: number,
  stripRadiusPx: number,
) {
  const r = Math.hypot(dx, dy)
  const ring = rings.find(ring => r >= ring.innerPx && r <= ring.outerPx)
  if (!ring) {
    return undefined
  }
  let a = Math.atan2(dy, dx) - offsetRadians
  a -= Math.floor(a / TWO_PI) * TWO_PI
  return {
    ring,
    x: a * stripRadiusPx,
    y: (ring.outerPx - r) * stripPerRingPx(ring),
  }
}

/**
 * Where a display's canvas sits in its strip, in CSS px: a display may inset
 * its plot (wiggle leaves room for its axis labels), and the ring samples the
 * canvas, not the strip, so its band is the canvas's box.
 */
function canvasBox(
  strip: HTMLElement | undefined,
  canvas: HTMLCanvasElement | null | undefined,
) {
  if (!strip || !canvas) {
    return { top: 0, height: Infinity }
  }
  const s = strip.getBoundingClientRect()
  const c = canvas.getBoundingClientRect()
  return c.height > 0
    ? { top: c.top - s.top, height: c.height }
    : { top: 0, height: Infinity }
}

/** Whether two cells would upload the same annulus and strip. */
function sameCell(a: RingCell | undefined, b: RingCell | undefined) {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.index === b.index &&
      a.display === b.display &&
      a.paintCount === b.paintCount &&
      a.strip?.image === b.strip?.image &&
      a.strip?.width === b.strip?.width &&
      a.strip?.height === b.strip?.height &&
      a.channels.innerPx[0] === b.channels.innerPx[0] &&
      a.channels.outerPx[0] === b.channels.outerPx[0])
  )
}

/**
 * One canvas of rings — a `RenderLifecycleMixin` node per group of
 * `RING_PASSES`, since a pass holds one texture and a canvas's passes are
 * declared when its backend is built.
 */
export const RingPass = types
  .compose('CircularRingPass', RenderLifecycleMixin(), types.model({}))
  .volatile(() => ({
    host: undefined as RingHostModel | undefined,
    group: 0,
  }))
  .views(self => ({
    get frame(): RingFrame {
      const { view } = self.host!
      const [ox, oy] = view.figureOriginXY
      const [cx, cy] = view.centerXY
      return {
        canvasWidth: view.width,
        canvasHeight: view.height,
        centerX: ox + cx,
        centerY: oy + cy,
        offsetRadians: view.offsetRadians,
      }
    },
    get cells(): ReadonlyMap<number, RingCell> {
      const cells = new Map<number, RingCell>()
      const first = self.group * RING_PASSES
      for (const cell of self.host!.ringCells) {
        if (cell.index >= first && cell.index < first + RING_PASSES) {
          cells.set(cell.index - first, cell)
        }
      }
      return cells
    },
    get canRender() {
      return self.host?.view.initialized ?? false
    },
  }))
  .actions(self => ({
    setGroup(host: RingHostModel, group: number) {
      self.host = host
      self.group = group
    },
    startRenderingBackend(backend: RingBackend) {
      for (const cell of self.cells.values()) {
        cell.display.renderNow()
      }
      installUpload(self, backend, {
        cells: () => self.cells,
        render: (b, cells) => {
          const frame = self.frame
          return b.renderBlocks(
            canvasWideBlocks(cells.keys(), frame.canvasWidth),
            cells,
            frame,
          )
        },
      })
    },
  }))

export interface RingPassModel extends Instance<typeof RingPass> {}

/**
 * The circular view's strip axis and its rings. A `RegionHost` a linear
 * display lays its regions out against — the circumference unrolled into a
 * strip, one block per slice — and the owner of the canvases that resample
 * each display's strip into its ring.
 *
 * Never attached: the view holds it as a volatile and `containingHost`
 * answers it for a display whose `getContainingView` is the circular view.
 */
export const RingHost = types
  .model('CircularRingHost', {})
  .volatile(() => ({
    view: undefined as unknown as RingHostView,
    coarseBpPerPx: 1,
    coarseDynamicBlocks: [] as ContentBlock[],
    passes: [] as RingPassModel[],
    stripElements: observable.map<string, HTMLElement>(),
    cellsByDisplay: observable.map<
      string,
      IComputedValue<RingCell | undefined>
    >(undefined, { deep: false }),
  }))
  .views(self => ({
    get id() {
      return `${self.view.id}-rings`
    },
    get type() {
      return 'CircularRingHost'
    },
    get displayName() {
      return self.view.displayName
    },
    get minimized() {
      return self.view.minimized
    },
    get bodyMounted() {
      return self.view.bodyMounted
    },
    get effectiveBodyMounted() {
      return self.view.effectiveBodyMounted
    },
    get assemblyNames() {
      return self.view.assemblyNames
    },
    get initialized() {
      return self.view.initialized
    },
    get displayedRegions() {
      return self.view.displayedRegions
    },
    get offsetPx() {
      return 0
    },
    /**
     * The strip's scale against the circle: 1 until the circumference outruns
     * the widest canvas a backing store holds, then the fraction that fits.
     */
    get stripScale() {
      return Math.min(1, maxCanvasCssPx() / self.view.circumferencePx)
    },
    get stripRadiusPx() {
      return self.view.radiusPx * this.stripScale
    },
    get width() {
      return self.view.circumferencePx * this.stripScale
    },
    get trackWidthPx() {
      return this.width
    },
    get totalWidthPx() {
      return this.width
    },
    get contentRightEdgePx() {
      return this.width
    },
    get bpPerPx() {
      return self.view.bpPerPx / this.stripScale
    },
    get staticBlocks() {
      return stripBlocks(self.view.staticSlices, this.stripRadiusPx)
    },
    get dynamicBlocks() {
      return this.staticBlocks
    },
    get settledDynamicBlocks(): ContentBlock[] {
      return self.coarseDynamicBlocks.length
        ? self.coarseDynamicBlocks
        : this.dynamicBlocks.contentBlocks
    },
    get visibleRegions() {
      return this.dynamicBlocks.contentBlocks.map(block => ({
        refName: block.refName,
        start: block.start,
        end: block.end,
        assemblyName: block.assemblyName,
        reversed: block.reversed,
        displayedRegionIndex: block.displayedRegionIndex!,
        screenStartPx: block.offsetPx,
        screenEndPx: block.offsetPx + block.widthPx,
      }))
    },
    get bufferedVisibleRegions() {
      return this.visibleRegions.map(vr => ({
        region: {
          refName: vr.refName,
          start: vr.start,
          end: vr.end,
          assemblyName: vr.assemblyName,
          reversed: vr.reversed,
        },
        displayedRegionIndex: vr.displayedRegionIndex,
      }))
    },
    get visibleBp() {
      return this.dynamicBlocks.totalBp
    },
    get hasVisibleContent() {
      return this.dynamicBlocks.contentBlocks.length > 0
    },
    get visibleWholeBaseRegions() {
      return wholeBaseRegions(this.dynamicBlocks.contentBlocks)
    },
    get totalWidthPxWithoutBorders() {
      return this.width
    },
    get minBpPerPx() {
      return this.bpPerPx
    },
    get tracks() {
      return self.view.tracks
    },
    get colorByCDS() {
      return false
    },
    get showAminoAcids() {
      return false
    },
    /**
     * A 0-based coord's strip pixel, as the linear genome view answers it:
     * undefined off every drawn slice, an elided run included.
     */
    bpToPx({
      refName,
      coord,
      displayedRegionIndex,
    }: {
      refName: string
      coord: number
      displayedRegionIndex?: number
    }) {
      const { bpPerPx } = this
      for (const block of this.staticBlocks.contentBlocks) {
        if (
          block.refName === refName &&
          coord >= block.start &&
          coord <= block.end &&
          (displayedRegionIndex === undefined ||
            displayedRegionIndex === block.displayedRegionIndex)
        ) {
          return {
            index: block.displayedRegionIndex!,
            offsetPx: Math.round(
              block.offsetPx +
                (block.reversed ? block.end - coord : coord - block.start) /
                  bpPerPx,
            ),
          }
        }
      }
      return undefined
    },
    /**
     * The base under a strip pixel, in the linear genome view's shape. A pixel
     * in a gap between slices answers the slice before it, out of bounds.
     */
    pxToBp(px: number): PxToBpResult {
      const blocks = this.staticBlocks.contentBlocks
      const first = blocks[0]
      if (!first) {
        throw new Error('pxToBp called with no drawn slice')
      }
      let block = first
      for (const b of blocks) {
        if (px >= b.offsetPx) {
          block = b
        }
      }
      const offset = (px - block.offsetPx) * this.bpPerPx
      const oob = offset < 0 || offset >= block.end - block.start
      const base0 = Math.floor(
        block.reversed ? block.end - offset : block.start + offset,
      )
      return {
        refName: block.refName,
        start: block.start,
        end: block.end,
        assemblyName: block.assemblyName,
        reversed: block.reversed,
        index: block.displayedRegionIndex!,
        offset,
        oob,
        coord: base0 + 1,
        coord0: base0,
      }
    },
    /**
     * The view's tracks whose display draws on the strip: every display a
     * display type registered for another view lays out this way, where one
     * registered for the circular view draws chords.
     */
    get ringDisplays(): RingDisplay[] {
      const { pluginManager } = getEnv(self.view)
      return self.view.tracks
        .map(t => t.displays[0])
        .filter(
          (d): d is RingDisplay =>
            d !== undefined &&
            pluginManager.getDisplayType(d.type).viewType !== 'CircularView',
        )
    },
    get rings(): Ring[] {
      return layoutRings(this.ringDisplays, self.view.radiusPx)
    },
    /**
     * Where the chords start: inside the innermost ring, or at the ruler when
     * there is none.
     */
    get chordRadiusPx() {
      const last = this.rings.at(-1)
      return last ? last.innerPx - RING_GAP_PX : self.view.radiusPx
    },
    /**
     * One ring's upload payload: its annulus, trimmed to where the display's
     * canvas sits in its strip, and the strip canvas it samples.
     */
    ringCell(displayId: string): RingCell | undefined {
      const index = this.rings.findIndex(r => r.display.id === displayId)
      const ring = this.rings[index]
      if (!ring) {
        return undefined
      }
      const { display } = ring
      const el = self.stripElements.get(displayId)
      const canvas = el?.querySelector('canvas')
      const strip: MarkImage | undefined =
        canvas && canvas.width > 0 && canvas.height > 0
          ? { image: canvas, width: canvas.width, height: canvas.height }
          : undefined
      const box = canvasBox(el, canvas)
      const scale = stripPerRingPx(ring)
      const outerPx = ring.outerPx - box.top / scale
      const innerPx = Math.max(ring.innerPx, outerPx - box.height / scale)
      return {
        index,
        display,
        paintCount: display.paintCount,
        channels: {
          innerPx: new Float32Array([innerPx]),
          outerPx: new Float32Array([outerPx]),
          count: 1,
        },
        strip,
      }
    },
    /**
     * Every ring's cell, each the same object until its own annulus or strip
     * changes: the upload diffs by reference, and a moved cell is a texture
     * copy.
     */
    get ringCells(): RingCell[] {
      return this.rings.flatMap(({ display }) => {
        const cell = self.cellsByDisplay.get(display.id)?.get()
        return cell ? [cell] : []
      })
    },
    /**
     * The ring under a point, with the strip coordinates the display's own
     * hit test takes. `dx`/`dy` are CSS px from the circle's centre in the
     * screen frame.
     */
    ringHit(dx: number, dy: number) {
      return ringHit(
        this.rings,
        dx,
        dy,
        self.view.offsetRadians,
        this.stripRadiusPx,
      )
    },
    menuItems(): MenuItem[] {
      return []
    },
  }))
  .actions(self => ({
    setWidth() {},
    setBodyMounted() {},
    setMinimized() {},
    setDisplayName() {},
    scrollZoom() {},
    setStripElement(displayId: string, el: HTMLElement | null) {
      if (el) {
        self.stripElements.set(displayId, el)
      } else {
        self.stripElements.delete(displayId)
      }
    },
    setCoarseDynamicBlocks(blocks: BlockSet, bpPerPx: number) {
      const next = blocks.contentBlocks
      const same =
        bpPerPx === self.coarseBpPerPx &&
        next.length === self.coarseDynamicBlocks.length &&
        next.every((b, i) => b.key === self.coarseDynamicBlocks[i]!.key)
      if (!same) {
        self.coarseDynamicBlocks = next
        self.coarseBpPerPx = bpPerPx
      }
    },
    syncRings(displayIds: string[]) {
      for (const id of [...self.cellsByDisplay.keys()]) {
        if (!displayIds.includes(id)) {
          self.cellsByDisplay.delete(id)
        }
      }
      for (const id of displayIds) {
        if (!self.cellsByDisplay.has(id)) {
          self.cellsByDisplay.set(
            id,
            computed(() => self.ringCell(id), { equals: sameCell }),
          )
        }
      }
      const wanted = Math.ceil(displayIds.length / RING_PASSES)
      while (self.passes.length < wanted) {
        const pass = RingPass.create({})
        pass.setGroup(self as RingHostModel, self.passes.length)
        self.passes = [...self.passes, pass]
      }
      while (self.passes.length > wanted) {
        const pass = self.passes.at(-1)!
        self.passes = self.passes.slice(0, -1)
        destroy(pass)
      }
    },
  }))
  .actions(self => ({
    setView(view: RingHostView) {
      self.view = view
      let timer: ReturnType<typeof setTimeout> | undefined
      addDisposer(
        self,
        autorun(() => {
          if (!view.initialized) {
            return
          }
          const { dynamicBlocks, bpPerPx } = self
          clearTimeout(timer)
          timer = setTimeout(() => {
            self.setCoarseDynamicBlocks(dynamicBlocks, bpPerPx)
          }, 500)
        }),
      )
      addDisposer(self, () => {
        clearTimeout(timer)
      })
      addDisposer(
        self,
        autorun(() => {
          if (view.initialized) {
            self.syncRings(self.rings.map(r => r.display.id))
          }
        }),
      )
    },
    beforeDestroy() {
      for (const pass of self.passes) {
        destroy(pass)
      }
    },
  }))

export interface RingHostModel extends Instance<typeof RingHost> {}

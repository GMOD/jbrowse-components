import { readConfObject } from '@jbrowse/core/configuration'
import { LayoutSession } from '@jbrowse/core/pluggableElementTypes/renderers/LayoutSession'
import MultiLayout from '@jbrowse/core/util/layouts/MultiLayout'
import deepEqual from 'fast-deep-equal'

import type { FilterBy, SortedBy } from '../shared/types'
import type {
  CachedLayout,
  LayoutSessionProps,
} from '@jbrowse/core/pluggableElementTypes/renderers/LayoutSession'
import type {
  RectTuple,
  Rectangle,
  SerializedLayout,
} from '@jbrowse/core/util/layouts'

export interface PileupLayoutSessionProps extends LayoutSessionProps {
  filterBy: FilterBy
  sortedBy: SortedBy
  showSoftClip: boolean
}

type MyMultiLayout = MultiLayout<EndArrayLayout<unknown>, unknown>

interface CachedPileupLayout extends CachedLayout {
  props: PileupLayoutSessionProps
}

export default class EndArrayLayout<T> {
  ylim: number
  pitchY = 1
  pitchX = 1
  endArray: number[]
  rectangles = new Map<string, Rectangle<T>>()
  padding: number
  hardRowLimit = 1000
  maxHeightReached = false
  noSpacing: boolean

  constructor(arg?: { padding?: number; ylim?: number; noSpacing: boolean }) {
    const { noSpacing = false, ylim = 1000, padding = 3 } = arg || {}
    this.ylim = ylim
    this.padding = padding
    this.noSpacing = noSpacing
    this.endArray = new Array(ylim).fill(-Infinity)
  }

  findYPosition(startPosition: number) {
    for (let y = 0; y < this.ylim; y++) {
      if (startPosition > this.endArray[y]!) {
        return y
      }
    }
    return -1
  }
  addRectToBitmap(_rect: Rectangle<T>, _top: number): boolean {
    throw new Error('Method not implemented.')
  }
  collides(_rect: Rectangle<T>, _top: number): boolean {
    throw new Error('Method not implemented.')
  }

  discardRange() {
    throw new Error('Method not implemented.')
  }

  serializeRegion(region: { start: number; end: number }): SerializedLayout {
    // Filter rectangles that overlap with the given region
    const relevantRects: Record<string, RectTuple> = {}

    for (const [id, rect] of this.rectangles.entries()) {
      if (rect.r > region.start && rect.l < region.end) {
        const { l, r, h, top = 0 } = rect
        if (top !== null) {
          const t = top * h
          const b = t + h
          relevantRects[id] = [l, t, r, b] // left, top, right, bottom
        }
      }
    }

    return {
      rectangles: relevantRects,
      totalHeight: this.getTotalHeight(),
      maxHeightReached: this.maxHeightReached,
    }
  }

  getTotalHeight() {
    return 1000
  }

  toJSON() {
    return {} as any
  }
  addRect(
    id: string,
    left: number,
    right: number,
    h: number,
    data?: T,
  ): number | null {
    const storedRec = this.rectangles.get(id)
    if (storedRec) {
      return storedRec.top
    } else {
      const y = this.findYPosition(left)
      if (y !== -1) {
        this.endArray[y] = right
        const top = y * h + (this.noSpacing ? 0 : y)
        this.rectangles.set(id, {
          l: left,
          r: right,
          top,
          originalHeight: h,
          h: h,
          id,
          data,
        })
        return top
      } else {
        return null
      }
    }
  }

  getRectangles(): Map<string, RectTuple> {
    return new Map(
      Array.from(this.rectangles.entries()).map(([id, rect]) => {
        const { l, r, h, top } = rect
        const t = top || 0
        const b = t + h
        return [id, [l, t, r, b]] // left, top, right, bottom
      }),
    )
  }
}

export class PileupLayoutSession extends LayoutSession {
  props: PileupLayoutSessionProps

  cachedLayout: CachedPileupLayout | undefined

  constructor(props: PileupLayoutSessionProps) {
    super(props)
    this.props = props
  }

  update(props: PileupLayoutSessionProps) {
    super.update(props)
    this.props = props
    return this
  }

  cachedLayoutIsValid(cachedLayout: CachedPileupLayout) {
    return (
      super.cachedLayoutIsValid(cachedLayout) &&
      this.props.showSoftClip === cachedLayout.props.showSoftClip &&
      deepEqual(this.props.sortedBy, cachedLayout.props.sortedBy) &&
      deepEqual(this.props.filterBy, cachedLayout.props.filterBy)
    )
  }
  makeLayout() {
    return new MultiLayout(EndArrayLayout, {
      maxHeight: readConfObject(this.props.config, 'maxHeight'),
      displayMode: readConfObject(this.props.config, 'displayMode'),
      pitchX: this.props.bpPerPx,
      pitchY: readConfObject(this.props.config, 'noSpacing') ? 1 : 3,
      noSpacing: readConfObject(this.props.config, 'noSpacing'),
    })
  }
  get layout(): MyMultiLayout {
    if (!this.cachedLayout || !this.cachedLayoutIsValid(this.cachedLayout)) {
      this.cachedLayout = {
        layout: this.makeLayout(),
        props: this.props,
      }
    }
    return this.cachedLayout.layout
  }
}

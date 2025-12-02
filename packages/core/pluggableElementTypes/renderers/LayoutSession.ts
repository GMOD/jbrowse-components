import deepEqual from 'fast-deep-equal'

import { readConfObject } from '../../configuration'
import GranularRectLayout from '../../util/layouts/GranularRectLayout'
import MultiLayout from '../../util/layouts/MultiLayout'

import type { AnyConfigurationModel } from '../../configuration'
import type { Region } from '../../util'
import type SerializableFilterChain from './util/serializableFilterChain'

export interface LayoutSessionProps {
  regions: Region[]
  config: AnyConfigurationModel
  bpPerPx: number
  filters?: SerializableFilterChain
}

export type MyMultiLayout = MultiLayout<GranularRectLayout<unknown>, unknown>

export interface CachedLayout {
  layout: MyMultiLayout
  props: LayoutSessionProps
  /** Track the min/max coordinates we've seen to detect large jumps */
  minCoord: number
  maxCoord: number
}

/**
 * Check if two regions overlap
 */
function regionsOverlap(
  r1Start: number,
  r1End: number,
  r2Start: number,
  r2End: number,
) {
  return r1End > r2Start && r2End > r1Start
}

export class LayoutSession {
  props: LayoutSessionProps

  cachedLayout: CachedLayout | undefined

  /** Flag indicating the layout was reset (due to jump or config change) */
  layoutWasReset = false

  constructor(props: LayoutSessionProps) {
    this.props = props
  }

  /**
   * Check if layout was reset and clear the flag.
   * Used to signal to the client that all blocks should re-render.
   */
  checkAndClearLayoutWasReset() {
    const wasReset = this.layoutWasReset
    this.layoutWasReset = false
    return wasReset
  }

  update(props: LayoutSessionProps) {
    this.props = props
    return this
  }

  makeLayout() {
    return new MultiLayout(GranularRectLayout, {
      maxHeight: readConfObject(this.props.config, 'maxHeight'),
      displayMode: readConfObject(this.props.config, 'displayMode'),
      pitchX: this.props.bpPerPx,
      pitchY: readConfObject(this.props.config, 'noSpacing') ? 1 : 3,
    })
  }

  cachedLayoutIsValid(cachedLayout: CachedLayout) {
    if (
      cachedLayout.props.bpPerPx !== this.props.bpPerPx ||
      !deepEqual(
        readConfObject(this.props.config),
        readConfObject(cachedLayout.props.config),
      ) ||
      !deepEqual(this.props.filters, cachedLayout.props.filters)
    ) {
      return false
    }

    // Check if current regions overlap with the cached coordinate range
    // If there's no overlap, we've scrolled far away and should discard the layout
    const region = this.props.regions[0]
    if (region) {
      const hasOverlap = regionsOverlap(
        region.start,
        region.end,
        cachedLayout.minCoord,
        cachedLayout.maxCoord,
      )
      if (!hasOverlap) {
        return false
      }
    }

    return true
  }

  get layout(): MyMultiLayout {
    const region = this.props.regions[0]
    const regionStart = region?.start ?? 0
    const regionEnd = region?.end ?? 0

    if (!this.cachedLayout || !this.cachedLayoutIsValid(this.cachedLayout)) {
      // Only signal reset if we're recreating an existing layout, not on first creation.
      // On first load there are no stale blocks to worry about.
      if (this.cachedLayout) {
        this.layoutWasReset = true
      }
      this.cachedLayout = {
        layout: this.makeLayout(),
        props: this.props,
        minCoord: regionStart,
        maxCoord: regionEnd,
      }
    } else {
      // Expand the tracked coordinate range as we see new regions
      this.cachedLayout.minCoord = Math.min(
        this.cachedLayout.minCoord,
        regionStart,
      )
      this.cachedLayout.maxCoord = Math.max(
        this.cachedLayout.maxCoord,
        regionEnd,
      )
    }
    return this.cachedLayout.layout
  }
}

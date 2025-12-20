import deepEqual from 'fast-deep-equal'

import { readConfObject } from '../../configuration'
import GranularRectLayout from '../../util/layouts/GranularRectLayout'
import MultiLayout from '../../util/layouts/MultiLayout'

import type { AnyConfigurationModel } from '../../configuration'
import type { Region } from '../../util'
import type SerializableFilterChain from './util/serializableFilterChain'
import type { BaseLayout } from '../../util/layouts'

export interface LayoutSessionProps {
  regions: Region[]
  config: AnyConfigurationModel
  bpPerPx: number
  filters?: SerializableFilterChain
}

// Generic type for any MultiLayout
export type BaseMultiLayout = MultiLayout<BaseLayout<unknown>, unknown>

// Default type for GranularRectLayout (backwards compatibility)
export type MyMultiLayout = MultiLayout<GranularRectLayout<unknown>, unknown>

export interface CachedLayout {
  layout: BaseMultiLayout
  props: LayoutSessionProps
}

// Generic session interface that any layout session must implement
export interface LayoutSessionLike {
  layout: BaseMultiLayout
  update(props: LayoutSessionProps): LayoutSessionLike
  checkAndClearLayoutWasReset(): boolean
}

export class LayoutSession implements LayoutSessionLike {
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

    // Note: We intentionally do NOT check for coordinate overlap here.
    // This allows disparate regions in the same view (e.g., chr1:1-100 and chr1:5000-5100)
    // to share the same layout without triggering a reset.
    // Memory cleanup is handled by discardRange() when blocks are destroyed.

    return true
  }

  get layout(): BaseMultiLayout {
    if (!this.cachedLayout || !this.cachedLayoutIsValid(this.cachedLayout)) {
      // Only signal reset if we're recreating an existing layout, not on first creation.
      // On first load there are no stale blocks to worry about.
      if (this.cachedLayout) {
        this.layoutWasReset = true
      }
      this.cachedLayout = {
        layout: this.makeLayout(),
        props: this.props,
      }
    }
    return this.cachedLayout.layout
  }
}

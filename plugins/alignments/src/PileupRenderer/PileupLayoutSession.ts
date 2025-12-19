import { readConfObject } from '@jbrowse/core/configuration'
import { MultiLayout, PileupLayout } from '@jbrowse/core/util/layouts'
import deepEqual from 'fast-deep-equal'

import type { FilterBy, SortedBy } from '../shared/types'
import type {
  LayoutSessionLike,
  LayoutSessionProps,
} from '@jbrowse/core/pluggableElementTypes/renderers/LayoutSession'

export interface PileupLayoutSessionProps extends LayoutSessionProps {
  filterBy: FilterBy
  sortedBy: SortedBy
  showSoftClip: boolean
}

type MyMultiLayout = MultiLayout<PileupLayout<unknown>, unknown>

interface CachedPileupLayout {
  layout: MyMultiLayout
  props: PileupLayoutSessionProps
}

export class PileupLayoutSession implements LayoutSessionLike {
  props: PileupLayoutSessionProps

  cachedLayout: CachedPileupLayout | undefined

  layoutWasReset = false

  constructor(props: PileupLayoutSessionProps) {
    this.props = props
  }

  checkAndClearLayoutWasReset() {
    const wasReset = this.layoutWasReset
    this.layoutWasReset = false
    return wasReset
  }

  update(props: LayoutSessionProps) {
    this.props = props as PileupLayoutSessionProps
    return this
  }

  makeLayout() {
    const noSpacing = readConfObject(this.props.config, 'noSpacing')
    const featureHeight = readConfObject(this.props.config, 'height')
    const maxHeight = readConfObject(this.props.config, 'maxHeight')

    return new MultiLayout(PileupLayout, {
      featureHeight,
      spacing: noSpacing ? 0 : 2,
      maxHeight,
    })
  }

  cachedLayoutIsValid(cachedLayout: CachedPileupLayout) {
    return (
      cachedLayout.props.bpPerPx === this.props.bpPerPx &&
      deepEqual(
        readConfObject(this.props.config),
        readConfObject(cachedLayout.props.config),
      ) &&
      deepEqual(this.props.filters, cachedLayout.props.filters) &&
      this.props.showSoftClip === cachedLayout.props.showSoftClip &&
      deepEqual(this.props.sortedBy, cachedLayout.props.sortedBy) &&
      deepEqual(this.props.filterBy, cachedLayout.props.filterBy)
    )
  }

  get layout(): MyMultiLayout {
    if (!this.cachedLayout || !this.cachedLayoutIsValid(this.cachedLayout)) {
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

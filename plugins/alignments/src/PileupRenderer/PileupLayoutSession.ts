import { LayoutSession } from '@jbrowse/core/pluggableElementTypes/renderers/LayoutSession'
import deepEqual from 'fast-deep-equal'

import type { FilterBy, SortedBy } from '../shared/types'
import type {
  CachedLayout,
  LayoutSessionProps,
} from '@jbrowse/core/pluggableElementTypes/renderers/LayoutSession'
import type GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import type MultiLayout from '@jbrowse/core/util/layouts/MultiLayout'

export interface PileupLayoutSessionProps extends LayoutSessionProps {
  filterBy: FilterBy
  sortedBy: SortedBy
  showSoftClip: boolean
}

type MyMultiLayout = MultiLayout<GranularRectLayout<unknown>, unknown>

interface CachedPileupLayout extends CachedLayout {
  props: PileupLayoutSessionProps
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

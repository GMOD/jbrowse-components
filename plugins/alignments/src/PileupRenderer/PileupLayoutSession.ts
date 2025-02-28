import { readConfObject } from '@jbrowse/core/configuration'
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
  filterBy?: FilterBy
  sortedBy?: SortedBy
  showSoftClip: boolean
}

// The pileup layout session adds
// - sorting and revealing soft clip changes the layout of pileup renderer
// - extra conditions to see if cached layout is valid
export class PileupLayoutSession extends LayoutSession {
  sortedBy?: SortedBy

  filterBy?: FilterBy

  showSoftClip = false

  cachedLayout: CachedPileupLayout | undefined

  constructor(args: PileupLayoutSessionProps) {
    super(args)
    this.sortedBy = args.sortedBy
    this.filterBy = args.filterBy
    this.showSoftClip = args.showSoftClip
  }

  update(args: PileupLayoutSessionProps) {
    super.update(args)
    this.filterBy = args.filterBy
    this.sortedBy = args.sortedBy
    this.showSoftClip = args.showSoftClip
    return this
  }

  cachedLayoutIsValid(cachedLayout: CachedPileupLayout) {
    return (
      super.cachedLayoutIsValid(cachedLayout) &&
      this.showSoftClip === cachedLayout.showSoftClip &&
      deepEqual(this.sortedBy, cachedLayout.sortedBy) &&
      deepEqual(this.filterBy, cachedLayout.filterBy)
    )
  }

  get layout(): MyMultiLayout {
    if (!this.cachedLayout || !this.cachedLayoutIsValid(this.cachedLayout)) {
      this.cachedLayout = {
        layout: this.makeLayout(),
        config: readConfObject(this.config),
        filters: this.filters,
        filterBy: this.filterBy,
        sortedBy: this.sortedBy,
        showSoftClip: this.showSoftClip,
      }
    }
    return this.cachedLayout.layout
  }
}

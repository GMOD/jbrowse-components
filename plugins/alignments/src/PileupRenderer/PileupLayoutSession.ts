import { readConfObject } from '@jbrowse/core/configuration'
import { LayoutSession } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import deepEqual from 'fast-deep-equal'
// types
import type { FilterBy, SortedBy } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import type MultiLayout from '@jbrowse/core/util/layouts/MultiLayout'

export interface PileupLayoutSessionProps {
  config: AnyConfigurationModel
  bpPerPx: number
  filters: SerializableFilterChain
  filterBy: FilterBy
  sortedBy: SortedBy
  showSoftClip: boolean
}

type MyMultiLayout = MultiLayout<GranularRectLayout<unknown>, unknown>

interface CachedPileupLayout {
  layout: MyMultiLayout
  config: AnyConfigurationModel
  filters?: SerializableFilterChain
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

  constructor(args: PileupLayoutSessionProps) {
    super(args)
    this.config = args.config
  }

  cachedLayoutIsValid(cachedLayout: CachedPileupLayout) {
    return (
      super.cachedLayoutIsValid(cachedLayout) &&
      this.showSoftClip === cachedLayout.showSoftClip &&
      deepEqual(this.sortedBy, cachedLayout.sortedBy) &&
      deepEqual(this.filterBy, cachedLayout.filterBy)
    )
  }

  cachedLayout: CachedPileupLayout | undefined

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

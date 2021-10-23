import deepEqual from 'fast-deep-equal'
import { LayoutSession } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import MultiLayout from '@jbrowse/core/util/layouts/MultiLayout'
import { readConfObject } from '@jbrowse/core/configuration'

export interface PileupLayoutSessionProps {
  config: AnyConfigurationModel
  bpPerPx: number
  filters: SerializableFilterChain
  sortedBy: unknown
  showSoftClip: unknown
}

type MyMultiLayout = MultiLayout<GranularRectLayout<unknown>, unknown>
interface CachedPileupLayout {
  layout: MyMultiLayout
  config: AnyConfigurationModel
  filters: SerializableFilterChain
  sortedBy: unknown
  showSoftClip: boolean
}
// Sorting and revealing soft clip changes the layout of Pileup renderer
// Adds extra conditions to see if cached layout is valid
export class PileupLayoutSession extends LayoutSession {
  sortedBy: unknown

  showSoftClip = false

  constructor(args: PileupLayoutSessionProps) {
    super(args)
    this.config = args.config
  }

  cachedLayoutIsValid(cachedLayout: CachedPileupLayout) {
    return (
      super.cachedLayoutIsValid(cachedLayout) &&
      this.showSoftClip === cachedLayout.showSoftClip &&
      deepEqual(this.sortedBy, cachedLayout.sortedBy)
    )
  }

  cachedLayout: CachedPileupLayout | undefined

  get layout(): MyMultiLayout {
    if (!this.cachedLayout || !this.cachedLayoutIsValid(this.cachedLayout)) {
      this.cachedLayout = {
        layout: this.makeLayout(),
        config: readConfObject(this.config),
        filters: this.filters,
        sortedBy: this.sortedBy,
        showSoftClip: this.showSoftClip,
      }
    }
    return this.cachedLayout.layout
  }
}

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
}

export class LayoutSession {
  props: LayoutSessionProps

  cachedLayout: CachedLayout | undefined

  constructor(props: LayoutSessionProps) {
    this.props = props
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
    return (
      cachedLayout.props.bpPerPx === this.props.bpPerPx &&
      deepEqual(
        readConfObject(this.props.config),
        readConfObject(cachedLayout.props.config),
      ) &&
      deepEqual(this.props.filters, cachedLayout.props.filters)
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

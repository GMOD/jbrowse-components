import deepEqual from 'fast-deep-equal'

import { readConfObject } from '../../configuration/index.ts'
import GranularRectLayout from '../../util/layouts/GranularRectLayout.ts'
import MultiLayout from '../../util/layouts/MultiLayout.ts'

import type SerializableFilterChain from './util/serializableFilterChain.ts'
import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type { Region } from '../../util/index.ts'
import type { BaseLayout } from '../../util/layouts/index.ts'

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
}

export class LayoutSession implements LayoutSessionLike {
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
    const bpPerPxMatch = cachedLayout.props.bpPerPx === this.props.bpPerPx
    const currentConfig = readConfObject(this.props.config)
    const cachedConfig = readConfObject(cachedLayout.props.config)
    const configMatch = deepEqual(currentConfig, cachedConfig)
    const filtersMatch = deepEqual(
      this.props.filters,
      cachedLayout.props.filters,
    )
    return bpPerPxMatch && configMatch && filtersMatch
  }

  get layout(): BaseMultiLayout {
    if (!this.cachedLayout || !this.cachedLayoutIsValid(this.cachedLayout)) {
      this.cachedLayout = {
        layout: this.makeLayout(),
        props: this.props,
      }
    }
    return this.cachedLayout.layout
  }
}

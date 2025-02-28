import deepEqual from 'fast-deep-equal'

import { readConfObject } from '../../configuration'
import GranularRectLayout from '../../util/layouts/GranularRectLayout'
import MultiLayout from '../../util/layouts/MultiLayout'

import type { AnyConfigurationModel } from '../../configuration'
import type SerializableFilterChain from './util/serializableFilterChain'

export interface LayoutSessionProps {
  config: AnyConfigurationModel
  bpPerPx: number
  filters?: SerializableFilterChain
}

export type MyMultiLayout = MultiLayout<GranularRectLayout<unknown>, unknown>

export interface CachedLayout {
  layout: MyMultiLayout
  config: AnyConfigurationModel
  filters?: SerializableFilterChain
}

export class LayoutSession {
  config: AnyConfigurationModel

  bpPerPx: number

  filters?: SerializableFilterChain

  constructor(args: LayoutSessionProps) {
    this.config = args.config
    this.bpPerPx = args.bpPerPx
    this.filters = args.filters
  }

  update(args: LayoutSessionProps) {
    this.config = args.config
    this.bpPerPx = args.bpPerPx
    this.filters = args.filters
    return this
  }

  makeLayout() {
    return new MultiLayout(GranularRectLayout, {
      maxHeight: readConfObject(this.config, 'maxHeight'),
      displayMode: readConfObject(this.config, 'displayMode'),
      pitchX: this.bpPerPx,
      pitchY: readConfObject(this.config, 'noSpacing') ? 1 : 3,
    })
  }

  /**
   * @param layout -
   * @returns true if the given layout is a valid one to use for this session
   */
  cachedLayoutIsValid(cachedLayout: CachedLayout) {
    return (
      cachedLayout.layout.subLayoutConstructorArgs.pitchX === this.bpPerPx &&
      deepEqual(readConfObject(this.config), cachedLayout.config) &&
      deepEqual(this.filters, cachedLayout.filters)
    )
  }

  cachedLayout: CachedLayout | undefined

  get layout(): MyMultiLayout {
    if (!this.cachedLayout || !this.cachedLayoutIsValid(this.cachedLayout)) {
      this.cachedLayout = {
        layout: this.makeLayout(),
        config: readConfObject(this.config),
        filters: this.filters,
      }
    }
    return this.cachedLayout.layout
  }
}

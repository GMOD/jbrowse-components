import { getContainingView } from '@jbrowse/core/util'
import { observable } from 'mobx'

import { WiggleScoreConfigMixin } from './WiggleScoreConfigMixin.ts'
import { computeAutoscaleDomain, getNiceDomain } from '../util.ts'

import type { WiggleDataResult } from '../util.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel WiggleCommonMixin
 * #category display
 *
 * Extends WiggleScoreConfigMixin with rpcDataMap, autoscale domain, and cache
 * reset. Used by LinearWiggleDisplay and MultiLinearWiggleDisplay. Displays
 * that own a different rpcDataMap type should compose WiggleScoreConfigMixin
 * directly instead.
 */
export function WiggleCommonMixin() {
  return WiggleScoreConfigMixin()
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcDataMap: observable.map<number, WiggleDataResult>(),
    }))
    .views(() => ({
      /**
       * #getter
       * Source names to include when computing the autoscale domain;
       * `undefined` means every fetched source. Multi-wiggle always fetches all
       * sources and filters client-side, so it overrides this to the visible
       * subset — otherwise a subtree filter that hides sources would leave the
       * Y-axis scaled to the hidden ones.
       */
      get autoscaleSourceNames(): Set<string> | undefined {
        return undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get visibleScoreRange() {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized || self.rpcDataMap.size === 0) {
          return undefined
        }
        const numStdDev = self.numStdDev
        const names = self.autoscaleSourceNames
        // Use coarseDynamicBlocks (500ms debounced) instead of visibleRegions
        // so autoscale doesn't recompute on every animation frame during zoom.
        const visibleEntries = view.coarseDynamicBlocks.flatMap(block => {
          const regionData = self.rpcDataMap.get(block.displayedRegionIndex!)
          if (!regionData) {
            return []
          }
          const visStart = Math.floor(block.start)
          const visEnd = Math.ceil(block.end)
          return regionData.sources
            .filter(source => !names || names.has(source.name))
            .map(source => ({
              visStart,
              visEnd,
              data: source,
            }))
        })
        return computeAutoscaleDomain(
          self.autoscaleType,
          self.summaryScoreMode,
          numStdDev,
          visibleEntries,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get domain() {
        const range = self.visibleScoreRange
        if (!range) {
          return undefined
        }
        return getNiceDomain({
          domain: range,
          bounds: [self.minScoreBound, self.maxScoreBound],
          scaleType: self.scaleType,
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
        self.setLoadedBpPerPx(undefined)
      },
    }))
}

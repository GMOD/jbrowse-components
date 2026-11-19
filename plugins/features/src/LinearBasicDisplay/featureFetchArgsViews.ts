import { toJS } from 'mobx'

import { shouldRenderPeptideBackground } from '../RenderFeatureDataRPC/zoomThresholds.ts'

import type { RenderFeatureDataArgs } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { ResolvedGeneGlyphMode } from './geneGlyphMode.ts'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'

/** What {@link featureRpcPropsViews} reads. */
export interface FeatureRpcPropsHost {
  renderSettings: RenderFeatureDataArgs['displayConfig']
  parkedColor?: ColorSlots
  colorByFrame: boolean
  soloApplied: boolean
  soloFeatureIds: string[]
  hiddenFeatureIds: string[]
}

/**
 * The settings a `RenderFeatureData` fetch sends, which the display and the
 * tables' host both install, so a table fetches what the display fetches.
 */
export function featureRpcPropsViews(self: FeatureRpcPropsHost) {
  return {
    /**
     * #method
     */
    // Every field read here is an RPC cache key: the settings autorun
    // clears data when any of them changes.
    rpcProps() {
      const workerConfig = self.renderSettings
      return {
        displayConfig: {
          ...workerConfig,
          // the parked field's values ship too, so its way back refetches
          // nothing
          color: {
            ...workerConfig.color,
            field: workerConfig.color.field || self.parkedColor?.field || '',
          },
        },
        colorByFrame: self.colorByFrame,
        // Undefined while collecting, so building the set neither
        // refetches nor hides anything.
        soloFeatureIds:
          self.soloApplied && self.soloFeatureIds.length > 0
            ? toJS(self.soloFeatureIds)
            : undefined,
        hiddenFeatureIds:
          self.hiddenFeatureIds.length > 0
            ? toJS(self.hiddenFeatureIds)
            : undefined,
      }
    },
  }
}

/** What {@link featureZoomFetchArgsViews} reads. */
export interface FeatureZoomFetchArgsHost {
  host: { bpPerPx: number }
  effectiveGeneGlyphMode: ResolvedGeneGlyphMode
  showAminoAcids: boolean
  expandedGeneIds: string[]
}

/**
 * The zoom-dependent half of a `RenderFeatureData` fetch, which the display
 * and the tables' host both install.
 */
export function featureZoomFetchArgsViews(self: FeatureZoomFetchArgsHost) {
  return {
    /**
     * #method
     * The worker's zoom-dependent decisions, resolved: the RPC spreads this
     * object and the foundation stamps it beside each region, so a track
     * with the overlay off and a fixed mode never refetches on zoom.
     * `expandedGeneIds` only under `representative`, the one mode the worker
     * collapses in.
     */
    zoomFetchArgs() {
      const geneGlyphMode = self.effectiveGeneGlyphMode
      return {
        geneGlyphMode,
        peptides:
          self.showAminoAcids &&
          shouldRenderPeptideBackground(self.host.bpPerPx),
        expandedGeneIds:
          geneGlyphMode === 'representative' && self.expandedGeneIds.length > 0
            ? toJS(self.expandedGeneIds)
            : undefined,
      }
    },
  }
}

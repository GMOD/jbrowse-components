import { workerColorField } from '../shared/colorFieldDefs.ts'
import { fieldTag } from '../shared/facetLabels.ts'
import { workerFacet, workerInsertSizeBand } from '../shared/groupFeatures.ts'

import type { InsertSizeBand } from '../shared/insertSizeStats.ts'
import type { BaseLayer, Facet, SortColumn } from '../shared/types.ts'
import type { AlignmentsUnit } from './constants.ts'
import type { InterbaseIndicatorRule } from '@jbrowse/alignments-core/coverageBandConfigSchema'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

/** What {@link sortTagViews} reads. */
export interface SortTagHost {
  sortColumn: SortColumn | undefined
}

/** The tag a tag sort ships to the worker. */
export function sortTagViews(self: SortTagHost) {
  return {
    /**
     * #getter
     * The worker receives the tag name alone, so `rpcProps` re-notifies when
     * the tag changes, not when the sort position or a non-tag field flips.
     */
    get sortTag() {
      return fieldTag(self.sortColumn?.field)
    },
  }
}

/** What {@link rpcPropsViews} reads: every setting the worker is sent. */
export interface RpcPropsHost {
  readPredicates: FieldPredicate[]
  colorField: string | undefined
  tooltipField: string
  baseLayer: BaseLayer | undefined
  unit: AlignmentsUnit
  sortTag: string | undefined
  effectiveFacet: Facet | undefined
  pinnedInsertSizeBand: InsertSizeBand | undefined
  showSoftClips: boolean
  showCoverage: boolean
  interbaseIndicatorRule: InterbaseIndicatorRule
  hasJunctions: boolean
  showJunctions: boolean
}

/**
 * The settings a `RenderAlignmentData` fetch sends, which the display and the
 * tables' host both install, so a table fetches what the display fetches.
 */
export function rpcPropsViews(self: RpcPropsHost) {
  return {
    /**
     * #method
     * Fields that invalidate the fetched data, every one worker-bound.
     * Arc-only fields (`readConnections` and the connection filter) are
     * not here: `arcsResult` reads them and they need no refetch. Non-tag
     * sort changes and tag coloring (`readFillColors`, baked in
     * `laidOutByGroup`) stay main-thread. Every field is read off `self`: a
     * subclass override captures the base as a bare function, which would
     * lose a `this`.
     */
    rpcProps() {
      return {
        filter: self.readPredicates,
        // Only a field the worker reads, so switching between
        // shader-decided fields leaves these props identical and repaints
        // without a refetch.
        colorField: workerColorField(self.colorField),
        tooltipField: self.tooltipField,
        baseLayer: self.baseLayer,
        // Chain layout reads neither the sort tag nor soft-clipped bases,
        // so chain mode sends neither and "Show soft clipping" stays live
        // there.
        sortTag: self.unit === 'chain' ? undefined : self.sortTag,
        facet: workerFacet(self.effectiveFacet, self.unit),
        pinnedInsertSizeBand: workerInsertSizeBand(
          self.effectiveFacet,
          self.readPredicates,
          self.pinnedInsertSizeBand,
        ),
        showSoftClips: self.unit === 'chain' ? false : self.showSoftClips,
        // The worker skips the whole coverage-band pipeline, including the
        // per-bp GPU depth buffer that overflows the device limit at
        // chromosome scale, when the band is off.
        showCoverage: self.showCoverage,
        interbaseIndicators: self.interbaseIndicatorRule,
        // The junctions ride with coverage, so a junctions toggle with the
        // band shown refetches nothing; without it they ride with the arcs.
        // A display without the junctions band fetches none.
        junctions:
          self.hasJunctions && (self.showCoverage || self.showJunctions),
        // `readConnections` is not here: the SA tag walk it could gate also
        // feeds linked reads and the curved connectors (see
        // `extractFeatureArrays`).
      }
    },
  }
}

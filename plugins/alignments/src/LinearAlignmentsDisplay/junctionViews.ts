import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import { visibleRegionJunctions } from '../features/junctions/computeOverlay.ts'
import { mergeJunctions } from '../features/junctions/junctions.ts'
import { junctionSupportingReadSlots } from '../features/junctions/supportingReads.ts'
import { bandChips } from './bandChips.ts'
import { junctionKeyOf } from './keyWindows.ts'

import type { CanonicalRefName } from '../features/arcs/arcTypes.ts'
import type { HoveredJunction } from '../features/junctions/supportingReads.ts'
import type { JunctionFilter } from '../shared/types.ts'
import type { LaneSection } from './lanes.ts'
import type { KeyWindow } from '@jbrowse/display-kit/keyWindows'

/** What {@link junctionViews} reads. */
export interface JunctionViewsHost {
  view: {
    initialized: boolean
    visibleRegions: readonly { refName: string; displayedRegionIndex: number }[]
  }
  showJunctions: boolean
  junctionFilter: JunctionFilter
  renderSections: readonly LaneSection[]
  showPileup: boolean
  showsGroupLabels: boolean
  showLegend: boolean
  keyWindows: readonly KeyWindow[]
  loadedRegions: ReadonlyMap<number, { refName: string }>
  canonicalRefName: CanonicalRefName | undefined
}

/**
 * The junctions each lane draws, the band chips they shape, their key, and
 * the reads supporting one.
 */
export function junctionViews(self: JunctionViewsHost) {
  // The regions on screen as a value a pan frame compares equal:
  // `view.visibleRegions` rebuilds fresh objects every frame, and the
  // merge only needs which regions are on screen and what each is called.
  const junctionRegions = stableIdentityComputed(() => {
    const view = self.view
    return view.initialized
      ? view.visibleRegions.map(r => ({
          refName: r.refName,
          displayedRegionIndex: r.displayedRegionIndex,
        }))
      : []
  })
  return {
    /**
     * #getter
     * The junctions each lane draws, merged and filtered, in stacking
     * order. A gesture owes none of it: it reads loaded data, the on-screen
     * region set and the junction filters, and only the count labels
     * (`junctionLabels`) read the pan. Not a lane
     * field: a lane feeds the LAYOUT, which the on-screen region set must
     * never reach.
     */
    get junctionSections() {
      const view = self.view
      if (!self.showJunctions || !view.initialized) {
        return []
      }
      const filter = self.junctionFilter
      const regions = junctionRegions.get()
      return self.renderSections.map(sec => ({
        groupKey: sec.groupKey,
        junctionsStripKeys: sec.junctionsStripKeys,
        junctions: [
          ...mergeJunctions(
            visibleRegionJunctions(sec.rawPileupMap, regions),
            filter,
          ).values(),
        ],
      }))
    },

    /**
     * #getter
     * Whether any lane has a junction to draw. What the view's region
     * table and the count labels wait on, so a track of unspliced reads
     * pays for neither.
     */
    get drawsJunctions() {
      return this.junctionSections.some(sec => sec.junctions.length > 0)
    },

    /**
     * #getter
     * The chips naming each band that draws, in content space, once
     * for the stack, and the row the topmost section chip carries
     * (`bandChips`).
     */
    get bandChips() {
      const junctionSections = this.junctionSections
      return bandChips(
        self.renderSections.map((sec, i) => ({
          ...sec,
          junctionsOverCoverage:
            junctionSections[i]?.junctions.some(
              j => !sec.junctionsStripKeys.has(j.key),
            ) ?? false,
        })),
        self.showPileup,
        self.showsGroupLabels,
      )
    },

    /**
     * #getter
     * The splice junction strands and other junction kinds drawn in
     * `keyWindows`, one key row each (`junctionKeyOf`). Read off the
     * merged junctions and the settled window rather than the projected
     * arcs, so a pan's frames do not rebuild the legend.
     */
    get junctionLegendKeys() {
      return junctionKeyOf(
        self.showLegend
          ? this.junctionSections.flatMap(sec => sec.junctions)
          : [],
        self.keyWindows,
      )
    },

    /**
     * #method
     * The slots of the reads that support the junction, in its lane, or
     * in every drawn lane for a junction naming none.
     */
    junctionSupportingReadSlots(junction: HoveredJunction) {
      return self.renderSections
        .filter(
          s =>
            junction.groupKey === undefined || s.groupKey === junction.groupKey,
        )
        .flatMap(sec =>
          junctionSupportingReadSlots(
            [...sec.laidOutPileupMap].map(([i, data]) => ({
              displayedRegionIndex: i,
              refName: self.loadedRegions.get(i)?.refName,
              data,
            })),
            { ...junction, groupKey: sec.groupKey },
            self.canonicalRefName,
          ),
        )
    },
  }
}

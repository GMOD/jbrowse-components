import { legendSpecOf } from '@jbrowse/core/ui/colorScale'
import { types } from '@jbrowse/mobx-state-tree'

import { SyntenyColorsMixin } from './SyntenyColorsMixin.ts'
import { trackHasLodTiers } from './lodTier.ts'

import type { LodMode } from './lodTier.ts'
import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'

/**
 * #stateModel SyntenyViewMixin
 *
 * What the linear synteny and dotplot views share beyond `SyntenyColorsMixin`:
 * the level-of-detail tier every track draws at, and a colour key the reader
 * closes per mode.
 */
export function SyntenyViewMixin({ defaultAlpha }: { defaultAlpha: number }) {
  return types
    .compose(
      'SyntenyViewMixin',
      SyntenyColorsMixin({ defaultAlpha }),
      types.model({
        /**
         * #property
         * Level-of-detail tier selection for PIF adapters. 'auto' uses the
         * adapter's bpPerPx threshold; 'fine' forces the per-row CIGAR tier
         * (t/q); 'coarse' forces the tier whose CIGAR is folded to its large
         * indels (T/Q) when present. One value for the view, so every track
         * draws at the same tier.
         */
        lodMode: types.stripDefault(
          types.enumeration<LodMode>('LodMode', ['auto', 'fine', 'coarse']),
          'auto',
        ),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * The field whose legend the reader closed. The legend comes back with
       * the next field that has one, so a dismissal is scoped to the field it
       * was made in rather than being a setting to find again.
       */
      colorLegendDismissedFor: undefined as string | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * Whether any track's adapter has tiers to switch between, which gates
       * the "Level of detail" setting.
       */
      get hasLodCapableAdapter() {
        return self.syntenyTracks().some(trackHasLodTiers)
      },
      /**
       * #getter
       * The legend-host half of `LegendMixin` a view needs: whether the key
       * draws, which is the mode having one and the reader not having closed
       * it in this mode. `ChromeLegend` and `SvgLegend` read it.
       */
      get showLegend(): boolean {
        return (
          self.hasLegendKey &&
          self.colorLegendDismissedFor !== self.colorByField
        )
      },
      /**
       * #getter
       * The key `ChromeLegend` draws on screen and `SvgLegend` in the export.
       */
      get legendSpec(): LegendSpec {
        return legendSpecOf(self.colorScales)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLodMode(value: LodMode) {
        self.lodMode = value
      },
      /**
       * #action
       * The legend host's setter: closing the key hides it for this mode
       * only, so picking another mode brings its key up.
       */
      setShowLegend(show: boolean) {
        self.colorLegendDismissedFor = show ? undefined : self.colorByField
      },
      /**
       * #action
       * One section is the whole key here.
       */
      dismissLegendSection() {
        self.colorLegendDismissedFor = self.colorByField
      },
    }))
}

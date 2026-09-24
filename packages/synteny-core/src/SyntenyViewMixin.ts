import { getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { TrackColorsMixin } from './TrackColorsMixin.ts'
import { colorableColumns } from './attributeChannels.ts'
import { trackHasLodTiers } from './lodTier.ts'
import { DEFAULT_MIN_ALIGNMENT_LENGTH } from './minLengthHelp.ts'

import type { ComparativeTrackModel, LodMode } from './lodTier.ts'

/**
 * #stateModel SyntenyViewMixin
 *
 * What the linear synteny and dotplot views share beyond `TrackColorsMixin`:
 * the settings that mean one thing in both, and what the view's synteny
 * tracks answer. A view supplies `syntenyTracks()` and its opacity default;
 * the palette, the declared columns and the level-of-detail gate follow.
 */
export function SyntenyViewMixin({ defaultAlpha }: { defaultAlpha: number }) {
  return types
    .compose(
      'SyntenyViewMixin',
      TrackColorsMixin(),
      types.model({
        /**
         * #property
         * Opacity of every alignment, 0 to 1. A uniform, so a slider drag
         * recolours nothing. The synteny view defaults it low for dense
         * unfiltered hairballs (with minAlignmentLength set, ~0.4 gives
         * stronger colour); the dotplot defaults it opaque.
         */
        alpha: types.stripDefault(types.number, defaultAlpha),
        /**
         * #property
         * Hide alignment blocks shorter than this many bp, which cuts
         * whole-genome hairball noise.
         */
        minAlignmentLength: types.stripDefault(
          types.number,
          DEFAULT_MIN_ALIGNMENT_LENGTH,
        ),
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
    .views(() => ({
      /**
       * #method
       * Overridable hook: every synteny track in the view, in paint order.
       */
      syntenyTracks(): ComparativeTrackModel[] {
        return []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The `alpha` a reset returns to.
       */
      get defaultAlpha() {
        return defaultAlpha
      },
      /**
       * #getter
       * Whether any track's adapter has tiers to switch between, which gates
       * the "Level of detail" setting.
       */
      get hasLodCapableAdapter() {
        return self.syntenyTracks().some(trackHasLodTiers)
      },
      /**
       * #method
       */
      colorableTrackConfigs() {
        return self.syntenyTracks().map(t => {
          const { trackId, name } = t.configuration
          return { trackId, name }
        })
      },
      /**
       * #method
       * The columns the tracks declare in their adapter's `attributeColumns`
       * (the ortholog-table adapter's slot), one colour mode each.
       */
      colorableAttributeNames() {
        return colorableColumns(
          self.syntenyTracks().flatMap(t => {
            const declared = getConf(t, ['adapter', 'attributeColumns']) as
              | string[]
              | undefined
            return declared ?? []
          }),
        )
      },
      /**
       * #method
       * The key's chips are composited by the plot's opacity, as the
       * alignments are.
       */
      legendAlpha() {
        return self.alpha
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setAlpha(value: number) {
        self.alpha = value
      },
      /**
       * #action
       */
      setMinAlignmentLength(value: number) {
        self.minAlignmentLength = value
      },
      /**
       * #action
       */
      setLodMode(value: LodMode) {
        self.lodMode = value
      },
    }))
}

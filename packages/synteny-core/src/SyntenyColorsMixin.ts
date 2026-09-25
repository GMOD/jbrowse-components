import { getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { TrackColorsMixin } from './TrackColorsMixin.ts'
import { colorableColumns } from './attributeChannels.ts'
import { DEFAULT_MIN_ALIGNMENT_LENGTH } from './minLengthHelp.ts'

import type { ComparativeTrackModel } from './lodTier.ts'

/**
 * #stateModel SyntenyColorsMixin
 *
 * The colour settings every view drawing synteny tracks shares — the linear
 * synteny view, the dotplot and the circular view: `TrackColorsMixin`'s colour
 * object and palette, the plot's opacity and the shortest alignment drawn,
 * over the tracks the view says it draws. A view supplies `syntenyTracks()`
 * and its opacity default.
 */
export function SyntenyColorsMixin({ defaultAlpha }: { defaultAlpha: number }) {
  return types
    .compose(
      'SyntenyColorsMixin',
      TrackColorsMixin(),
      types.model({
        /**
         * #property
         * Opacity of every alignment, 0 to 1. The synteny view defaults it low
         * for dense unfiltered hairballs (with minAlignmentLength set, ~0.4
         * gives stronger colour); the dotplot defaults it opaque.
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
    }))
}

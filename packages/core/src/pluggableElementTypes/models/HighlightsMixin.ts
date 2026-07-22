import { cast, types } from '@jbrowse/mobx-state-tree'

import type { HighlightType } from '../../util/highlights.ts'

// after turning chips off, suppress the auto-reveal that a fresh interactive
// highlight would otherwise trigger, so a deliberate "chips off" sticks
const CHIP_REVEAL_SUPPRESS_MS = 60 * 60 * 1000

/**
 * #stateModel HighlightsMixin
 * #category view
 *
 * The `view.highlight` band state shared verbatim by the LinearGenomeView and
 * DotplotView: an array of translucent highlight regions plus the
 * `showHighlightChips` toggle for their interactive chips. Both views compose
 * this so the props and actions stay identical by construction rather than by
 * two hand-kept copies. Visibility across all views is the session-wide
 * `highlightsVisible` flag (on BaseSession), not a prop here.
 */
export default function HighlightsMixin() {
  return types
    .model({
      /**
       * #property
       * translucent highlight bands, seeded from URL params or session JSON and
       * added interactively via the rubber-band menu
       */
      highlight: types.stripDefault(
        types.array(types.frozen<HighlightType>()),
        [],
      ),
      /**
       * #property
       * controls whether the interactive highlight chip (link icon + context
       * menu) is drawn on each highlight band; off by default
       */
      showHighlightChips: types.stripDefault(types.boolean, false),
    })
    .volatile(() => ({
      /**
       * #volatile
       * timestamp of the last manual "chips off"; gates revealHighlightChips
       */
      highlightChipsDismissedAt: undefined as number | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      addToHighlights(highlight: HighlightType) {
        self.highlight.push(highlight)
      },
      /**
       * #action
       */
      setHighlight(highlight?: HighlightType[]) {
        self.highlight = cast(highlight)
      },
      /**
       * #action
       */
      removeHighlight(highlight: HighlightType) {
        self.highlight.remove(highlight)
      },
      /**
       * #action
       */
      updateHighlight(old: HighlightType, updates: Partial<HighlightType>) {
        const idx = self.highlight.indexOf(old)
        if (idx !== -1) {
          self.highlight[idx] = { ...old, ...updates }
        }
      },
      /**
       * #action
       */
      setShowHighlightChips(arg: boolean) {
        if (!arg) {
          self.highlightChipsDismissedAt = Date.now()
        }
        self.showHighlightChips = arg
      },
      /**
       * #action
       * turn chips on after an interactive highlight so the new band is
       * immediately manageable, unless the user turned chips off in the last hour
       */
      revealHighlightChips() {
        const dismissedAt = self.highlightChipsDismissedAt
        const recentlyDismissed =
          dismissedAt !== undefined &&
          Date.now() - dismissedAt < CHIP_REVEAL_SUPPRESS_MS
        if (!recentlyDismissed) {
          self.showHighlightChips = true
        }
      },
    }))
}

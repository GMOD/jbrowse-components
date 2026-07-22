import { cast, types } from '@jbrowse/mobx-state-tree'

import { revealHighlightsOnGrowth } from '../../util/highlights.ts'
import { getSession } from '../../util/index.ts'

import type { HighlightType } from '../../util/highlights.ts'

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
          // reachable from the highlight grid, which lists entries even with
          // the bands off, so recoloring there would otherwise do nothing
          // visible. Not a growth, so revealHighlightsOnGrowth can't see it
          getSession(self).revealHighlights()
        }
      },
      /**
       * #action
       */
      setShowHighlightChips(arg: boolean) {
        self.showHighlightChips = arg
      },
    }))
    .actions(self => ({
      afterAttach() {
        // covers the rubber-band menu, dotplot drag and URL init alike
        revealHighlightsOnGrowth(self, () => self.highlight.length)
      },
    }))
}

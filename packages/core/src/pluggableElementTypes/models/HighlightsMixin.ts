import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

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
        // a highlight added while the session-wide bands are off would render
        // nothing at all, which reads as "the highlight didn't work". Watching
        // the array here reveals for every path that grows it (rubber-band
        // menu, dotplot drag, URL init) rather than relying on each call site
        // to remember. Seeded on the first run so loading a session that
        // deliberately persisted bands-off doesn't flip it back on.
        let prevCount = self.highlight.length
        addDisposer(
          self,
          autorun(function highlightRevealAutorun() {
            const count = self.highlight.length
            if (count > prevCount) {
              getSession(self).revealHighlights()
            }
            prevCount = count
          }),
        )
      },
    }))
}

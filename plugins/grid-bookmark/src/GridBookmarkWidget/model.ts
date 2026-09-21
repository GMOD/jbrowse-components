import { getSession } from '@jbrowse/core/util'
import { highlightKey } from '@jbrowse/core/util/highlights'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { highlightsOnAssemblies } from '@jbrowse/core/util/viewHighlights'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { HighlightType } from '@jbrowse/core/util/highlights'
import type { Instance } from '@jbrowse/mobx-state-tree'

// alpha applied to highlight colors so they overlay the view rather than
// obscure it; the color picker's presets use it
export const HIGHLIGHT_ALPHA = 0.2

interface ViewWithAssemblies {
  assemblyNames?: string[]
  views?: ViewWithAssemblies[]
}

// recurse the view/subview tree applying fn; mst walk() over the whole session
// blows the stack ('too much recursion') so we only descend through .views
function forEachView(
  views: ViewWithAssemblies[],
  fn: (view: ViewWithAssemblies) => void,
) {
  for (const view of views) {
    fn(view)
    if (view.views) {
      forEachView(view.views, fn)
    }
  }
}

export interface HighlightRow {
  key: string
  highlight: HighlightType
}

/**
 * #stateModel GridBookmarkWidgetModel
 * the list of the session's highlights
 */
export default function f(_pluginManager: PluginManager) {
  return types
    .model('GridBookmarkModel', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal('GridBookmarkWidget'),
    })
    .volatile(() => ({
      /**
       * #volatile
       * a row's key holds its coordinates and its place in the session's list,
       * so a key left stale by a removal elsewhere selects nothing rather than
       * a neighbour
       */
      selectedKeys: new Set<string>(),
    }))
    .views(self => ({
      /**
       * #getter
       * assemblies currently displayed in any open view
       */
      get assembliesInViews() {
        const names = new Set<string>()
        forEachView(getSession(self).views, view => {
          for (const name of view.assemblyNames ?? []) {
            names.add(name)
          }
        })
        return names
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the list shows only highlights on an assembly some view is showing
       */
      get rows(): HighlightRow[] {
        const { highlights, assemblyManager } = getSession(self)
        const visible = new Set(
          highlightsOnAssemblies(
            highlights,
            self.assembliesInViews,
            assemblyManager,
          ),
        )
        return highlights.flatMap((highlight, i) =>
          visible.has(highlight)
            ? [{ key: highlightKey(highlight, i), highlight }]
            : [],
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get selectedHighlights() {
        return self.rows
          .filter(r => self.selectedKeys.has(r.key))
          .map(r => r.highlight)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSelectedKeys(keys: Set<string>) {
        self.selectedKeys = keys
      },
      /**
       * #action
       */
      importHighlights(highlights: HighlightType[]) {
        const session = getSession(self)
        for (const h of highlights) {
          session.addHighlight(h)
        }
      },
      /**
       * #action
       */
      removeSelectedHighlights() {
        const session = getSession(self)
        for (const h of self.selectedHighlights) {
          session.removeHighlight(h)
        }
        self.selectedKeys = new Set()
      },
      /**
       * #action
       */
      recolorSelectedHighlights(color: string) {
        const session = getSession(self)
        for (const h of self.selectedHighlights) {
          session.updateHighlight(h, { color })
        }
      },
    }))
}

export type GridBookmarkStateModel = ReturnType<typeof f>
export interface GridBookmarkModel extends Instance<GridBookmarkStateModel> {}

import { getSession } from '@jbrowse/core/util'
import { highlightKey } from '@jbrowse/core/util/highlights'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { HighlightType } from '@jbrowse/core/util/highlights'
import type { Instance } from '@jbrowse/mobx-state-tree'

// alpha applied to highlight colors so they overlay the view rather than
// obscure it; the color picker's presets use it
export const HIGHLIGHT_ALPHA = 0.2

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
       * every highlight in the session, in the order they were added
       */
      get rows(): HighlightRow[] {
        return getSession(self).highlights.map((highlight, i) => ({
          key: highlightKey(highlight, i),
          highlight,
        }))
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

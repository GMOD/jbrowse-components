import {
  getSession,
  localStorageGetJSON,
  localStorageSetItem,
} from '@jbrowse/core/util'
import { ElementId, Region as RegionModel } from '@jbrowse/core/util/types/mst'
import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { bookmarkKey } from './utils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util/types'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { DotplotViewModel } from '@jbrowse/plugin-dotplot-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// alpha applied to highlight colors so they overlay the view rather than
// obscure it; shared by the default highlight and the color-picker presets
export const HIGHLIGHT_ALPHA = 0.2

export const DEFAULT_HIGHLIGHT = `rgba(247, 129, 192, ${HIGHLIGHT_ALPHA})`

const LabeledRegionModel = types
  .compose(
    RegionModel,
    types.model('Label', {
      label: types.optional(types.string, ''),
      highlight: types.optional(types.string, DEFAULT_HIGHLIGHT),
    }),
  )
  .actions(self => ({
    setLabel(label: string) {
      self.label = label
    },
    setHighlight(color: string) {
      self.highlight = color
    },
  }))

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

export type IExtendedLGV = LinearGenomeViewModel

export type IExtendedDotplotView = DotplotViewModel

export interface ILabeledRegionModel extends SnapshotIn<
  typeof LabeledRegionModel
> {
  refName: string
  start: number
  end: number
  reversed: boolean
  highlight: string
  assemblyName: string
  label: string
  setRefName: (newRefName: string) => void
  setLabel: (label: string) => void
  setHighlight: (color: string) => void
}

export interface IExtendedLabeledRegionModel extends ILabeledRegionModel {
  id: number
  correspondingObj: ILabeledRegionModel
}

const localStorageKeyF = () =>
  typeof window !== 'undefined'
    ? `bookmarks-${window.location.host}${window.location.pathname}`
    : 'empty'

/**
 * #stateModel GridBookmarkWidgetModel
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
      /**
       * #property
       * loaded from localStorage when not present in snapshot; sharedBookmarks
       * from a shared URL are merged in via preProcessSnapshot
       */
      bookmarks: types.optional(types.array(LabeledRegionModel), () =>
        localStorageGetJSON(localStorageKeyF(), []),
      ),
      /**
       * #property
       * whether saved bookmarks are drawn as highlight overlays on views
       */
      bookmarkHighlightsVisible: types.optional(types.boolean, true),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      selectedBookmarks: [] as IExtendedLabeledRegionModel[],
      /**
       * #volatile
       * which grid tab is visible: bookmarks or highlights
       */
      gridView: 'bookmarks',
    }))
    .views(self => ({
      /**
       * #getter
       */
      get bookmarkAssemblies() {
        return [...new Set(self.bookmarks.map(r => r.assemblyName))]
      },
      /**
       * #getter
       */
      get validAssemblies() {
        const { assemblyManager } = getSession(self)
        return new Set(
          this.bookmarkAssemblies.filter(
            a => assemblyManager.assemblyNameMap[a],
          ),
        )
      },
      /**
       * #getter
       * assemblies currently displayed in any open view; the grids only show
       * bookmarks/highlights belonging to these
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
       * bookmarks belonging to an assembly currently open in a view
       */
      get visibleBookmarks() {
        return self.bookmarks.filter(e =>
          self.assembliesInViews.has(e.assemblyName),
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setGridView(arg: 'bookmarks' | 'highlights' | 'both') {
        self.gridView = arg
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      importBookmarks(regions: Region[]) {
        self.bookmarks = cast([...self.bookmarks, ...regions])
      },
      /**
       * #action
       */
      addBookmark(region: Region) {
        self.bookmarks.push(region)
      },
      /**
       * #action
       */
      updateBookmarkLabel(
        bookmark: IExtendedLabeledRegionModel,
        label: string,
      ) {
        bookmark.correspondingObj.setLabel(label)
      },
      /**
       * #action
       */
      updateBookmarkHighlight(
        bookmark: IExtendedLabeledRegionModel,
        color: string,
      ) {
        bookmark.correspondingObj.setHighlight(color)
      },
      /**
       * #action
       */
      updateBulkBookmarkHighlights(color: string) {
        for (const bookmark of self.selectedBookmarks) {
          this.updateBookmarkHighlight(bookmark, color)
        }
      },
      /**
       * #action
       */
      setSelectedBookmarks(bookmarks: IExtendedLabeledRegionModel[]) {
        self.selectedBookmarks = bookmarks
      },
      /**
       * #action
       */
      setBookmarkedRegions(regions: SnapshotIn<typeof LabeledRegionModel>[]) {
        self.bookmarks = cast(regions)
      },
      /**
       * #action
       */
      setBookmarkHighlightsVisible(arg: boolean) {
        self.bookmarkHighlightsVisible = arg
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      // keeps bookmarks from unknown assemblies (they have no valid home to
      // navigate to, but discarding them silently would lose user data)
      clearBookmarksForLoadedAssemblies() {
        self.setBookmarkedRegions(
          self.bookmarks.filter(
            bookmark => !self.validAssemblies.has(bookmark.assemblyName),
          ),
        )
      },
      /**
       * #action
       */
      clearSelectedBookmarks() {
        for (const bookmark of self.selectedBookmarks) {
          self.bookmarks.remove(bookmark.correspondingObj)
        }
        self.selectedBookmarks = []
      },

      /**
       * #action
       */
      removeBookmarkObject(arg: Instance<typeof LabeledRegionModel>) {
        self.bookmarks.remove(arg)
      },
    }))
    .actions(self => ({
      afterAttach() {
        const key = localStorageKeyF()
        function handler(e: StorageEvent) {
          if (e.key === key) {
            self.setBookmarkedRegions(
              localStorageGetJSON<SnapshotIn<typeof LabeledRegionModel>[]>(
                key,
                [],
              ),
            )
          }
        }
        window.addEventListener('storage', handler)
        addDisposer(self, () => {
          window.removeEventListener('storage', handler)
        })
        addDisposer(
          self,
          autorun(
            function bookmarkLocalStorageAutorun() {
              localStorageSetItem(key, JSON.stringify(self.bookmarks))
            },
            { name: 'BookmarkLocalStorage' },
          ),
        )
      },
    }))
    .preProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap || typeof snap !== 'object') {
        return snap
      }
      const s = snap as Record<string, unknown>
      if (!s.sharedBookmarks) {
        return snap
      }
      const { sharedBookmarks, ...rest } = s
      const local = localStorageGetJSON<
        SnapshotIn<typeof LabeledRegionModel>[]
      >(localStorageKeyF(), [])
      const shared = sharedBookmarks as SnapshotIn<typeof LabeledRegionModel>[]
      const seen = new Set(local.map(bookmarkKey))
      const merged = [
        ...local,
        ...shared.filter(b => !seen.has(bookmarkKey(b))),
      ]
      return { ...rest, bookmarks: merged } as unknown as typeof snap
    })
    .postProcessSnapshot(snap => {
      const { bookmarks, ...rest } = snap
      return bookmarks.length ? { ...rest, sharedBookmarks: bookmarks } : rest
    })
}

export type GridBookmarkStateModel = ReturnType<typeof f>
export type GridBookmarkModel = Instance<GridBookmarkStateModel>

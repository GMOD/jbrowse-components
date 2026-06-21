import {
  getSession,
  localStorageGetItem,
  localStorageSetItem,
} from '@jbrowse/core/util'
import { ElementId, Region as RegionModel } from '@jbrowse/core/util/types/mst'
import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { bookmarkKey } from './utils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util/types'
import type { IMSTArray, Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'
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

interface HighlightToggleView {
  id: string
  bookmarkHighlightsVisible?: boolean
  labelsVisible?: boolean
  setBookmarkHighlightsVisible?: (arg: boolean) => void
  setLabelsVisible?: (arg: boolean) => void
  views?: HighlightToggleView[]
}

// recurse the view/subview tree applying fn; mst walk() over the whole session
// blows the stack ('too much recursion') so we only descend through .views
function forEachView(
  views: HighlightToggleView[],
  fn: (view: HighlightToggleView) => void,
) {
  for (const view of views) {
    fn(view)
    if (view.views) {
      forEachView(view.views, fn)
    }
  }
}

// like forEachView but short-circuits; used by the "all open views" getters so
// they observe the same view/subview tree the setters mutate
function everyView(
  views: HighlightToggleView[],
  fn: (view: HighlightToggleView) => boolean,
): boolean {
  return views.every(
    view => fn(view) && (view.views ? everyView(view.views, fn) : true),
  )
}

export interface IExtendedLGV extends LinearGenomeViewModel {
  bookmarkHighlightsVisible: boolean
  setBookmarkHighlightsVisible: (arg: boolean) => void
}

export interface IExtendedDotplotView extends DotplotViewModel {
  bookmarkHighlightsVisible: boolean
  setBookmarkHighlightsVisible: (arg: boolean) => void
}

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
        JSON.parse(localStorageGetItem(localStorageKeyF()) || '[]'),
      ),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      selectedBookmarks: [] as IExtendedLabeledRegionModel[],
      /**
       * #volatile
       * undefined = "all valid assemblies"; an array = explicit filter
       */
      selectedAssembliesPre: undefined as string[] | undefined,
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
       */
      get areBookmarksHighlightedOnAllOpenViews() {
        return everyView(getSession(self).views, v =>
          'bookmarkHighlightsVisible' in v
            ? !!v.bookmarkHighlightsVisible
            : true,
        )
      },
      /**
       * #getter
       */
      get areBookmarksHighlightLabelsOnAllOpenViews() {
        return everyView(getSession(self).views, v =>
          'labelsVisible' in v ? !!v.labelsVisible : true,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get bookmarksWithValidAssemblies() {
        return self.bookmarks.filter(e =>
          self.validAssemblies.has(e.assemblyName),
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSelectedAssemblies(assemblies?: string[]) {
        self.selectedAssembliesPre = assemblies
      },
      /**
       * #action
       */
      setGridView(arg: 'bookmarks' | 'highlights') {
        self.gridView = arg
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get selectedAssemblies() {
        return (
          self.selectedAssembliesPre?.filter(f =>
            self.validAssemblies.has(f),
          ) ?? [...self.validAssemblies]
        )
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
      setBookmarkedRegions(regions: IMSTArray<typeof LabeledRegionModel>) {
        self.bookmarks = cast(regions)
      },
      /**
       * #action
       */
      setBookmarkHighlightsVisible(arg: boolean) {
        forEachView(getSession(self).views, view => {
          view.setBookmarkHighlightsVisible?.(arg)
        })
      },
      /**
       * #action
       */
      setBookmarkLabelsVisible(arg: boolean) {
        forEachView(getSession(self).views, view => {
          view.setLabelsVisible?.(arg)
        })
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
          ) as IMSTArray<typeof LabeledRegionModel>,
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
            const localStorage = JSON.parse(localStorageGetItem(key) || '[]')
            self.setBookmarkedRegions(localStorage)
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
      const local = JSON.parse(
        localStorageGetItem(localStorageKeyF()) || '[]',
      ) as SnapshotIn<typeof LabeledRegionModel>[]
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

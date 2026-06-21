import { getSession } from '@jbrowse/core/util'

import type { GridBookmarkModel, IExtendedLGV } from '../../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'

// Shared by the LGV bookmark-highlight overlays (band, scalebar, overview, SVG
// export): resolve the bookmark widget plus the bookmarks belonging to this
// view's assemblies, or an empty list when highlights are toggled off or the
// widget is absent. Reads observables, so callers must be observer components.
export function getBookmarkHighlights(model: IExtendedLGV) {
  const session = getSession(model) as SessionWithWidgets
  const bookmarkWidget = session.widgets.get('GridBookmark') as
    | GridBookmarkModel
    | undefined
  const viewAssemblies = new Set(model.assemblyNames)
  const bookmarks =
    model.bookmarkHighlightsVisible && bookmarkWidget
      ? bookmarkWidget.bookmarks.filter(r => viewAssemblies.has(r.assemblyName))
      : []
  return { session, bookmarkWidget, bookmarks }
}

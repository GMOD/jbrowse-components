import { getSession } from '@jbrowse/core/util'

import type {
  GridBookmarkModel,
  IExtendedDotplotView,
  IExtendedLGV,
} from '../../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'

// resolve the singleton bookmark widget (created eagerly in the view's
// afterAttach, so this is a lookup not a create). Reads observables.
export function getBookmarkWidget(model: IExtendedLGV | IExtendedDotplotView) {
  const session = getSession(model) as SessionWithWidgets
  return {
    session,
    bookmarkWidget: session.widgets.get('GridBookmark') as
      | GridBookmarkModel
      | undefined,
  }
}

// Shared by the LGV bookmark-highlight overlays (band, scalebar, overview, SVG
// export): resolve the bookmark widget plus the bookmarks belonging to this
// view's assemblies, or an empty list when highlights are toggled off or the
// widget is absent. Reads observables, so callers must be observer components.
export function getBookmarkHighlights(model: IExtendedLGV) {
  const { session, bookmarkWidget } = getBookmarkWidget(model)
  const viewAssemblies = new Set(model.assemblyNames)
  const bookmarks =
    session.highlightsVisible && bookmarkWidget
      ? bookmarkWidget.bookmarks.filter(r => viewAssemblies.has(r.assemblyName))
      : []
  return { session, bookmarkWidget, bookmarks }
}

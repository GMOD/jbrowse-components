import { getSession } from '@jbrowse/core/util'
import { DotplotHighlightBands } from '@jbrowse/plugin-dotplot-view'
import { observer } from 'mobx-react'

import { bookmarkKey } from '../../utils.ts'

import type { GridBookmarkModel, IExtendedDotplotView } from '../../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'

const DotplotHighlight = observer(function DotplotHighlight({
  model,
}: {
  model: IExtendedDotplotView
}) {
  const session = getSession(model) as SessionWithWidgets
  const { bookmarkHighlightsVisible } = model
  const bookmarkWidget = session.widgets.get('GridBookmark') as
    GridBookmarkModel | undefined

  // unlike the LGV overlays there is no assembly filter: a dotplot draws two
  // assemblies and DotplotHighlightBands resolves which axis a region maps to
  return bookmarkHighlightsVisible && bookmarkWidget?.bookmarks
    ? bookmarkWidget.bookmarks.map((r, idx) => (
        <DotplotHighlightBands
          // eslint-disable-next-line @eslint-react/no-array-index-key -- bookmarks have no id and can duplicate; idx only breaks ties
          key={`${bookmarkKey(r)}_${idx}`}
          model={model}
          region={r}
          color={r.highlight}
        />
      ))
    : null
})

export default DotplotHighlight

import { getSession } from '@jbrowse/core/util'
import { DotplotHighlightBands } from '@jbrowse/plugin-dotplot-view'
import { observer } from 'mobx-react'

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
    | GridBookmarkModel
    | undefined

  return bookmarkHighlightsVisible && bookmarkWidget?.bookmarks
    ? bookmarkWidget.bookmarks.map(r => (
        <DotplotHighlightBands
          key={`${r.assemblyName}_${r.refName}_${r.start}_${r.end}`}
          model={model}
          region={r}
          color={r.highlight}
        />
      ))
    : null
})

export default DotplotHighlight

import { highlightKey } from '@jbrowse/core/util/highlights'
import { DotplotHighlightBands } from '@jbrowse/plugin-dotplot-view'
import { observer } from 'mobx-react'

import { getBookmarkWidget } from './getBookmarkHighlights.ts'

import type { IExtendedDotplotView } from '../../model.ts'

const DotplotHighlight = observer(function DotplotHighlight({
  model,
}: {
  model: IExtendedDotplotView
}) {
  const { session, bookmarkWidget } = getBookmarkWidget(model)

  // unlike the LGV overlays there is no assembly filter: a dotplot draws two
  // assemblies and DotplotHighlightBands resolves which axis a region maps to
  return session.highlightsVisible && bookmarkWidget
    ? bookmarkWidget.bookmarks.map((r, idx) => (
        <DotplotHighlightBands
          key={highlightKey(r, idx)}
          model={model}
          region={r}
          color={r.highlight}
        />
      ))
    : null
})

export default DotplotHighlight

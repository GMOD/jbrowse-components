import { getSession } from '@jbrowse/core/util'
import { OverviewHighlightBand } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import type { GridBookmarkModel, IExtendedLGV } from '../../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'

const ScalebarHighlight = observer(function ScalebarHighlight({
  model,
}: {
  model: IExtendedLGV
}) {
  const session = getSession(model) as SessionWithWidgets
  const { bookmarkHighlightsVisible } = model
  const bookmarkWidget = session.widgets.get('GridBookmark') as
    | GridBookmarkModel
    | undefined
  const viewAssemblies = new Set(model.assemblyNames)

  return bookmarkHighlightsVisible && bookmarkWidget?.bookmarks
    ? bookmarkWidget.bookmarks
        .filter(r => viewAssemblies.has(r.assemblyName))
        .map((r, idx) => {
          const coords = model.getHighlightCoords(r)
          return coords ? (
            <OverviewHighlightBand
              // eslint-disable-next-line @eslint-react/no-array-index-key -- bookmarks have no id and can duplicate; idx only breaks ties
              key={`${r.assemblyName}_${r.refName}_${r.start}_${r.end}_${idx}`}
              coords={coords}
              background={r.highlight}
            />
          ) : null
        })
    : null
})

export default ScalebarHighlight

import { getSession, notEmpty } from '@jbrowse/core/util'
import { OverviewHighlightBand } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import type { GridBookmarkModel, IExtendedLGV } from '../../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'

type LGV = IExtendedLGV

const OverviewHighlight = observer(function OverviewHighlight({
  model,
}: {
  model: LGV
}) {
  const session = getSession(model) as SessionWithWidgets
  const { bookmarkHighlightsVisible, labelsVisible } = model
  const bookmarkWidget = session.widgets.get('GridBookmark') as
    | GridBookmarkModel
    | undefined

  if (!bookmarkHighlightsVisible || !bookmarkWidget?.bookmarks) {
    return null
  }

  const assemblyNames = new Set(model.assemblyNames)
  return bookmarkWidget.bookmarks
    .filter(r => assemblyNames.has(r.assemblyName))
    .map(r => {
      const coords = model.getOverviewHighlightCoords(r)
      return coords ? { coords, bookmark: r } : undefined
    })
    .filter(notEmpty)
    .map(({ coords, bookmark: r }, idx) => (
      <OverviewHighlightBand
        // region fields keep the key stable across pan/zoom (unlike pixel
        // coords); idx disambiguates duplicate bookmarks on the same region
        // eslint-disable-next-line @eslint-react/no-array-index-key -- bookmarks have no id and can duplicate; idx only breaks ties
        key={`${r.assemblyName}_${r.refName}_${r.start}_${r.end}_${idx}`}
        coords={coords}
        background={r.highlight}
        borderColor={r.highlight}
        tooltip={labelsVisible ? r.label : undefined}
      />
    ))
})

export default OverviewHighlight

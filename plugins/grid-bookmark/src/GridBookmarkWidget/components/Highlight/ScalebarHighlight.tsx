import { OverviewHighlightBand } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { getBookmarkHighlights } from './getBookmarkHighlights.ts'
import { bookmarkKey } from '../../utils.ts'

import type { IExtendedLGV } from '../../model.ts'

const ScalebarHighlight = observer(function ScalebarHighlight({
  model,
}: {
  model: IExtendedLGV
}) {
  const { bookmarks } = getBookmarkHighlights(model)

  return bookmarks.map((r, idx) => {
    const coords = model.getHighlightCoords(r)
    return coords ? (
      <OverviewHighlightBand
        // eslint-disable-next-line @eslint-react/no-array-index-key -- bookmarks have no id and can duplicate; idx only breaks ties
        key={`${bookmarkKey(r)}_${idx}`}
        coords={coords}
        background={r.highlight}
      />
    ) : null
  })
})

export default ScalebarHighlight

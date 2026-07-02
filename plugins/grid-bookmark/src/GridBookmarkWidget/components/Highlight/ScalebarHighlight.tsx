import { highlightKey } from '@jbrowse/core/util/highlights'
import { OverviewHighlightBand } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { getBookmarkHighlights } from './getBookmarkHighlights.ts'

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
        key={highlightKey(r, idx)}
        coords={coords}
        background={r.highlight}
      />
    ) : null
  })
})

export default ScalebarHighlight

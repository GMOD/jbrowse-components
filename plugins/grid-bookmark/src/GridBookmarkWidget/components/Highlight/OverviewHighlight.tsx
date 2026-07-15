import { notEmpty } from '@jbrowse/core/util'
import { highlightKey } from '@jbrowse/core/util/highlights'
import { OverviewHighlightBand } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { getBookmarkHighlights } from './getBookmarkHighlights.ts'

import type { IExtendedLGV } from '../../model.ts'

const OverviewHighlight = observer(function OverviewHighlight({
  model,
}: {
  model: IExtendedLGV
}) {
  const { labelsVisible } = model
  const { bookmarks } = getBookmarkHighlights(model)

  return bookmarks
    .map(r => {
      const coords = model.getOverviewHighlightCoords(r)
      return coords ? { coords, bookmark: r } : undefined
    })
    .filter(notEmpty)
    .map(({ coords, bookmark: r }, idx) => (
      <OverviewHighlightBand
        // region fields keep the key stable across pan/zoom (unlike pixel
        // coords); idx disambiguates duplicate bookmarks on the same region
        key={highlightKey(r, idx)}
        coords={coords}
        background={r.highlight}
        borderColor={r.highlight}
        tooltip={labelsVisible ? r.label : undefined}
      />
    ))
})

export default OverviewHighlight

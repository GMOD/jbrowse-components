import { notEmpty } from '@jbrowse/core/util'
import { OverviewHighlightBand } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { getBookmarkHighlights } from './getBookmarkHighlights.ts'
import { bookmarkKey } from '../../utils.ts'

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
        // eslint-disable-next-line @eslint-react/no-array-index-key -- bookmarks have no id and can duplicate; idx only breaks ties
        key={`${bookmarkKey(r)}_${idx}`}
        coords={coords}
        background={r.highlight}
        borderColor={r.highlight}
        tooltip={labelsVisible ? r.label : undefined}
      />
    ))
})

export default OverviewHighlight

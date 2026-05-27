import { getSession, notEmpty } from '@jbrowse/core/util'
import { getLayoutHighlightCoords } from '@jbrowse/core/util/Base1DUtils'
import { OverviewHighlightBand } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import type { GridBookmarkModel, IExtendedLGV } from '../../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

type LGV = IExtendedLGV

const OverviewHighlight = observer(function OverviewHighlight({
  model,
  overview,
}: {
  model: LGV
  overview: ViewLayout
}) {
  const session = getSession(model) as SessionWithWidgets
  const { assemblyManager } = session
  const { cytobandOffset, bookmarkHighlightsVisible, labelsVisible } = model
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
      const asm = assemblyManager.get(r.assemblyName)
      const refName = asm?.getCanonicalRefName(r.refName) ?? r.refName
      const coords = getLayoutHighlightCoords(overview, { ...r, refName })
      return coords ? { coords, bookmark: r } : undefined
    })
    .filter(notEmpty)
    .map(({ coords, bookmark: r }, idx) => (
      <OverviewHighlightBand
        /* biome-ignore lint/suspicious/noArrayIndexKey: */
        key={`${coords.left}_${coords.width}_${idx}`}
        coords={{ ...coords, left: coords.left + cytobandOffset }}
        background={r.highlight}
        borderColor={r.highlight}
        tooltip={labelsVisible ? r.label : undefined}
      />
    ))
})

export default OverviewHighlight

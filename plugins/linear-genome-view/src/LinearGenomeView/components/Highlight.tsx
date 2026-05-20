import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import { Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import HighlightBand from './HighlightBand.tsx'

import type { LinearGenomeViewModel } from '../model.ts'
import type { HighlightType } from '../types.ts'
import type { SessionWithWidgets, Widget } from '@jbrowse/core/util'

type LGV = LinearGenomeViewModel

// minimal shape we need from grid-bookmark's widget. declared here because
// the linear-genome-view plugin can't import grid-bookmark types directly
interface BookmarkWidget extends Widget {
  addBookmark: (region: HighlightType) => void
}

const Highlight = observer(function Highlight({
  model,
  highlight,
}: {
  model: LGV
  highlight: HighlightType
}) {
  const theme = useTheme()
  const session = getSession(model) as SessionWithWidgets
  const coords = model.getHighlightCoords(highlight)
  const highlightColor = colord(theme.palette.highlight.main)

  return coords ? (
    <HighlightBand
      coords={coords}
      background={highlightColor.alpha(0.35).toRgbString()}
    >
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Dismiss highlight',
            icon: CloseIcon,
            onClick: () => {
              model.removeHighlight(highlight)
            },
          },
          {
            label: 'Bookmark highlighted region',
            icon: BookmarkIcon,
            onClick: () => {
              const bookmarkWidget = (session.widgets.get('GridBookmark') ??
                session.addWidget(
                  'GridBookmarkWidget',
                  'GridBookmark',
                )) as BookmarkWidget
              // highlights are persisted via types.frozen and can legitimately
              // omit assemblyName (e.g. user-supplied session highlights), but
              // the bookmark Region MST type requires it
              bookmarkWidget.addBookmark({
                ...highlight,
                assemblyName:
                  highlight.assemblyName ?? model.assemblyNames[0],
              })
              session.showWidget(bookmarkWidget)
              model.removeHighlight(highlight)
            },
          },
        ]}
      >
        <Tooltip title="Highlighted region" arrow>
          <LinkIcon
            fontSize="small"
            sx={{ color: highlightColor.darken(0.2).toRgbString() }}
          />
        </Tooltip>
      </CascadingMenuButton>
    </HighlightBand>
  ) : null
})

export default Highlight

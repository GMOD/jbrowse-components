import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import { Box, Tooltip, Typography, useTheme } from '@mui/material'
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

  // user-supplied color is used as-is so explicit alpha is preserved; fall
  // back to the theme color with a standard alpha
  const bandColor = highlight.color
    ? colord(highlight.color)
    : colord(theme.palette.highlight.main).alpha(0.35)

  return coords ? (
    <HighlightBand coords={coords} background={bandColor.toRgbString()}>
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
              // afterAttach backfills missing assemblyName on init; the
              // ?? fallback here only kicks in for highlights added before
              // the view is initialized
              bookmarkWidget.addBookmark({
                ...highlight,
                assemblyName: highlight.assemblyName ?? model.assemblyNames[0],
              })
              session.showWidget(bookmarkWidget)
              model.removeHighlight(highlight)
            },
          },
        ]}
      >
        <Tooltip title={highlight.label || 'Highlighted region'} arrow>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LinkIcon
              fontSize="small"
              sx={{ color: bandColor.alpha(0.8).toRgbString() }}
            />
            {highlight.label && model.labelsVisible ? (
              <Typography variant="caption" noWrap>
                {highlight.label}
              </Typography>
            ) : null}
          </Box>
        </Tooltip>
      </CascadingMenuButton>
    </HighlightBand>
  ) : null
})

export default Highlight

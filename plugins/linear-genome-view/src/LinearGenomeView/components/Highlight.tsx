import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { getHighlightCoords } from '../util.ts'

import type { LinearGenomeViewModel } from '../model.ts'
import type { HighlightType } from '../types.ts'
import type { SessionWithWidgets, Widget } from '@jbrowse/core/util'

type LGV = LinearGenomeViewModel

// minimal shape we need from grid-bookmark's widget. declared here because
// the linear-genome-view plugin can't import grid-bookmark types directly
interface BookmarkWidget extends Widget {
  addBookmark: (region: HighlightType) => void
}

const useStyles = makeStyles()(theme => ({
  highlight: {
    height: '100%',
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
    background: colord(theme.palette.highlight.main).alpha(0.35).toRgbString(),
    // paint above sibling TrackContainers (which would otherwise win in
    // tree order). pointer-events:none lets clicks fall through to the
    // tracks except on the chip itself
    zIndex: 1,
    pointerEvents: 'none',
  },
  iconButton: {
    pointerEvents: 'auto',
    color: colord(theme.palette.highlight.main).darken(0.2).toRgbString(),
  },
}))

const Highlight = observer(function Highlight({
  model,
  highlight,
}: {
  model: LGV
  highlight: HighlightType
}) {
  const { classes } = useStyles()
  const session = getSession(model) as SessionWithWidgets
  const coords = getHighlightCoords(model, highlight)

  return coords ? (
    <div
      className={classes.highlight}
      style={{
        transform: `translateX(${coords.left}px)`,
        width: coords.width,
      }}
    >
      <CascadingMenuButton
        className={classes.iconButton}
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
                assemblyName: highlight.assemblyName ?? model.assemblyNames[0],
              })
              session.showWidget(bookmarkWidget)
              model.removeHighlight(highlight)
            },
          },
        ]}
      >
        <Tooltip title="Highlighted region" arrow>
          <LinkIcon fontSize="small" />
        </Tooltip>
      </CascadingMenuButton>
    </div>
  ) : null
})

export default Highlight

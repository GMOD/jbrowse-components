import { useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

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
    // above TrackLabel (zIndex 200) so the chip icon is clickable, but let
    // clicks pass through the rest of the overlay to the tracks below
    zIndex: 201,
    pointerEvents: 'none',
  },
  linkIcon: {
    color: colord(theme.palette.highlight.main).darken(0.2).toRgbString(),
  },
  iconButton: {
    pointerEvents: 'auto',
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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const session = getSession(model) as SessionWithWidgets
  const { assemblyManager } = session

  const handleClose = () => {
    setAnchorEl(null)
  }
  const dismissHighlight = () => {
    model.removeHighlight(highlight)
  }

  const asm = assemblyManager.get(highlight.assemblyName)
  const refName =
    asm?.getCanonicalRefName(highlight.refName) ?? highlight.refName
  const s = model.bpToPx({ refName, coord: highlight.start })
  const e = model.bpToPx({ refName, coord: highlight.end })
  const coords =
    s && e
      ? {
          width: Math.max(Math.abs(e.offsetPx - s.offsetPx), 3),
          left: Math.min(s.offsetPx, e.offsetPx) - model.offsetPx,
        }
      : undefined

  return coords ? (
    <div
      className={classes.highlight}
      style={{
        transform: `translateX(${coords.left}px)`,
        width: coords.width,
      }}
    >
      <Tooltip title="Highlighted region" arrow>
        <IconButton
          className={classes.iconButton}
          onClick={event => {
            setAnchorEl(event.currentTarget)
          }}
        >
          <LinkIcon fontSize="small" className={classes.linkIcon} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        onMenuItemClick={(_event, callback) => {
          callback()
          handleClose()
        }}
        open={Boolean(anchorEl)}
        onClose={() => handleClose()}
        menuItems={[
          {
            label: 'Dismiss highlight',
            icon: CloseIcon,
            onClick: () => {
              dismissHighlight()
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
              bookmarkWidget.addBookmark(highlight)
              session.showWidget(bookmarkWidget)
              dismissHighlight()
            },
          },
        ]}
      />
    </div>
  ) : null
})

export default Highlight

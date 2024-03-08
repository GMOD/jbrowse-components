import React, { useRef, useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { colord } from '@jbrowse/core/util/colord'
import {
  ParsedLocString,
  Region,
  SessionWithWidgets,
  getSession,
} from '@jbrowse/core/util'
import { Menu } from '@jbrowse/core/ui'
import { IconButton, Tooltip, useTheme } from '@mui/material'

// icons
import LinkIcon from '@mui/icons-material/Link'
import CloseIcon from '@mui/icons-material/Close'
import BookmarkIcon from '@mui/icons-material/Bookmark'

// locals
import { LinearGenomeViewModel } from '../model'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  highlight: {
    height: '100%',
    position: 'absolute',
    background: `${colord(theme.palette.quaternary?.main ?? 'goldenrod')
      .alpha(0.35)
      .toRgbString()}`,
    borderLeft: `1px solid ${theme.palette.quaternary?.main ?? 'goldenrod'}`,
    borderRight: `1px solid ${theme.palette.quaternary?.main ?? 'goldenrod'}`,
  },
}))

const Highlight = observer(function Highlight({ model }: { model: LGV }) {
  const { classes } = useStyles()
  const [open, setOpen] = useState(false)
  const anchorEl = useRef(null)
  const color = useTheme().palette.quaternary?.main ?? 'goldenrod'

  const session = getSession(model) as SessionWithWidgets

  const dismissHighlight = () => {
    model.setHighlight(undefined)
  }

  const menuItems = [
    {
      label: 'Dismiss highlight',
      icon: CloseIcon,
      onClick: () => dismissHighlight(),
    },
    {
      label: 'Bookmark highlighted region',
      icon: BookmarkIcon,
      onClick: () => {
        let bookmarkWidget = session.widgets.get('GridBookmark')
        if (!bookmarkWidget) {
          bookmarkWidget = session.addWidget(
            'GridBookmarkWidget',
            'GridBookmark',
          )
        }
        // @ts-ignore
        bookmarkWidget.addBookmark(model.highlight as Region)
        dismissHighlight()
      },
    },
  ]

  function handleClose() {
    setOpen(false)
  }

  if (!model.highlight) {
    return null
  }

  // coords
  const mapCoords = (r: Required<ParsedLocString>) => {
    const s = model.bpToPx({
      refName: r.refName,
      coord: r.start,
    })
    const e = model.bpToPx({
      refName: r.refName,
      coord: r.end,
    })
    return s && e
      ? {
          width: Math.max(Math.abs(e.offsetPx - s.offsetPx), 3),
          left: Math.min(s.offsetPx, e.offsetPx) - model.offsetPx,
        }
      : undefined
  }

  const h = mapCoords(model.highlight)

  return (
    <>
      {h ? (
        <div
          className={classes.highlight}
          style={{
            left: h.left,
            width: h.width,
          }}
        >
          <Tooltip title={'Highlighted from URL parameter'} arrow>
            <IconButton
              ref={anchorEl}
              onClick={() => setOpen(true)}
              style={{ zIndex: 4 }}
            >
              <LinkIcon
                fontSize="small"
                sx={{
                  color: `${colord(color).darken(0.2).toRgbString()}`,
                }}
              />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl.current}
            onMenuItemClick={(_event, callback) => {
              callback(session)
              handleClose()
            }}
            open={open}
            onClose={handleClose}
            menuItems={menuItems}
          />
        </div>
      ) : null}
    </>
  )
})

export default Highlight

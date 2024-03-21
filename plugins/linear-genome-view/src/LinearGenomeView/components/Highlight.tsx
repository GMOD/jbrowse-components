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
    background: `${colord(theme.palette.highlight?.main ?? 'goldenrod')
      .alpha(0.35)
      .toRgbString()}`,
    height: '100%',
    overflow: 'hidden',
    position: 'absolute',
  },
}))

const Highlight = observer(function Highlight({ model }: { model: LGV }) {
  const { classes } = useStyles()
  const [open, setOpen] = useState(false)
  const anchorEl = useRef(null)
  const color = useTheme().palette.highlight?.main ?? 'goldenrod'

  const session = getSession(model) as SessionWithWidgets
  const { assemblyManager } = session

  const dismissHighlight = () => {
    model.setHighlight(undefined)
  }

  const menuItems = [
    {
      icon: CloseIcon,
      label: 'Dismiss highlight',
      onClick: () => dismissHighlight(),
    },
    {
      icon: BookmarkIcon,
      label: 'Bookmark highlighted region',
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
      coord: r.start,
      refName: r.refName,
    })
    const e = model.bpToPx({
      coord: r.end,
      refName: r.refName,
    })
    return s && e
      ? {
          left: Math.min(s.offsetPx, e.offsetPx) - model.offsetPx,
          width: Math.max(Math.abs(e.offsetPx - s.offsetPx), 3),
        }
      : undefined
  }

  const asm = assemblyManager.get(model.highlight?.assemblyName)

  const h = mapCoords({
    ...model.highlight,
    refName:
      asm?.getCanonicalRefName(model.highlight.refName) ??
      model.highlight.refName,
  })

  return h ? (
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
  ) : null
})

export default Highlight

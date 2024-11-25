import React, { useRef, useState } from 'react'
import { Menu } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import type { LinearGenomeViewModel } from '../model'
import type { Region, SessionWithWidgets } from '@jbrowse/core/util'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  highlight: {
    height: '100%',
    position: 'absolute',
    overflow: 'hidden',
    background: colord(theme.palette.highlight.main).alpha(0.35).toRgbString(),
  },
  linkIcon: {
    color: colord(theme.palette.highlight.main).darken(0.2).toRgbString(),
  },
}))

const Highlight = observer(function Highlight({
  model,
  highlight,
}: {
  model: LGV
  highlight: {
    assemblyName: string
    refName: string
    start: number
    end: number
  }
}) {
  const { classes } = useStyles()
  const [open, setOpen] = useState(false)
  const anchorEl = useRef(null)
  const session = getSession(model) as SessionWithWidgets
  const { assemblyManager } = session

  const dismissHighlight = () => {
    model.removeHighlight(highlight)
  }

  function handleClose() {
    setOpen(false)
  }

  // coords
  const mapCoords = (r: {
    assemblyName: string
    refName: string
    start: number
    end: number
  }) => {
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

  const asm = assemblyManager.get(highlight.assemblyName)

  const h = mapCoords({
    ...highlight,
    refName: asm?.getCanonicalRefName(highlight.refName) ?? highlight.refName,
  })

  return h ? (
    <div
      className={classes.highlight}
      style={{
        left: h.left,
        width: h.width,
      }}
    >
      <Tooltip title="Highlighted from URL parameter" arrow>
        <IconButton
          ref={anchorEl}
          onClick={() => {
            setOpen(true)
          }}
          style={{ zIndex: 3 }}
        >
          <LinkIcon fontSize="small" className={classes.linkIcon} />
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
              let bookmarkWidget = session.widgets.get('GridBookmark')
              if (!bookmarkWidget) {
                bookmarkWidget = session.addWidget(
                  'GridBookmarkWidget',
                  'GridBookmark',
                )
              }
              // @ts-expect-error
              bookmarkWidget.addBookmark(highlight as Region)
              dismissHighlight()
            },
          },
        ]}
      />
    </div>
  ) : null
})

const HighlightGroup = observer(function HighlightGroup({
  model,
}: {
  model: LGV
}) {
  return model.highlight.map((highlight, idx) => (
    <Highlight
      key={`${JSON.stringify(highlight)}-${idx}`}
      model={model}
      highlight={highlight}
    />
  ))
})

export default HighlightGroup

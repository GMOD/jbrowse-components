import React, { useRef, useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { colord } from '@jbrowse/core/util/colord'
import { ParsedLocString, getSession } from '@jbrowse/core/util'
import { Menu } from '@jbrowse/core/ui'
import { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import { IconButton, Tooltip } from '@mui/material'

// icons
import LinkIcon from '@mui/icons-material/Link'

// locals
import { LinearGenomeViewModel } from '../model'

type LGV = LinearGenomeViewModel

const COLOR = 'rgb(218, 165, 32)'

const useStyles = makeStyles()({
  highlight: {
    height: '100%',
    position: 'absolute',
    textAlign: 'center',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'start',
  },
})

interface ParsedLocStringA {
  assemblyName: string
  refName: string
  start: number
  end: number
  reversed: boolean
}

const Highlight = observer(function Highlight({ model }: { model: LGV }) {
  const { classes } = useStyles()
  const [open, setOpen] = useState(false)
  const anchorEl = useRef(null)

  const session = getSession(model)

  const menuItems = [
    {
      label: 'Dismiss highlight',
      onClick: () => model.setHighlight({} as ParsedLocString),
    },
  ]

  function handleClose() {
    setOpen(false)
  }

  if (!model.highlight) {
    return
  }

  // coords
  const mapCoords = (r: ParsedLocStringA) => {
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

  const h = mapCoords(model.highlight as ParsedLocStringA)

  return (
    <>
      {h ? (
        <div
          className={classes.highlight}
          style={{
            left: h.left,
            width: h.width,
            background: `${colord(COLOR).alpha(0.35).toRgbString()}`,
            borderLeft: `solid ${COLOR}`,
            borderRight: `solid ${COLOR}`,
          }}
        >
          <Tooltip title={'Highlighted from URL parameter'} arrow>
            <IconButton ref={anchorEl} onClick={() => setOpen(true)}>
              <LinkIcon
                fontSize="small"
                sx={{
                  color: `${colord(COLOR).darken(0.2).toRgbString()}`,
                }}
              />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl.current}
            // anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
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

export const OverviewHighlight = observer(function OverviewHighlight({
  model,
  overview,
}: {
  model: LGV
  overview: Base1DViewModel
}) {
  const { classes } = useStyles()

  const { cytobandOffset } = model

  // coords
  const mapCoords = (r: ParsedLocStringA) => {
    const s = overview.bpToPx({
      ...r,
      coord: r.reversed ? r.end : r.start,
    })

    const e = overview.bpToPx({
      ...r,
      coord: r.reversed ? r.start : r.end,
    })

    return s !== undefined && e != undefined
      ? {
          width: Math.abs(e - s),
          left: s + cytobandOffset,
        }
      : undefined
  }

  const h = mapCoords(model.highlight as ParsedLocStringA)

  return (
    <>
      {h ? (
        <div
          className={classes.highlight}
          style={{
            width: h.width,
            left: h.left,
            background: `${colord(COLOR).alpha(0.35).toRgbString()}`,
            borderLeft: `solid ${COLOR}`,
            borderRight: `solid ${COLOR}`,
          }}
        />
      ) : null}
    </>
  )
})

export default Highlight

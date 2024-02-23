import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { colord } from '@jbrowse/core/util/colord'
import { Tooltip } from '@mui/material'

// icons
import LinkIcon from '@mui/icons-material/Link'

// locals
import { LinearGenomeViewModel } from '../model'

type LGV = LinearGenomeViewModel

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

  const h = mapCoords(model.highlight)
  const color = 'rgba(252, 186, 3, 0.35)'

  return (
    <>
      {h ? (
        <div
          key={`${h.left}_${h.width}`}
          className={classes.highlight}
          style={{ left: h.left, width: h.width, background: color }}
        >
          <Tooltip title={'Highlighted from URL parameter'} arrow>
            <LinkIcon
              fontSize="small"
              sx={{
                color: `${
                  colord(color).alpha() !== 0
                    ? colord(color).alpha(0.8).toRgbString()
                    : colord(color).alpha(0).toRgbString()
                }`,
              }}
            />
          </Tooltip>
        </div>
      ) : null}
    </>
  )
})

export default Highlight

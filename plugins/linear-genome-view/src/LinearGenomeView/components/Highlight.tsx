import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import { LinearGenomeViewModel } from '../model'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  highlight: {
    height: '100%',
    background: 'rgba(255, 255, 0, 0.7)',
    border: '1px solid rgb(255, 178, 13)',
    position: 'absolute',
    zIndex: 10,
    textAlign: 'center',
    overflow: 'hidden',
  },
})

export default observer(function Highlight({ model }: { model: LGV }) {
  const { classes } = useStyles()
  const highlightCoords = model.highlight
    .map(r => {
      const s = model.bpToPx({ refName: r.refName, coord: r.start })
      const e = model.bpToPx({ refName: r.refName, coord: r.end })
      return s && e
        ? {
            width: Math.min(e.offsetPx - s.offsetPx, 3),
            left: Math.min(s.offsetPx, e.offsetPx) - model.offsetPx,
          }
        : undefined
    })
    .filter((f): f is { width: number; left: number } => !!f)

  return (
    <>
      {highlightCoords.map(({ left, width }) => (
        <div className={classes.highlight} style={{ left, width }}></div>
      ))}
    </>
  )
})

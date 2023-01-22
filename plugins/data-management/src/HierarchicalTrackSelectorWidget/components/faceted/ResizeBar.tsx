import React from 'react'
import { ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  resizeBar: {
    background: 'lightgrey',
    height: 12,
    position: 'relative',
  },
  tick: {
    position: 'absolute',
    height: '100%',
    background: 'black',
    width: 1,
  },
})
export default function ResizeBar({
  widths,
  setWidths,
}: {
  widths: number[]
  setWidths: (arg: number[]) => void
}) {
  const { classes } = useStyles()
  const offsets = [] as number[]
  widths.reduce((a, b, i) => (offsets[i] = a + b), 52)

  return (
    <div className={classes.resizeBar}>
      {offsets.map((left, i) => (
        <ResizeHandle
          key={'tick-' + i}
          onDrag={distance => {
            const newWidths = [...widths]
            newWidths[i] = newWidths[i] + distance
            setWidths(newWidths)
          }}
          vertical
          className={classes.tick}
          style={{ left }}
        />
      ))}
    </div>
  )
}

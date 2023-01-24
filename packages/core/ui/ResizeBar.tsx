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
  checkbox,
}: {
  widths: number[]
  setWidths: (arg: number[]) => void
  checkbox?: boolean
}) {
  const { classes } = useStyles()
  const offsets = [] as number[]
  widths.reduce((a, b, i) => (offsets[i] = a + b), checkbox ? 52 : 0)

  return (
    <div className={classes.resizeBar}>
      {offsets.map((left, i) => (
        <ResizeHandle
          key={'tick-' + i + '-' + left}
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

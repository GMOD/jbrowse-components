import React, { useState, useCallback } from 'react'
import { makeStyles } from 'tss-react/mui'

// locals
import ResizeHandle from './ResizeHandle'

const useStyles = makeStyles()(theme => ({
  resizeBar: {
    background: theme.palette.action.disabledBackground,
    height: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  tick: {
    position: 'absolute',
    height: '100%',
    pointerEvents: 'none',
    background: theme.palette.action.disabled,
    width: 1,
  },
  hiddenTick: {
    position: 'absolute',
    height: '100%',
    width: 5,
  },
}))

function Tick({
  left,
  scrollLeft,
  idx,
  onDrag,
  onMouseDown,
}: {
  idx: number
  left: number
  scrollLeft: number
  onMouseDown: (event: React.MouseEvent) => void
  onDrag: (
    lastFrameDistance: number,
    totalDistance: number,
    idx: number,
  ) => void
}) {
  const { classes } = useStyles()
  const onDragCallback = useCallback(
    (lastFrameDistance: number, totalDistance: number) =>
      onDrag(lastFrameDistance, totalDistance, idx),
    [idx, onDrag],
  )

  // has an invisible wider than tick mark (1px) clickable area (5px)
  return (
    <>
      <ResizeHandle
        onDrag={onDragCallback}
        onMouseDown={onMouseDown}
        vertical
        className={classes.hiddenTick}
        style={{ left: left - scrollLeft - 2.5 }}
      />
      <div style={{ left: left - scrollLeft }} className={classes.tick} />
    </>
  )
}

export default function ResizeBar({
  widths,
  setWidths,
  checkbox,
  scrollLeft = 0,
}: {
  widths: number[]
  setWidths: (arg: number[]) => void
  checkbox?: boolean
  scrollLeft?: number
}) {
  const { classes } = useStyles()
  const offsets = [] as number[]
  const [initial, setInitial] = useState<number[]>()
  let init = checkbox ? 52 : 0
  for (let i = 0; i < widths.length; i++) {
    const width = widths[i]
    offsets[i] = width + init
    init += width
  }

  return (
    <div className={classes.resizeBar}>
      {offsets.map((left, i) => (
        <Tick
          key={`${left}-${i}`}
          onMouseDown={() => setInitial([...widths])}
          left={i === offsets.length - 1 ? left - 3 : left}
          onDrag={(_: number, totalDistance: number, idx: number) => {
            const newWidths = [...widths]
            // mui doesn't allow columns smaller than 50
            newWidths[idx] = Math.max(initial![idx] - totalDistance, 50)
            setWidths(newWidths)
          }}
          idx={i}
          scrollLeft={scrollLeft}
        />
      ))}
    </div>
  )
}

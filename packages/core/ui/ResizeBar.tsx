import React, { useEffect, useRef, useState, useCallback } from 'react'
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
    background: theme.palette.divider,
    width: 1,
  },
  hiddenTick: {
    position: 'absolute',
    height: '100%',
    width: 5,
  },
}))

export function useResizeBar() {
  const ref = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      const elt = ref.current?.querySelector('.MuiDataGrid-virtualScroller')
      if (elt) {
        setScrollLeft(elt.scrollLeft)
      }
    }, 100)
    return () => {
      clearInterval(timer)
    }
  }, [])
  return { ref, scrollLeft }
}

function Tick({
  left,
  scrollLeft,
  idx,
  onDrag,
}: {
  idx: number
  left: number
  scrollLeft: number
  onDrag: (arg: number, idx: number) => void
}) {
  const { classes } = useStyles()
  const cb = useCallback(
    (d: number) => {
      onDrag(d, idx)
    },
    [idx, onDrag],
  )

  // has an invisible wider than tick mark (1px) clickable area (5px)
  return (
    <>
      <ResizeHandle
        onDrag={cb}
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
  let init = checkbox ? 52 : 0
  for (let i = 0; i < widths.length; i++) {
    const width = widths[i]
    offsets[i] = width + init
    init += width
  }

  const onDrag = useCallback(
    (distance: number, idx: number) => {
      const newWidths = [...widths]
      // mui doesn't allow columns smaller than 50
      newWidths[idx] = Math.max(newWidths[idx] + distance, 50)
      setWidths(newWidths)
    },
    [widths, setWidths],
  )
  return (
    <div className={classes.resizeBar}>
      {offsets.map((left, i) => (
        <Tick
          key={i}
          left={i === offsets.length - 1 ? left - 3 : left}
          onDrag={onDrag}
          idx={i}
          scrollLeft={scrollLeft}
        />
      ))}
    </div>
  )
}

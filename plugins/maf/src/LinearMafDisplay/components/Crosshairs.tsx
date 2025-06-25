import React from 'react'

import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  cursor: {
    pointerEvents: 'none',
  },
})

interface CrosshairsProps {
  width: number
  height: number
  scrollTop: number
  mouseX?: number
  mouseY: number
}

const Crosshairs = ({
  width,
  height,
  scrollTop,
  mouseX,
  mouseY,
}: CrosshairsProps) => {
  const { classes } = useStyles()

  return (
    <svg
      className={classes.cursor}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: scrollTop,
      }}
    >
      <line
        x1={0}
        x2={width}
        y1={mouseY - scrollTop}
        y2={mouseY - scrollTop}
        stroke="black"
      />
      <line x1={mouseX} x2={mouseX} y1={0} y2={height} stroke="black" />
    </svg>
  )
}

export default Crosshairs

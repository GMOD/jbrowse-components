import React from 'react'
import { makeStyles } from 'tss-react/mui'

// locals
import Category from './TrackCategory'
import TrackLabel from './TrackLabel'
import type { NodeData } from '../util'

const useStyles = makeStyles()(theme => ({
  // this accordionBase element's small padding is used to give a margin to
  // accordionColor it a "margin" because the virtualized elements can't really
  // use margin in a conventional way (it doesn't affect layout)
  accordionBase: {
    display: 'flex',
  },

  accordionCard: {
    padding: 3,
    cursor: 'pointer',
    display: 'flex',
  },

  nestingLevelMarker: {
    position: 'absolute',
    borderLeft: '1.5px solid #555',
  },
  // accordionColor set's display:flex so that the child accordionText use
  // vertically centered text
  accordionColor: {
    background: theme.palette.tertiary.main,
    color: theme.palette.tertiary.contrastText,
    width: '100%',
    display: 'flex',
    paddingLeft: 5,
  },
}))

// An individual node in the track selector. Note: manually sets cursor:
// pointer improves usability for what can be clicked
export default function Node({
  data,
  isOpen,
  style,
  setOpen,
}: {
  data: NodeData
  isOpen: boolean
  style?: { height: number }
  setOpen: (arg: boolean) => void
}) {
  const { isLeaf, nestingLevel } = data

  const { classes } = useStyles()
  const width = 10
  const marginLeft = nestingLevel * width + (isLeaf ? width : 0)

  return (
    <div style={style} className={!isLeaf ? classes.accordionBase : undefined}>
      {new Array(nestingLevel).fill(0).map((_, idx) => (
        <div
          /* biome-ignore lint/suspicious/noArrayIndexKey: */
          key={`mark-${idx}`}
          style={{ left: idx * width + 4, height: style?.height }}
          className={classes.nestingLevelMarker}
        />
      ))}
      <div
        className={!isLeaf ? classes.accordionCard : undefined}
        style={{
          marginLeft,
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        <div className={!isLeaf ? classes.accordionColor : undefined}>
          {!isLeaf ? (
            <Category isOpen={isOpen} data={data} setOpen={setOpen} />
          ) : (
            <TrackLabel data={data} />
          )}
        </div>
      </div>
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles, Portal } from '@material-ui/core'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { YSCALEBAR_LABEL_OFFSET } from '../models/model'
import { usePopper, Popper } from 'react-popper'

const toP = (s = 0) => parseFloat(s.toPrecision(6))

const useStyles = makeStyles(theme => ({
  popper: {
    fontSize: '0.8em',

    // important to have a zIndex directly on the popper itself
    // @material-ui/Tooltip uses popper and has similar thing
    zIndex: theme.zIndex.tooltip,

    // needed to avoid rapid mouseLeave/mouseEnter on popper
    pointerEvents: 'none',
  },

  hoverVertical: {
    background: '#333',
    border: 'none',
    width: 1,
    height: '100%',
    top: 0,
    cursor: 'default',
    position: 'absolute',
    pointerEvents: 'none',
  },
}))

function TooltipContents(props: { feature: Feature }) {
  const { feature } = props
  const ref = feature.get('refName')
  const displayRef = `${ref ? `${ref}:` : ''}`
  const start = (feature.get('start') + 1).toLocaleString('en-US')
  const end = feature.get('end').toLocaleString('en-US')
  const coord = start === end ? start : `${start}..${end}`
  const loc = `${displayRef}${coord}`

  return feature.get('summary') !== undefined ? (
    <div>
      {loc}
      <br />
      Max: {toP(feature.get('maxScore'))}
      <br />
      Avg: {toP(feature.get('score'))}
      <br />
      Min: {toP(feature.get('minScore'))}
    </div>
  ) : (
    <div>
      {loc}
      <br />
      {`${toP(feature.get('score'))}`}
    </div>
  )
}

type Coord = [number, number]
const Tooltip = observer(
  ({
    model,
    height,
    mouseCoord,
    clientRect,
  }: {
    model: any
    height: number
    mouseCoord: Coord
    clientRect: ClientRect
  }) => {
    const { featureUnderMouse } = model
    const classes = useStyles()

    const [popperElement, setPopperElement] = React.useState<any>(null)
    const { styles, attributes } = usePopper(
      {
        getBoundingClientRect() {
          const top = 100
          console.log(mouseCoord[0])
          return {
            top,
            left: mouseCoord[0],
            bottom: top + 1,
            right: mouseCoord[0] + 1,
            width: 90,
            height: 10,
          }
        },
      },
      popperElement,
      {
        strategy: 'fixed',
      },
    )

    return featureUnderMouse ? (
      <>
        <Portal>
          <div
            ref={setPopperElement}
            style={{
              ...styles.popper,
              background: 'white',
              zIndex: 10000,
            }}
            {...attributes.popper}
          >
            Popper element Popper element Popper element
            <br /> Popper element Popper element Popper element <br />
            Popper element
          </div>
        </Portal>

        <div
          className={classes.hoverVertical}
          style={{
            left: mouseCoord[0],
            height: height - YSCALEBAR_LABEL_OFFSET * 2,
          }}
        />
      </>
    ) : null
  },
)

export default Tooltip

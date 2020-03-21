/* eslint-disable react/require-default-props */
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import ReactPropTypes from 'prop-types'
import Feature from '../util/simpleFeature'
import { readConfObject } from '../configuration'

const useStyles = makeStyles({
  hoverLabel: {
    border: '1px solid black',
    position: 'absolute',
    background: '#fffa',
    pointerEvents: 'none',
    zIndex: 10000,
  },
})

const Tooltip = ({
  offsetX,
  offsetY,
  configuration,
  feature,
  timeout = 300,
}: {
  offsetX: number
  offsetY: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configuration: any
  feature?: Feature
  timeout?: number
}) => {
  const classes = useStyles()
  // only show the loading message after 400ms to prevent excessive flickering
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const handle = setTimeout(() => setShown(true), timeout)
    return () => clearTimeout(handle)
  })
  if (feature && shown) {
    const text = readConfObject(configuration, 'mouseover', [feature])
    return (
      <div
        className={classes.hoverLabel}
        style={{ left: offsetX, top: offsetY }}
      >
        {text}
      </div>
    )
  }
  return null
}

Tooltip.propTypes = {
  configuration: ReactPropTypes.shape({}).isRequired,
  offsetX: ReactPropTypes.number.isRequired,
  offsetY: ReactPropTypes.number.isRequired,
  feature: ReactPropTypes.shape({}),
  timeout: ReactPropTypes.number,
}

Tooltip.defaultProps = {
  feature: undefined,
}

export default observer(Tooltip)

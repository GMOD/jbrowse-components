/* eslint-disable react/require-default-props */
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import ReactPropTypes from 'prop-types'
import useTimeout from 'use-timeout'
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
  feature: Feature
  timeout: number
}) => {
  const classes = useStyles()
  const [hidden, setHidden] = useState(true)
  useTimeout(() => setHidden(false), timeout)
  return hidden ? null : (
    <div className={classes.hoverLabel} style={{ left: offsetX, top: offsetY }}>
      {readConfObject(configuration, 'mouseover', [feature])}
    </div>
  )
}

Tooltip.propTypes = {
  configuration: ReactPropTypes.shape({}).isRequired,
  offsetX: ReactPropTypes.number.isRequired,
  offsetY: ReactPropTypes.number.isRequired,
  feature: ReactPropTypes.shape({}).isRequired,
  timeout: ReactPropTypes.number,
}

export default observer(Tooltip)

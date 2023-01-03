import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { Feature } from '../util'
import { readConfObject, AnyConfigurationModel } from '../configuration'

const useStyles = makeStyles()({
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
  configuration: AnyConfigurationModel
  feature?: Feature
  timeout?: number
}) => {
  const { classes } = useStyles()
  const [shown, setShown] = useState(false)
  useEffect(() => {
    // only show the loading message after short timeout to prevent excessive
    // flickering
    const handle = setTimeout(() => setShown(true), timeout)
    return () => clearTimeout(handle)
  })
  if (feature && shown) {
    const text = readConfObject(configuration, 'mouseover', { feature })
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

export default observer(Tooltip)

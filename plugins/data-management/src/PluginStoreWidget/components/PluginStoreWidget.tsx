import React, { useState, useEffect } from 'react'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'

import { makeStyles } from '@material-ui/core/styles'
import { Typography } from '@material-ui/core'

import PluginCard from './PluginCard'

import type { JBrowsePlugin } from '../types'
import { PluginStoreModel } from '../model'

const useStyles = makeStyles(() => ({
  sectionHeader: {
    margin: '1em',
  },
}))

function PluginStoreWidget({ model }: { model: PluginStoreModel }) {
  const classes = useStyles()

  const [pluginArray, setPluginArray] = useState([])

  useEffect(() => {
    if (pluginArray.length === 0) {
      fetchPluginArray()
    }
  })

  const fetchPluginArray = async () => {
    const fetchResult = await fetch(
      'https://s3.amazonaws.com/jbrowse.org/plugin-store/plugins.json',
    )
    if (fetchResult.status !== 200) {
      throw new Error('Failed to fetch plugin data')
    }
    const array = await fetchResult.json()
    setPluginArray(array.plugins)
  }

  console.log(pluginArray)

  return (
    <div>
      <Typography className={classes.sectionHeader} variant="h5">
        Available plugins
      </Typography>
      {pluginArray.map(plugin => (
        <PluginCard key={(plugin as JBrowsePlugin).name} plugin={plugin} />
      ))}
    </div>
  )
}

PluginStoreWidget.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(PluginStoreWidget)

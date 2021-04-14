import React, { useState, useEffect } from 'react'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'

import { Typography } from '@material-ui/core'

import { PluginStoreModel } from '../model'

function PluginStoreWidget({ model }: { model: PluginStoreModel }) {
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

  return <Typography>Plugin Store lol</Typography>
}

PluginStoreWidget.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(PluginStoreWidget)

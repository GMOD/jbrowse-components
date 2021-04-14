import React from 'react'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'

import { Typography } from '@material-ui/core'

import { PluginStoreModel } from '../model'

function PluginStoreWidget({ model }: { model: PluginStoreModel }) {
  return <Typography>Plugin Store lol</Typography>
}

PluginStoreWidget.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(PluginStoreWidget)

import { ConfigurationEditor } from '@gmod/jbrowse-plugin-config-editing'
import { observer } from 'mobx-react-lite'
import React from 'react'

function ConfigureConnection(props) {
  const { model } = props

  return <ConfigurationEditor model={{ target: model }} />
}

export default observer(ConfigureConnection)

import React from 'react'
import { ConfigurationEditor as CoreConfigurationEditor } from '@jbrowse/core/ui/configEditor'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'

function ConfigurationEditor({ model }) {
  return <CoreConfigurationEditor target={model.target} />
}

ConfigurationEditor.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(ConfigurationEditor)

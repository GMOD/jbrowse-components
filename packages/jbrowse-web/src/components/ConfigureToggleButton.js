import React from 'react'
import ToggleButton from '@material-ui/lab/ToggleButton'
import { Icon } from '@material-ui/core'
import { observer, propTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'

function ConfigureToggleButton(props) {
  const { model, ...otherProps } = props
  const rootModel = getRoot(model)
  return (
    <ToggleButton
      type="button"
      size="small"
      style={{ minWidth: 0 }}
      selected={
        rootModel.visibleDrawerWidget &&
        rootModel.visibleDrawerWidget.id === 'configEditor' &&
        rootModel.visibleDrawerWidget.target.configId ===
          model.configuration.configId
      }
      value="configure"
      {...otherProps}
    >
      <Icon fontSize="small">settings</Icon>
    </ToggleButton>
  )
}

ConfigureToggleButton.propTypes = {
  model: propTypes.objectOrObservableObject.isRequired,
}
ConfigureToggleButton.defaultProps = {}

export default observer(ConfigureToggleButton)

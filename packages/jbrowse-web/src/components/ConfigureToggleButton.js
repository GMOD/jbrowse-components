import React from 'react'
import ToggleButton from '@material-ui/lab/ToggleButton'
import { Icon } from '@material-ui/core'
import { inject, observer, propTypes } from 'mobx-react'

function ConfigureToggleButton(props) {
  const { model, style, rootModel, ...otherProps } = props
  return (
    <ToggleButton
      type="button"
      size="small"
      style={{ minWidth: 0, ...style }}
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
  rootModel: propTypes.objectOrObservableObject.isRequired,
}
ConfigureToggleButton.defaultProps = {}

export default inject('rootModel')(observer(ConfigureToggleButton))

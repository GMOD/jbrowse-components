import React from 'react'
import ToggleButton from '@material-ui/lab/ToggleButton'
import { Icon } from '@material-ui/core'
import { observer, propTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'

function ConfigureToggleButton(props) {
  const { model, style, ...otherProps } = props
  const rootModel = getRoot(model)
  const drawerWidgets = Array.from(rootModel.activeDrawerWidgets.values())
  const activeDrawerWidget = drawerWidgets[drawerWidgets.length - 1]
  return (
    <ToggleButton
      type="button"
      size="small"
      style={{ minWidth: 0, ...style }}
      selected={
        activeDrawerWidget &&
        activeDrawerWidget.id === 'configEditor' &&
        activeDrawerWidget.target.configId === model.configuration.configId
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

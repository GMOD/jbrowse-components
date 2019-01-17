import React from 'react'
import { getRoot } from 'mobx-state-tree'
import ToggleButton from '@material-ui/lab/ToggleButton'
import { Icon } from '@material-ui/core'
import { propTypes, observer } from 'mobx-react'

function ConfigureToggleButton(props) {
  const { model, style, ...otherProps } = props
  const rootModel = getRoot(model)
  return (
    <ToggleButton
      type="button"
      size="small"
      style={{ minWidth: 0, ...style }}
      selected={
        rootModel.task &&
        rootModel.task.taskName === 'configure' &&
        rootModel.task.data === model.configuration
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

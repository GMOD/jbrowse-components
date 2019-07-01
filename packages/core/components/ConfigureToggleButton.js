import React from 'react'
import ToggleButton from '@material-ui/lab/ToggleButton'
import { withStyles, Icon } from '@material-ui/core'
import { observer, PropTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'

const styles = theme => ({
  button: {
    height: '32px',
    border: 'none',
  },
})

function ConfigureToggleButton(props) {
  const { classes, model, ...otherProps } = props
  const rootModel = getRoot(model)
  return (
    <ToggleButton
      type="button"
      size="small"
      style={{ minWidth: 0 }}
      className={classes.button}
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
  model: PropTypes.objectOrObservableObject.isRequired,
}
ConfigureToggleButton.defaultProps = {}

export default withStyles(styles)(observer(ConfigureToggleButton))

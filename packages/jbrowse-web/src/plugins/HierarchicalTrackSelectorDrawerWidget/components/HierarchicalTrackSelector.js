import { IconButton } from '@material-ui/core'
import Fab from '@material-ui/core/Fab'
import Icon from '@material-ui/core/Icon'
import InputAdornment from '@material-ui/core/InputAdornment'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import { withStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import propTypes from 'prop-types'
import React from 'react'
import { readConfObject } from '../../../configuration'
import Contents from './Contents'

const styles = theme => ({
  root: {
    textAlign: 'left',
    padding: theme.spacing.unit,
  },
  fab: {
    float: 'right',
    position: 'sticky',
    'margin-top': theme.spacing.unit * 2,
    bottom: theme.spacing.unit * 2,
    right: theme.spacing.unit * 2,
  },
})

@withStyles(styles)
@observer
class HierarchicalTrackSelector extends React.Component {
  static propTypes = {
    classes: propTypes.shape({
      root: propTypes.string.isRequired,
      fab: propTypes.string.isRequired,
    }).isRequired,
    model: MobxPropTypes.observableObject.isRequired,
  }

  state = {
    anchorEl: null,
  }

  handleFabClick = event => {
    this.setState({ anchorEl: event.currentTarget })
  }

  handleFabClose = () => {
    this.setState({ anchorEl: null })
  }

  handleInputChange = event => {
    const { model } = this.props
    model.setFilterText(event.target.value)
  }

  addDataHub = () => {
    this.handleFabClose()
    const { model } = this.props
    const rootModel = getRoot(model)
    if (!rootModel.drawerWidgets.get('dataHubDrawerWidget'))
      rootModel.addDrawerWidget('DataHubDrawerWidget', 'dataHubDrawerWidget')
    rootModel.showDrawerWidget(
      rootModel.drawerWidgets.get('dataHubDrawerWidget'),
    )
  }

  addTrack = () => {
    this.handleFabClose()
    const { model } = this.props
    const rootModel = getRoot(model)
    if (!rootModel.drawerWidgets.get('addTrackDrawerWidget'))
      rootModel.addDrawerWidget('AddTrackDrawerWidget', 'addTrackDrawerWidget')
    rootModel.showDrawerWidget(
      rootModel.drawerWidgets.get('addTrackDrawerWidget'),
    )
  }

  filter = trackConfig => {
    const { model } = this.props
    if (!model.filterText) return true
    const name = readConfObject(trackConfig, 'name')
    return name.toLowerCase().includes(model.filterText.toLowerCase())
  }

  render() {
    const { anchorEl } = this.state
    const { classes, model } = this.props

    const filterError =
      model.trackConfigurations.filter(this.filter).length === 0

    return (
      <div className={classes.root}>
        <TextField
          label="Filter Tracks"
          value={model.filterText}
          error={filterError}
          helperText={filterError ? 'No matches' : ''}
          onChange={this.handleInputChange}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Icon>search</Icon>
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={model.clearFilterText}>
                  <Icon>clear</Icon>
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <Contents model={model} filterPredicate={this.filter} />
        <Fab
          color="secondary"
          className={classes.fab}
          onClick={this.handleFabClick}
        >
          <Icon>add</Icon>
        </Fab>
        <Menu
          id="simple-menu"
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={this.handleFabClose}
        >
          <MenuItem onClick={this.addDataHub}>Add Data Hub</MenuItem>
          <MenuItem onClick={this.addTrack}>Add track</MenuItem>
        </Menu>
      </div>
    )
  }
}

export default HierarchicalTrackSelector

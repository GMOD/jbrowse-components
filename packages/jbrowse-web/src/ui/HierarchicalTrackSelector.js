import React from 'react'
import PropTypes from 'prop-types'
import Button from '@material-ui/core/Button'
import Checkbox from '@material-ui/core/Checkbox'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormGroup from '@material-ui/core/FormGroup'
import Icon from '@material-ui/core/Icon'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import { withStyles } from '@material-ui/core/styles'

const styles = theme => ({
  root: {
    textAlign: 'left',
  },
  heading: {
    fontSize: theme.typography.pxToRem(15),
    fontWeight: theme.typography.fontWeightRegular,
  },
  fab: {
    float: 'right',
    position: 'sticky',
    bottom: theme.spacing.unit * 2,
    right: theme.spacing.unit * 2,
  },
})

function generateExpansionPanel(classes, trackGroup) {
  return (
    <ExpansionPanel key={trackGroup.groupName} defaultExpanded>
      <ExpansionPanelSummary
        key={trackGroup.groupName}
        expandIcon={<Icon>expand_more</Icon>}
      >
        <Typography key={trackGroup.groupName} className={classes.heading}>
          {trackGroup.groupName}
        </Typography>
      </ExpansionPanelSummary>
      <ExpansionPanelDetails key={trackGroup.groupName}>
        <FormGroup key={trackGroup.groupName}>
          {trackGroup.groupTracks.map(track => {
            if ('groupName' in track)
              return generateExpansionPanel(classes, track)
            return (
              <Tooltip
                key={track.trackName}
                title={track.trackDetails}
                placement="left"
                enterDelay={500}
              >
                <FormControlLabel
                  key={track.trackName}
                  control={<Checkbox />}
                  label={track.trackName}
                />
              </Tooltip>
            )
          })}
        </FormGroup>
      </ExpansionPanelDetails>
    </ExpansionPanel>
  )
}

class HierarchicalTrackSelector extends React.Component {
  state = {
    anchorEl: null,
  }

  handleClick = event => {
    this.setState({ anchorEl: event.currentTarget })
  }

  handleClose = () => {
    this.setState({ anchorEl: null })
  }

  render() {
    const { classes, config, theme } = this.props
    const { anchorEl } = this.state

    const style = {
      padding: theme.spacing.unit,
    }

    return (
      <div className={classes.root} style={style}>
        <Typography variant="h6">Available Tracks</Typography>
        {config.map(group => generateExpansionPanel(classes, group))}
        <Button
          variant="fab"
          className={classes.fab}
          color="primary"
          aria-owns={anchorEl ? 'track-menu' : null}
          aria-haspopup="true"
          onClick={this.handleClick}
        >
          <Icon>add</Icon>
        </Button>
        <Menu
          id="simple-menu"
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={this.handleClose}
        >
          <MenuItem onClick={this.handleClose}>Open track file or URL</MenuItem>
          <MenuItem onClick={this.handleClose}>Add combination track</MenuItem>
          <MenuItem onClick={this.handleClose}>
            Add sequence search track
          </MenuItem>
        </Menu>
      </div>
    )
  }
}

HierarchicalTrackSelector.propTypes = {
  classes: PropTypes.shape({
    root: PropTypes.shape.isRequired,
    heading: PropTypes.shape.isRequired,
    fab: PropTypes.shape.isRequired,
  }).isRequired,
  config: PropTypes.shape().isRequired,
  theme: PropTypes.shape().isRequired,
  // width: PropTypes.number.isRequired,
}

export default withStyles(styles, { withTheme: true })(
  HierarchicalTrackSelector,
)

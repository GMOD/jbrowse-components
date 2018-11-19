import React from 'react'
import propTypes from 'prop-types'
import { values } from 'mobx'
import { observer, PropTypes as MobxPropTypes, inject } from 'mobx-react'
import Typography from '@material-ui/core/Typography'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import { CombineLatestSubscriber } from 'rxjs/internal/observable/combineLatest'
import { MuiThemeProvider, withStyles } from '@material-ui/core/styles'

const styles = theme => ({
  root: {
    textAlign: 'left',
    padding: theme.spacing.unit,
  },
})

@withStyles(styles)
@inject('rootModel')
@observer
class HierarchicalTrackSelector extends React.Component {
  static propTypes = {
    classes: propTypes.shape({
      root: propTypes.string.isRequired,
    }).isRequired,
    model: MobxPropTypes.observableObject.isRequired,
  }

  // static wrappedComponent = {
  //   propTypes: {
  //     rootModel: MobxPropTypes.observableObject.isRequired,
  //   },
  // }

  render() {
    const { classes, model } = this.props

    return (
      <div className={classes.root}>
        <Typography variant="h6">Available Tracks</Typography>
        <ExpansionPanel>
          <ExpansionPanelSummary>
            The track selector for view {model.id} is under construction.
          </ExpansionPanelSummary>
          <ExpansionPanelDetails>Tracks will be here...</ExpansionPanelDetails>
        </ExpansionPanel>
      </div>
    )
  }
}

export default HierarchicalTrackSelector

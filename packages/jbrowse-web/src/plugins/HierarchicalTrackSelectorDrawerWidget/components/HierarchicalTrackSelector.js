import Checkbox from '@material-ui/core/Checkbox'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormGroup from '@material-ui/core/FormGroup'
import Icon from '@material-ui/core/Icon'
import { withStyles } from '@material-ui/core/styles'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import {
  inject,
  observer,
  PropTypes as MobxPropTypes,
  Provider,
} from 'mobx-react'
import propTypes from 'prop-types'
import React from 'react'
import { getConf, readConfObject } from '../../../configuration'

const styles = theme => ({
  root: {
    textAlign: 'left',
    padding: theme.spacing.unit,
  },
  expansionPanelDetails: {
    display: 'block',
  },
})

const Category = inject('model', 'classes')(
  observer(({ name, category, model, classes, path = '' }) => {
    const pathName = [...path, name].join('|')
    return (
      <ExpansionPanel
        expanded={!model.collapsed.get(pathName)}
        onChange={() => model.toggleCategory(pathName)}
      >
        <ExpansionPanelSummary expandIcon={<Icon>expand_more</Icon>}>
          <Typography variant="button">{name}</Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails className={classes.expansionPanelDetails}>
          <Contents path={path.concat([name])} category={category} />
        </ExpansionPanelDetails>
      </ExpansionPanel>
    )
  }),
)

Category.propTypes = {
  name: propTypes.string.isRequired,
  category: MobxPropTypes.objectOrObservableObject.isRequired,
}

const Contents = inject('model')(
  observer(({ category, model }) => {
    const categories = []
    const trackConfigurations = []
    Object.entries(category).forEach(([name, contents], i) => {
      if (contents._configId) {
        trackConfigurations.push([name, contents])
      } else {
        categories.push([name, contents])
      }
    })
    return (
      <div className="contents">
        {categories.map(([name, contents]) => (
          <Category key={name} name={name} category={contents} />
        ))}
        <FormGroup>
          {trackConfigurations.map(([name, trackConf]) => (
            <Tooltip
              key={trackConf._configId}
              title={readConfObject(trackConf, 'description')}
              placement="left"
              enterDelay={500}
            >
              <FormControlLabel
                control={<Checkbox />}
                label={readConfObject(trackConf, 'name')}
                checked={[...model.view.tracks.values()].some(
                  t => t.configuration === trackConf,
                )}
                onChange={() => model.view.toggleTrack(trackConf)}
              />
            </Tooltip>
          ))}
        </FormGroup>
      </div>
    )
  }),
)
Contents.propTypes = {
  category: MobxPropTypes.objectOrObservableObject.isRequired,
}

@withStyles(styles)
@observer
class HierarchicaltrackConfigurationselector extends React.Component {
  static propTypes = {
    classes: propTypes.shape({
      root: propTypes.string.isRequired,
      expansionPanelDetails: propTypes.string.isRequired,
    }).isRequired,
    model: MobxPropTypes.observableObject.isRequired,
  }

  render() {
    const { classes, model } = this.props

    return (
      <Provider model={model} classes={classes}>
        <div className={classes.root}>
          <Contents category={model.hierarchy} />
        </div>
      </Provider>
    )
  }
}

export default HierarchicaltrackConfigurationselector

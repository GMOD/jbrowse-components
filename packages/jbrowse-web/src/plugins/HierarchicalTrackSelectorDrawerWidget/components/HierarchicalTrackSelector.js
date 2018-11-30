import { IconButton } from '@material-ui/core'
import Checkbox from '@material-ui/core/Checkbox'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormGroup from '@material-ui/core/FormGroup'
import Icon from '@material-ui/core/Icon'
import InputAdornment from '@material-ui/core/InputAdornment'
import { withStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
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
import { readConfObject } from '../../../configuration'

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

const Contents = inject('model', 'filterPredicate')(
  observer(({ category, model, filterPredicate }) => {
    const categories = []
    const trackConfigurations = []
    Object.entries(category).forEach(([name, contents], i) => {
      if (contents._configId) {
        trackConfigurations.push(contents)
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
          {trackConfigurations.filter(filterPredicate).map(trackConf => (
            <Tooltip
              key={trackConf._configId}
              title={readConfObject(trackConf, 'description')}
              placement="left"
              enterDelay={500}
            >
              <FormControlLabel
                control={<Checkbox />}
                label={readConfObject(trackConf, 'name')}
                checked={model.view.tracks.some(
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

// // Gets number of non-filtered tracks including those in sub-categories
// function getTrackCount(trackHierarchy, model) {
//   let numTracks = 0
//   trackHierarchy.forEach((value, category) => {
//     if (category === 'uncategorized')
//       numTracks += value.filter(track => trackFilter(track, model)).length
//     else numTracks += getTrackCount(value, model)
//   })
//   return numTracks
// }

@withStyles(styles)
@observer
class HierarchicalTrackSelector extends React.Component {
  static propTypes = {
    classes: propTypes.shape({
      root: propTypes.string.isRequired,
      expansionPanelDetails: propTypes.string.isRequired,
    }).isRequired,
    model: MobxPropTypes.observableObject.isRequired,
  }

  handleInputChange = event => {
    const { model } = this.props
    model.setFilterText(event.target.value)
  }

  filter = trackConfig => {
    const { model } = this.props
    if (!model.filterText) return true
    const name = readConfObject(trackConfig, 'name')
    if (!name) debugger
    return name.toLowerCase().includes(model.filterText)
  }

  render() {
    const { classes, model } = this.props

    const filterError =
      model.trackConfigurations.filter(this.filter).length === 0

    return (
      <Provider model={model} classes={classes} filterPredicate={this.filter}>
        <div className={classes.root}>
          <TextField
            label="Filter Tracks"
            value={model.filterText}
            error={filterError}
            helperText={filterError ? 'No matches' : ''}
            onChange={this.handleInputChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Icon>search</Icon>
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="start">
                  <IconButton onClick={model.clearFilterText}>
                    <Icon>clear</Icon>
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Contents category={model.hierarchy} />
        </div>
      </Provider>
    )
  }
}

export default HierarchicalTrackSelector

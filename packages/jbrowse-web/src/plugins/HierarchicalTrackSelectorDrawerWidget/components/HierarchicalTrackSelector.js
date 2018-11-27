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
import { values } from 'mobx'
import { inject, observer, PropTypes as MobxPropTypes } from 'mobx-react'
import propTypes from 'prop-types'
import React from 'react'

const styles = theme => ({
  root: {
    textAlign: 'left',
    padding: theme.spacing.unit,
  },
  expansionPanelDetails: {
    display: 'block',
  },
})

function addTrackToHierarchy(trackHierarchy, track) {
  const numCategories = track.configuration.category.value.length
  if (numCategories === 0)
    trackHierarchy.set(
      'uncategorized',
      trackHierarchy.get('uncategorized').concat([track]),
    )
  else {
    let prunedHierarchy = trackHierarchy
    track.configuration.category.value.forEach((category, idx) => {
      if (!prunedHierarchy.has(category)) {
        prunedHierarchy.set(category, new Map([['uncategorized', []]]))
      }
      prunedHierarchy = prunedHierarchy.get(category)
      if (idx + 1 === numCategories) {
        prunedHierarchy.set(
          'uncategorized',
          prunedHierarchy.get('uncategorized').concat([track]),
        )
      }
    })
  }
}

function trackFilter(track, model) {
  return track.name.toLowerCase().includes(model.filterText)
}

function generateTrackList(trackHierarchy, view, classes, model) {
  const trackList = trackHierarchy.get('uncategorized')
  const elements = [
    <FormGroup key={`FormGroup-${trackList.map(track => track.id).join('-')}`}>
      {trackList
        .filter(track => trackFilter(track, model))
        .map(track => (
          <Tooltip
            key={track.id}
            title={track.configuration.description.value}
            placement="left"
            enterDelay={500}
          >
            <FormControlLabel
              key={track.id}
              control={<Checkbox />}
              label={track.name}
              checked={track.visible}
              onChange={() => {
                view.tracks.get(track.id).toggle()
              }}
            />
          </Tooltip>
        ))}
    </FormGroup>,
  ]
  trackHierarchy.forEach((value, category) => {
    if (category !== 'uncategorized') {
      /* eslint-disable react/no-array-index-key */
      elements.push(
        <ExpansionPanel
          key={category}
          expanded={model.categories.get(category).open}
          onChange={() => model.categories.get(category).toggle()}
        >
          <ExpansionPanelSummary
            key={category}
            expandIcon={<Icon>expand_more</Icon>}
          >
            <Typography key={category} variant="button">
              {`${category} (${
                value
                  .get('uncategorized')
                  .filter(track => trackFilter(track, model)).length
              })`}
            </Typography>
          </ExpansionPanelSummary>
          <ExpansionPanelDetails
            key={category}
            className={classes.expansionPanelDetails}
          >
            {generateTrackList(value, view, classes, model)}
          </ExpansionPanelDetails>
        </ExpansionPanel>,
      )
      /* eslint-enable react/no-array-index-key */
    }
  })
  return elements
}

@withStyles(styles)
@inject('rootModel')
@observer
class HierarchicalTrackSelector extends React.Component {
  static propTypes = {
    classes: propTypes.shape({
      root: propTypes.string.isRequired,
      expansionPanelDetails: propTypes.string.isRequired,
    }).isRequired,
    model: MobxPropTypes.observableObject.isRequired,
  }

  static wrappedComponent = {
    propTypes: {
      rootModel: MobxPropTypes.observableObject.isRequired,
    },
  }

  handleInputChange = event => {
    const { model } = this.props
    model.updateFilterText(event.target.value)
  }

  render() {
    const { classes, model, rootModel } = this.props
    const view = rootModel.views.filter(v => v.id === model.id)[0]
    const trackHierarchy = new Map([['uncategorized', []]])

    values(view.tracks).forEach(track => {
      addTrackToHierarchy(trackHierarchy, track)
    })

    const filterError =
      values(view.tracks).filter(track => trackFilter(track, model)).length ===
      0

    return (
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
                <IconButton onClick={() => model.updateFilterText('')}>
                  <Icon>clear</Icon>
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {generateTrackList(trackHierarchy, view, classes, model)}
      </div>
    )
  }
}

export default HierarchicalTrackSelector

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
import { values } from 'mobx'
import { inject, observer, PropTypes as MobxPropTypes } from 'mobx-react'
import propTypes from 'prop-types'
import React from 'react'

const styles = theme => ({
  root: {
    textAlign: 'left',
    padding: theme.spacing.unit,
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
    track.configuration.category.value.forEach((categ, idx) => {
      if (!prunedHierarchy.has(categ)) {
        prunedHierarchy.set(categ, new Map([['uncategorized', []]]))
      }
      prunedHierarchy = prunedHierarchy.get(categ)
      if (idx + 1 === numCategories)
        prunedHierarchy.set(
          'uncategorized',
          prunedHierarchy.get('uncategorized').concat([track]),
        )
    })
  }
}

function generateExpansionPanel(trackHierarchy, view, classes) {
  const elements = [
    generateFormGroup(trackHierarchy.get('uncategorized'), view),
  ]
  trackHierarchy.forEach((value, category) => {
    if (category !== 'uncategorized') {
      /* eslint-disable react/no-array-index-key */
      elements.push(
        <ExpansionPanel key={category} defaultExpanded>
          <ExpansionPanelSummary
            key={category}
            expandIcon={<Icon>expand_more</Icon>}
          >
            <Typography key={category}>{category}</Typography>
          </ExpansionPanelSummary>
          <ExpansionPanelDetails key={category}>
            <FormGroup key={category}>
              {generateExpansionPanel(value, view, classes)}
            </FormGroup>
          </ExpansionPanelDetails>
        </ExpansionPanel>,
      )
      /* eslint-enable react/no-array-index-key */
    }
  })
  return elements
}

function generateFormGroup(trackList, currView) {
  return (
    <FormGroup key={`FormGroup-${trackList.map(track => track.id).join('-')}`}>
      {trackList.map(track => (
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
              currView.tracks.get(track.id).toggle()
            }}
          />
        </Tooltip>
      ))}
    </FormGroup>
  )
}

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

  static wrappedComponent = {
    propTypes: {
      rootModel: MobxPropTypes.observableObject.isRequired,
    },
  }

  render() {
    const { classes, model, rootModel } = this.props

    let currView = []
    rootModel.views.forEach(view => {
      if (view.id === model.id) currView = view
    })

    const trackHierarchy = new Map([['uncategorized', []]])

    values(currView.tracks).forEach(track => {
      addTrackToHierarchy(trackHierarchy, track)
    })

    return (
      <div className={classes.root}>
        <Typography variant="h6">Available Tracks</Typography>
        {generateExpansionPanel(trackHierarchy, currView, classes)}
      </div>
    )
  }
}

export default HierarchicalTrackSelector

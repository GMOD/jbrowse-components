import Checkbox from '@material-ui/core/Checkbox'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormGroup from '@material-ui/core/FormGroup'
import Icon from '@material-ui/core/Icon'
import Tooltip from '@material-ui/core/Tooltip'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import propTypes from 'prop-types'
import React from 'react'
import { readConfObject } from '../../../configuration'

const styles = {
  expansionPanelDetails: {
    display: 'block',
  },
}

const Category = withStyles(styles)(
  observer(({ name, category, model, classes, path = [], filterPredicate }) => {
    const pathName = path.join('|')

    return (
      <ExpansionPanel
        expanded={!model.collapsed.get(pathName)}
        onChange={() => model.toggleCategory(pathName)}
      >
        <ExpansionPanelSummary expandIcon={<Icon>expand_more</Icon>}>
          <Typography variant="button">{`${name} (${
            Object.keys(model.allTracksInCategoryPath(path)).length
          })`}</Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails className={classes.expansionPanelDetails}>
          <Contents
            path={path}
            category={category}
            filterPredicate={filterPredicate}
            model={model}
          />
        </ExpansionPanelDetails>
      </ExpansionPanel>
    )
  }),
)

Category.propTypes = {
  name: propTypes.string.isRequired,
  category: MobxPropTypes.objectOrObservableObject.isRequired,
}

const Contents = observer(({ category, model, filterPredicate, path = [] }) => {
  const categories = []
  const trackConfigurations = []
  Object.entries(category).forEach(([name, contents]) => {
    if (contents._configId) {
      trackConfigurations.push(contents)
    } else {
      categories.push([name, contents])
    }
  })
  return (
    <div>
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
      {categories.map(([name, contents]) => (
        <Category
          key={name}
          path={path.concat([name])}
          name={name}
          category={contents}
          filterPredicate={filterPredicate}
          model={model}
        />
      ))}
    </div>
  )
})

Contents.propTypes = {
  category: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default Contents

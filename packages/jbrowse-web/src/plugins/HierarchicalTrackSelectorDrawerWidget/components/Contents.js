import Checkbox from '@material-ui/core/Checkbox'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import Fade from '@material-ui/core/Fade'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormGroup from '@material-ui/core/FormGroup'
import Icon from '@material-ui/core/Icon'
import CircularProgress from '@material-ui/core/CircularProgress'
import { withStyles } from '@material-ui/core/styles'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import propTypes from 'prop-types'
import React from 'react'
import { requestIdleCallback } from 'request-idle-callback'
import { readConfObject } from '../../../configuration'

const styles = {
  expansionPanelDetails: {
    display: 'block',
  },
}

const Category = withStyles(styles)(
  observer(props => {
    const { name, category, model, filterPredicate, path, classes } = props
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

Category.defaultProps = {
  filterPredicate: () => true,
  path: [],
}

Category.propTypes = {
  name: propTypes.string.isRequired,
  category: MobxPropTypes.objectOrObservableObject.isRequired,
  model: MobxPropTypes.observableObject.isRequired,
  filterPredicate: propTypes.func,
  path: propTypes.arrayOf(propTypes.string),
}

@observer
class Contents extends React.Component {
  static propTypes = {
    category: MobxPropTypes.objectOrObservableObject.isRequired,
    model: MobxPropTypes.observableObject.isRequired,
    filterPredicate: propTypes.func,
    path: propTypes.arrayOf(propTypes.string),
  }

  static defaultProps = {
    filterPredicate: () => true,
    path: [],
  }

  state = {
    categories: [],
    trackConfigurations: [],
  }

  componentDidMount() {
    this.loadMoreTracks()
  }

  loadMoreTracks() {
    this.setState((state, props) => {
      const { categories, trackConfigurations } = state
      const { category } = props
      const numLoaded = categories.length + trackConfigurations.length
      Array.from(category)
        .slice(numLoaded, numLoaded + 10)
        .forEach(([name, contents]) => {
          if (contents._configId) {
            trackConfigurations.push(contents)
          } else {
            categories.push([name, contents])
          }
        })
      if (categories.length + trackConfigurations.length !== category.size)
        requestIdleCallback(() => {
          this.loadMoreTracks()
        })
      return { categories, trackConfigurations }
    })
  }

  render() {
    const { categories, trackConfigurations } = this.state
    const { category, model, filterPredicate, path } = this.props
    return (
      <>
        <FormGroup>
          {trackConfigurations.filter(filterPredicate).map(trackConf => (
            <Fade in key={trackConf._configId}>
              <Tooltip
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
            </Fade>
          ))}
        </FormGroup>
        {categories.length + trackConfigurations.length !== category.size ? (
          <CircularProgress />
        ) : null}
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
      </>
    )
  }
}

export default Contents

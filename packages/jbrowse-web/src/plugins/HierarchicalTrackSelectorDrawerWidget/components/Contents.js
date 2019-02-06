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
import { requestIdleCallback, cancelIdleCallback } from 'request-idle-callback'
import { readConfObject } from '../../../configuration'

const styles = {
  expansionPanelDetails: {
    display: 'block',
  },
}

const CompactCheckbox = withStyles({
  root: {
    padding: 0,
  },
})(Checkbox)

const Category = withStyles(styles)(
  observer(props => {
    const { model, path, filterPredicate, disabled, classes } = props
    const pathName = path.join('|')
    const name = path[path.length - 1]

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
            model={model}
            path={path}
            filterPredicate={filterPredicate}
            disabled={disabled}
          />
        </ExpansionPanelDetails>
      </ExpansionPanel>
    )
  }),
)

Category.defaultProps = {
  filterPredicate: () => true,
  path: [],
  disabled: false,
}

Category.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
  path: propTypes.arrayOf(propTypes.string),
  filterPredicate: propTypes.func,
  disabled: propTypes.bool,
}

@observer
class Contents extends React.Component {
  static propTypes = {
    model: MobxPropTypes.observableObject.isRequired,
    path: propTypes.arrayOf(propTypes.string),
    filterPredicate: propTypes.func,
    disabled: propTypes.bool,
  }

  static defaultProps = {
    filterPredicate: () => true,
    path: [],
    disabled: false,
  }

  state = {
    categories: [],
    trackConfigurations: [],
    doneLoading: false,
    handle: undefined,
  }

  componentDidMount() {
    this.loadMoreTracks()
  }

  componentWillUnmount() {
    const { handle } = this.state
    cancelIdleCallback(handle)
  }

  loadMoreTracks() {
    this.setState((state, props) => {
      const { categories, trackConfigurations } = state
      let { doneLoading } = state
      const { model, path } = props
      let { hierarchy } = model
      path.forEach(pathEntry => {
        hierarchy = hierarchy.get(pathEntry) || new Map()
      })
      const numLoaded = categories.length + trackConfigurations.length
      Array.from(hierarchy)
        .slice(numLoaded, numLoaded + 10)
        .forEach(([name, contents]) => {
          if (contents.configId) {
            trackConfigurations.push(contents)
          } else {
            categories.push([name, contents])
          }
        })
      let handle
      if (categories.length + trackConfigurations.length !== hierarchy.size) {
        handle = requestIdleCallback(() => {
          this.loadMoreTracks()
        })
      } else doneLoading = true
      return { categories, trackConfigurations, doneLoading, handle }
    })
  }

  render() {
    const { categories, trackConfigurations, doneLoading } = this.state
    const { model, path, filterPredicate, disabled } = this.props
    return (
      <>
        <FormGroup>
          {trackConfigurations.filter(filterPredicate).map(trackConf => (
            <Fade in key={trackConf.configId}>
              <Tooltip
                title={readConfObject(trackConf, 'description')}
                placement="left"
                enterDelay={500}
              >
                <FormControlLabel
                  control={<CompactCheckbox />}
                  label={readConfObject(trackConf, 'name')}
                  checked={model.view.tracks.some(
                    t => t.configuration === trackConf,
                  )}
                  onChange={() => model.view.toggleTrack(trackConf)}
                  disabled={disabled}
                />
              </Tooltip>
            </Fade>
          ))}
        </FormGroup>
        {doneLoading ? null : <CircularProgress />}
        {categories.map(([name]) => (
          <Category
            key={name}
            model={model}
            path={path.concat([name])}
            filterPredicate={filterPredicate}
            disabled={disabled}
          />
        ))}
      </>
    )
  }
}

export default Contents
export { Category }

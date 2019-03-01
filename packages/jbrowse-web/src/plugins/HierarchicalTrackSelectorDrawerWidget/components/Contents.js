import Checkbox from '@material-ui/core/Checkbox'
import CircularProgress from '@material-ui/core/CircularProgress'
import Divider from '@material-ui/core/Divider'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import Fade from '@material-ui/core/Fade'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormGroup from '@material-ui/core/FormGroup'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import { withStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import propTypes from 'prop-types'
import React from 'react'
import { cancelIdleCallback, requestIdleCallback } from 'request-idle-callback'
import { readConfObject } from '../../../configuration'

const categoryStyles = theme => ({
  expansionPanelDetails: {
    display: 'block',
    padding: '8px',
  },
  content: {
    '&$expanded': {
      margin: '8px 0',
    },
    margin: '8px 0',
  },
  root: {
    background: theme.palette.grey[300],
    '&$expanded': {
      // overrides the subclass e.g. .MuiExpansionPanelSummary-root-311.MuiExpansionPanelSummary-expanded-312
      minHeight: 0,
      margin: 0,
    },
    margin: 0,
    minHeight: 0,
    padding: '0 8px',
  },
  expanded: {},
})

export const Category = withStyles(categoryStyles)(
  observer(props => {
    const { model, path, filterPredicate, disabled, classes } = props
    const pathName = path.join('|')
    const name = path[path.length - 1]

    return (
      <ExpansionPanel
        style={{ marginTop: '4px' }}
        expanded={!model.collapsed.get(pathName)}
        onChange={() => model.toggleCategory(pathName)}
      >
        <ExpansionPanelSummary
          classes={{
            root: classes.root,
            expanded: classes.expanded,
            content: classes.content,
          }}
          expandIcon={<Icon>expand_more</Icon>}
        >
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

const trackEntryStyles = theme => ({
  formControlLabel: {
    marginLeft: 0,
    '&:hover': {
      textDecoration: 'none',
      backgroundColor: fade(
        theme.palette.text.primary,
        theme.palette.action.hoverOpacity,
      ),
      // Reset on touch devices, it doesn't add specificity
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
    flexGrow: 1,
  },
  checkbox: {
    padding: 0,
  },
  track: {
    display: 'flex',
    flexDirection: 'row',
  },
  configureButton: {
    padding: 2,
  },
})

export const TrackEntry = withStyles(trackEntryStyles)(
  observer(props => {
    const { model, trackConf, refSeqName, classes } = props
    let { disabled } = props
    const rootModel = getRoot(model)
    let titleText
    if (refSeqName)
      if (readConfObject(trackConf, 'type') !== 'ReferenceSequence') {
        titleText =
          'This assembly sequence configuration does not support displaying a reference sequence track'
        disabled = true
      } else titleText = 'The reference sequence'
    else titleText = readConfObject(trackConf, 'description')
    return (
      <Fade in>
        <div className={classes.track}>
          <Tooltip title={titleText} placement="left" enterDelay={500}>
            <FormControlLabel
              className={classes.formControlLabel}
              control={<Checkbox className={classes.checkbox} />}
              label={
                refSeqName
                  ? `Reference Sequence (${refSeqName})`
                  : readConfObject(trackConf, 'name')
              }
              checked={model.view.tracks.some(
                t => t.configuration === trackConf,
              )}
              onChange={() => model.view.toggleTrack(trackConf)}
              disabled={disabled}
            />
          </Tooltip>
          <IconButton
            className={classes.configureButton}
            onClick={() => rootModel.editConfiguration(trackConf)}
          >
            <Icon fontSize="small">settings</Icon>
          </IconButton>
        </div>
      </Fade>
    )
  }),
)

const contentsStyles = theme => ({
  divider: {
    marginTop: theme.spacing.unit * 2,
    marginBottom: theme.spacing.unit * 2,
  },
})

class ContentsInner extends React.Component {
  static propTypes = {
    model: MobxPropTypes.observableObject.isRequired,
    path: propTypes.arrayOf(propTypes.string),
    filterPredicate: propTypes.func,
    disabled: propTypes.bool,
    classes: propTypes.objectOf(propTypes.string).isRequired,
    top: propTypes.bool,
  }

  static defaultProps = {
    filterPredicate: () => true,
    path: [],
    disabled: false,
    top: false,
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
    const { model, path, filterPredicate, disabled, top, classes } = this.props
    const rootModel = getRoot(model)
    return (
      <>
        {top && rootModel.configuration.assemblies.size ? (
          <>
            <FormGroup>
              {Array.from(
                rootModel.configuration.assemblies,
                ([assemblyName, assembly]) => (
                  <TrackEntry
                    key={assembly.sequence.configId}
                    model={model}
                    trackConf={assembly.sequence}
                    refSeqName={assemblyName}
                  />
                ),
              )}
            </FormGroup>
            <Divider className={classes.divider} />
          </>
        ) : null}
        <FormGroup>
          {trackConfigurations.filter(filterPredicate).map(trackConf => (
            <TrackEntry
              key={trackConf.configId}
              model={model}
              trackConf={trackConf}
              disabled={disabled}
            />
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

const Contents = withStyles(contentsStyles)(observer(ContentsInner))
export default Contents

import CircularProgress from '@material-ui/core/CircularProgress'
import Divider from '@material-ui/core/Divider'
import FormGroup from '@material-ui/core/FormGroup'
import { withStyles } from '@material-ui/core/styles'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { observer } from 'mobx-react-lite'
import { getRoot } from 'mobx-state-tree'
import propTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import { cancelIdleCallback, requestIdleCallback } from 'request-idle-callback'
import Category from './Category'
import TrackEntry from './TrackEntry'

const styles = theme => ({
  divider: {
    marginTop: theme.spacing.unit * 2,
    marginBottom: theme.spacing.unit * 2,
  },
})

function Contents(props) {
  const [categories, setCategories] = useState([])
  const [trackConfigurations, setTrackConfigurations] = useState([])

  const {
    model,
    path,
    filterPredicate,
    disabled,
    connection,
    top,
    classes,
  } = props

  let hierarchy = connection
    ? model.volatileHierarchy(connection)
    : model.hierarchy

  path.forEach(pathEntry => {
    hierarchy = hierarchy.get(pathEntry) || new Map()
  })

  function loadMoreTracks() {
    const numLoaded = categories.length + trackConfigurations.length
    const loadedTrackConfigurations = []
    const loadedCategories = []
    Array.from(hierarchy)
      .slice(numLoaded, numLoaded + 10)
      .forEach(([name, contents]) => {
        if (contents.configId) {
          loadedTrackConfigurations.push(contents)
        } else {
          loadedCategories.push([name, contents])
        }
      })
    setCategories(categories.concat(loadedCategories))
    setTrackConfigurations(
      trackConfigurations.concat(loadedTrackConfigurations),
    )
  }

  useEffect(
    () => {
      const handle = requestIdleCallback(loadMoreTracks)

      return function cleanup() {
        cancelIdleCallback(handle)
      }
    },
    [hierarchy.size, categories.length, trackConfigurations.length],
  )

  const rootModel = getRoot(model)
  const doneLoading =
    categories.length + trackConfigurations.length === hierarchy.size
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
                  assemblyName={assemblyName}
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
          connection={connection}
        />
      ))}
    </>
  )
}

Contents.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
  path: propTypes.arrayOf(propTypes.string),
  filterPredicate: propTypes.func,
  disabled: propTypes.bool,
  connection: propTypes.string,
  classes: propTypes.objectOf(propTypes.string).isRequired,
  top: propTypes.bool,
}

Contents.defaultProps = {
  filterPredicate: () => true,
  path: [],
  disabled: false,
  connection: '',
  top: false,
}

export default withStyles(styles)(observer(Contents))

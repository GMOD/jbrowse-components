import { getSession } from '@gmod/jbrowse-core/util'
import { getConf } from '@gmod/jbrowse-core/configuration'
import CircularProgress from '@material-ui/core/CircularProgress'
import Divider from '@material-ui/core/Divider'
import FormGroup from '@material-ui/core/FormGroup'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import propTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import Category from './Category'
import TrackEntry from './TrackEntry'

const useStyles = makeStyles(theme => ({
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}))

function Contents({
  model,
  path,
  filterPredicate,
  disabled,
  connection,
  top,
  assemblyName,
}) {
  const classes = useStyles()

  let hierarchy = connection
    ? model.connectionHierarchy(connection, assemblyName)
    : model.hierarchy(assemblyName)

  path.forEach(pathEntry => {
    hierarchy = hierarchy.get(pathEntry) || new Map()
  })

  const initialTrackConfigurations = []
  const initialCategories = []
  Array.from(hierarchy)
    .slice(0, 50)
    .forEach(([name, contents]) => {
      if (contents.trackId) {
        initialTrackConfigurations.push(contents)
      } else {
        initialCategories.push([name, contents])
      }
    })
  const [categories, setCategories] = useState(initialCategories)
  const [trackConfigurations, setTrackConfigurations] = useState(
    initialTrackConfigurations,
  )

  useEffect(() => {
    function loadMoreTracks() {
      const numLoaded = categories.length + trackConfigurations.length
      const loadedTrackConfigurations = []
      const loadedCategories = []
      Array.from(hierarchy)
        .slice(numLoaded, numLoaded + 10)
        .forEach(([name, contents]) => {
          if (contents.trackId) {
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

    const handle = requestIdleCallback(loadMoreTracks)

    return function cleanup() {
      cancelIdleCallback(handle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hierarchy.size, categories.length, trackConfigurations.length])

  const { assemblyManager } = getSession(model)
  const assembly = assemblyManager.get(assemblyName)
  const doneLoading =
    categories.length + trackConfigurations.length === hierarchy.size

  const showRefSeqTrack =
    top &&
    !connection &&
    assembly &&
    assembly.configuration.sequence &&
    model.view.type === getConf(assembly, ['sequence', 'viewType'])

  return (
    <>
      {showRefSeqTrack ? (
        <>
          <FormGroup>
            <TrackEntry
              model={model}
              trackConf={assembly.configuration.sequence}
              assemblyName={assemblyName}
            />
          </FormGroup>
          <Divider className={classes.divider} />
        </>
      ) : null}
      <FormGroup>
        {trackConfigurations.filter(filterPredicate).map(trackConf => {
          return (
            <TrackEntry
              key={trackConf.trackId}
              model={model}
              trackConf={trackConf}
              disabled={disabled}
            />
          )
        })}
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
          assemblyName={assemblyName}
        />
      ))}
    </>
  )
}

Contents.propTypes = {
  assemblyName: propTypes.string,
  model: MobxPropTypes.observableObject.isRequired,
  path: propTypes.arrayOf(propTypes.string),
  filterPredicate: propTypes.func,
  disabled: propTypes.bool,
  connection: MobxPropTypes.observableObject,
  top: propTypes.bool,
}

Contents.defaultProps = {
  assemblyName: undefined,
  filterPredicate: () => true,
  path: [],
  disabled: false,
  connection: undefined,
  top: false,
}

export default observer(Contents)

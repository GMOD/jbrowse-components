import { getSession } from '@gmod/jbrowse-core/util'
import CircularProgress from '@material-ui/core/CircularProgress'
import Divider from '@material-ui/core/Divider'
import FormGroup from '@material-ui/core/FormGroup'
import { withStyles } from '@material-ui/core/styles'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { observer } from 'mobx-react-lite'
import propTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
// eslint-disable-next-line import/no-cycle
import Category from './Category'
import TrackEntry from './TrackEntry'

const styles = theme => ({
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
})

function Contents(props) {
  const {
    model,
    path,
    filterPredicate,
    disabled,
    connection,
    top,
    classes,
    assemblyName,
  } = props

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
      if (contents.configId) {
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

    const handle = requestIdleCallback(loadMoreTracks)

    return function cleanup() {
      cancelIdleCallback(handle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hierarchy.size, categories.length, trackConfigurations.length])

  const session = getSession(model)
  const { assemblyManager } = session
  const assemblyData = assemblyManager.assemblyData.get(assemblyName)
  const doneLoading =
    categories.length + trackConfigurations.length === hierarchy.size
  return (
    <>
      {top && assemblyData && !connection ? (
        <>
          <FormGroup>
            <TrackEntry
              model={model}
              trackConf={assemblyData.sequence}
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
              key={trackConf.configId}
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
  connection: propTypes.string,
  classes: propTypes.objectOf(propTypes.string).isRequired,
  top: propTypes.bool,
}

Contents.defaultProps = {
  assemblyName: undefined,
  filterPredicate: () => true,
  path: [],
  disabled: false,
  connection: '',
  top: false,
}

export default withStyles(styles)(observer(Contents))

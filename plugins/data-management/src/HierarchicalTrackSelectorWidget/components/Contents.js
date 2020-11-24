import Divider from '@material-ui/core/Divider'
import FormGroup from '@material-ui/core/FormGroup'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import propTypes from 'prop-types'
import React from 'react'
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

  const trackConfigurations = []
  const categories = []
  Array.from(hierarchy)
    .slice(0)
    .forEach(([name, contents]) => {
      if (contents.trackId) {
        trackConfigurations.push(contents)
      } else {
        categories.push([name, contents])
      }
    })

  const refSeqTrackConf = model.getRefSeqTrackConf(assemblyName)
  const showRefSeqTrack = top && !connection && refSeqTrackConf

  return (
    <>
      {showRefSeqTrack ? (
        <>
          <FormGroup>
            <TrackEntry
              model={model}
              trackConf={refSeqTrackConf}
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
      {categories.sort().map(([name]) => (
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

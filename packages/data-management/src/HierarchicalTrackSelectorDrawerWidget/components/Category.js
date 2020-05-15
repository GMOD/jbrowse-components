import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import propTypes from 'prop-types'
import React from 'react'
import ExpandIcon from '@material-ui/icons/ExpandMore'
import Contents from './Contents'

const useStyles = makeStyles(theme => ({
  expansionPanelDetails: {
    display: 'block',
    padding: theme.spacing(1),
  },
  expandIcon: {
    color: '#FFFFFF',
  },
}))

function Category({
  model,
  path,
  filterPredicate,
  disabled,
  connection,
  assemblyName,
}) {
  const classes = useStyles()
  const pathName = path.join('|')
  const name = path[path.length - 1]

  const allTracks = model.allTracksInCategoryPath(
    path,
    connection,
    assemblyName,
  )

  const count = Object.keys(allTracks).length
  const filteredCount = Object.values(allTracks).filter(filterPredicate).length

  // don't categories that have all of their members filtered out
  if (filteredCount === 0 && count !== 0) return null

  return (
    <ExpansionPanel
      style={{ marginTop: '4px' }}
      expanded={!model.collapsed.get(pathName)}
      onChange={() => model.toggleCategory(pathName)}
    >
      <ExpansionPanelSummary
        expandIcon={<ExpandIcon className={classes.expandIcon} />}
      >
        <Typography variant="body2">{`${name}${
          filteredCount ? ` (${filteredCount})` : ''
        }`}</Typography>
      </ExpansionPanelSummary>
      <ExpansionPanelDetails className={classes.expansionPanelDetails}>
        <Contents
          model={model}
          path={path}
          filterPredicate={filterPredicate}
          disabled={disabled}
          connection={connection}
          assemblyName={assemblyName}
        />
      </ExpansionPanelDetails>
    </ExpansionPanel>
  )
}

Category.propTypes = {
  assemblyName: propTypes.string,
  model: MobxPropTypes.observableObject.isRequired,
  path: propTypes.arrayOf(propTypes.string),
  filterPredicate: propTypes.func,
  disabled: propTypes.bool,
  connection: MobxPropTypes.observableObject,
}

Category.defaultProps = {
  assemblyName: undefined,
  filterPredicate: () => true,
  path: [],
  disabled: false,
  connection: undefined,
}

export default observer(Category)

import { makeStyles } from '@material-ui/core'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import Icon from '@material-ui/core/Icon'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import propTypes from 'prop-types'
import React from 'react'
// eslint-disable-next-line import/no-cycle
import Contents from './Contents'

const useStyles = makeStyles(theme => ({
  expansionPanelDetails: {
    display: 'block',
    padding: theme.spacing(1),
  },
  content: {
    '&$expanded': {
      margin: theme.spacing(1, 0),
    },
    margin: theme.spacing(1, 0),
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
    padding: theme.spacing(0, 1),
  },
  expanded: {
    // empty block needed to keep small
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
          Object.keys(
            model.allTracksInCategoryPath(path, connection, assemblyName),
          ).length
        })`}</Typography>
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

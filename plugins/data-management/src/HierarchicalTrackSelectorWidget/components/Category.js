import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
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
  accordionBorder: {
    marginTop: 4,
    border: '1px solid #444',
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
    <Accordion
      className={classes.accordionBorder}
      expanded={!model.collapsed.get(pathName)}
      onChange={() => model.toggleCategory(pathName)}
    >
      <AccordionSummary
        expandIcon={<ExpandIcon className={classes.expandIcon} />}
      >
        <Typography variant="body2">{`${name}${
          filteredCount ? ` (${filteredCount})` : ''
        }`}</Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.expansionPanelDetails}>
        <Contents
          model={model}
          path={path}
          filterPredicate={filterPredicate}
          disabled={disabled}
          connection={connection}
          assemblyName={assemblyName}
        />
      </AccordionDetails>
    </Accordion>
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

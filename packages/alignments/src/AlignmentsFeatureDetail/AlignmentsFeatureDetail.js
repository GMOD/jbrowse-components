import Paper from '@material-ui/core/Paper'
import { withStyles } from '@material-ui/styles'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

const styles = theme => ({
  root: {
    margin: theme.spacing(1),
    marginTop: theme.spacing(3),
  },
  table: {
    tableLayout: 'fixed',
    width: '100%',
  },
  valueCell: {
    wordWrap: 'break-word',
  },
})

function AlignmentsFeatureDetails(props) {
  const { model, classes } = props
  return (
    <Paper className={classes.root}>
      <Table className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>Data</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.keys(model.featureData).map(key => (
            <TableRow key={key}>
              <TableCell component="th" scope="row">
                {key}
              </TableCell>
              <TableCell className={classes.valueCell}>
                {String(model.featureData[key])}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  )
}

AlignmentsFeatureDetails.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
}

export default withStyles(styles)(observer(AlignmentsFeatureDetails))

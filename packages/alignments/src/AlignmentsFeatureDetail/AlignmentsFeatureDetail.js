import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import Divider from '@material-ui/core/Divider'
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

const coreRenderedDetails = [
  'Position',
  'Description',
  'Name',
  'Length',
  'Type',
]

const AlignmentCard = props => {
  const { children, classes, title } = props
  return (
    <Card>
      <CardHeader
        classes={{ root: classes.header, title: classes.title }}
        title={title}
      />

      <CardContent>{children}</CardContent>
    </Card>
  )
}

AlignmentCard.propTypes = {
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
  children: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
}

const AlignmentCoreDetails = props => {
  const { feature, classes } = props
  const { refName, start, end } = feature
  feature.length = end - start
  feature.position = `${refName}:${start + 1}..${end}`
  return (
    <AlignmentCard {...props} title="Primary data">
      {coreRenderedDetails.map(key => {
        const value = feature[key.toLowerCase()]
        return (
          value && (
            <div className={classes.fieldRow} key={key}>
              <div className={classes.fieldName}>{key}</div>
              <div className={classes.fieldValue}>{String(value)}</div>
            </div>
          )
        )
      })}
    </AlignmentCard>
  )
}

AlignmentCoreDetails.propTypes = {
  feature: PropTypes.shape().isRequired,
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
}

const tap = (value, fn) => {
  fn(value)
  return value
}

const inspect = val => tap(val, console.log)
const omit = ['id', 'name', 'start', 'end', 'strand']
const AlignmentAttributes = props => {
  const { feature, classes } = props
  return (
    <AlignmentCard {...props} title="Attributes">
      {Object.entries(feature)
        .filter(([k, v]) => v !== undefined && !omit.includes(k))
        .map(([key, value]) => (
          <div className={classes.fieldRow} key={key}>
            <div className={classes.fieldName}>{key}</div>
            <div className={classes.fieldValue}>{String(feature[key])}</div>
          </div>
        ))}
    </AlignmentCard>
  )
}

AlignmentAttributes.propTypes = {
  feature: PropTypes.shape().isRequired,
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
}

function AlignmentFeatureDetails(props) {
  const { classes, model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper className={classes.root} data-testid="alignment-side-drawer">
      <AlignmentCoreDetails feature={feat} {...props} />
      <Divider />
      <AlignmentAttributes feature={feat} {...props} />
    </Paper>
  )
}

AlignmentFeatureDetails.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
}


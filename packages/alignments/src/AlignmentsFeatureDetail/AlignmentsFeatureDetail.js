import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import { withStyles } from '@material-ui/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

const styles = theme => ({
  table: {
    padding: 0,
  },
  fieldName: {
    display: 'inline-block',
    minWidth: '90px',
    fontSize: '0.9em',
    borderBottom: '1px solid #0003',
    backgroundColor: '#ddd',
    marginRight: theme.spacing(1),
    padding: theme.spacing(0.5),
  },
  fieldValue: {
    display: 'inline-block',
    wordBreak: 'break-word',
    fontSize: '0.8em',
    maxHeight: 300,
    overflow: 'auto',
  },
  header: {
    padding: theme.spacing(0.5),
    backgroundColor: '#ddd',
  },
  title: {
    fontSize: '1em',
  },

  valbox: {
    border: '1px solid #bbb',
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

const omit = [
  'id',
  'name',
  'start',
  'end',
  'strand',
  'refName',
  'type',
  'length',
  'position',
]
const AlignmentAttributes = props => {
  const { feature, classes } = props
  return (
    <AlignmentCard {...props} title="Attributes">
      {Object.entries(feature)
        .filter(
          ([k, v]) =>
            v !== undefined && !omit.includes(k) && !flags.includes(k),
        )
        .map(([key, value]) => (
          <div className={classes.fieldRow} key={key}>
            <div className={classes.fieldName}>{key}</div>
            <div className={classes.fieldValue}>{String(value)}</div>
          </div>
        ))}
    </AlignmentCard>
  )
}
const flags = [
  'unmapped',
  'qc_failed',
  'duplicate',
  'secondary_alignment',
  'supplementary_alignment',
]
const AlignmentFlags = props => {
  const { feature, classes } = props
  return (
    <AlignmentCard {...props} title="Flags">
      {flags.map(key => (
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
      <Divider />
      <AlignmentFlags feature={feat} {...props} />
    </Paper>
  )
}

AlignmentFeatureDetails.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
}


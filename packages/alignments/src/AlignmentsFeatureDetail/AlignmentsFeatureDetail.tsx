/* eslint-disable react/prop-types */
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import {
  withStyles,
  createStyles,
  Theme,
  WithStyles,
} from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { FunctionComponent } from 'react'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const styles = (theme: Theme) =>
  createStyles({
    root: {},
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
      padding: 0.5 * theme.spacing(1),
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

interface AlnCardProps extends WithStyles<typeof styles> {
  title: string
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const AlignmentCard: FunctionComponent<AlnCardProps> = props => {
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
interface AlnProps extends AlnCardProps {
  feature: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const AlignmentCoreDetails: FunctionComponent<AlnProps> = props => {
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
            <div key={key}>
              <div className={classes.fieldName}>{key}</div>
              <div className={classes.fieldValue}>{String(value)}</div>
            </div>
          )
        )
      })}
    </AlignmentCard>
  )
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const AlignmentAttributes: FunctionComponent<AlnProps> = props => {
  const { feature, classes } = props
  return (
    <AlignmentCard {...props} title="Attributes">
      {Object.entries(feature)
        .filter(
          ([k, v]) =>
            v !== undefined && !omit.includes(k) && !flags.includes(k),
        )
        .map(([key, value]) => (
          <div key={key}>
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const AlignmentFlags: FunctionComponent<AlnProps> = props => {
  const { feature, classes } = props
  return (
    <AlignmentCard {...props} title="Flags">
      {flags.map(key => (
        <div key={key}>
          <div className={classes.fieldName}>{key}</div>
          <div className={classes.fieldValue}>{String(feature[key])}</div>
        </div>
      ))}
    </AlignmentCard>
  )
}

interface AlnInputProps extends AlnCardProps {
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const AlignmentFeatureDetails: FunctionComponent<AlnInputProps> = props => {
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

export default withStyles(styles)(observer(AlignmentFeatureDetails))

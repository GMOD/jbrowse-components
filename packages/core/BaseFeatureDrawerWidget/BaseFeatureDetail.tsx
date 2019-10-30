/* eslint-disable react/prop-types */
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import { makeStyles, Theme } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { FunctionComponent } from 'react'

const useStyles = makeStyles((theme: Theme) => ({
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
}))

const coreRenderedDetails = [
  'Position',
  'Description',
  'Name',
  'Length',
  'Type',
]

interface BaseCardProps {
  title: string
}

const BaseCard: FunctionComponent<BaseCardProps> = props => {
  const classes = useStyles()
  const { children, title } = props
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
interface BaseProps extends BaseCardProps {
  feature: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

const BaseCoreDetails: FunctionComponent<BaseProps> = (props): JSX.Element => {
  const classes = useStyles()
  const { feature } = props
  const { refName, start, end } = feature
  feature.length = end - start
  feature.position = `${refName}:${start + 1}..${end}`
  return (
    <BaseCard {...props} title="Primary data">
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
    </BaseCard>
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

const BaseAttributes: FunctionComponent<BaseProps> = (props): JSX.Element => {
  const classes = useStyles()
  const { feature } = props
  return (
    <BaseCard {...props} title="Attributes">
      {Object.entries(feature)
        .filter(([k, v]) => v !== undefined && !omit.includes(k))
        .map(([key, value]) => (
          <div key={key}>
            <div className={classes.fieldName}>{key}</div>
            <div className={classes.fieldValue}>{String(value)}</div>
          </div>
        ))}
    </BaseCard>
  )
}

interface BaseInputProps extends BaseCardProps {
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const BaseFeatureDetails: FunctionComponent<BaseInputProps> = props => {
  const classes = useStyles()
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper className={classes.root} data-testid="alignment-side-drawer">
      <BaseCoreDetails feature={feat} {...props} />
      <Divider />
      <BaseAttributes feature={feat} {...props} />
    </Paper>
  )
}

export default observer(BaseFeatureDetails)

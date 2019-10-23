/* eslint-disable react/prop-types */
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { FunctionComponent } from 'react'
import BaseFeatureDetails, {
  BaseCard,
} from '@gmod/jbrowse-core/BaseFeatureDrawerWidget/BaseFeatureDetail'

const useStyles = makeStyles(theme => ({
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
interface AlnCardProps {
  title: string
}

interface AlnProps extends AlnCardProps {
  feature: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

const flags = [
  'unmapped',
  'qc_failed',
  'duplicate',
  'secondary_alignment',
  'supplementary_alignment',
]

const AlignmentFlags: FunctionComponent<AlnProps> = props => {
  const classes = useStyles()
  const { feature } = props
  return (
    <BaseCard {...props} title="Flags">
      {flags.map(key => (
        <div key={key}>
          <div className={classes.fieldName}>{key}</div>
          <div className={classes.fieldValue}>{String(feature[key])}</div>
        </div>
      ))}
    </BaseCard>
  )
}

interface AlnInputProps extends AlnCardProps {
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const AlignmentFeatureDetails: FunctionComponent<AlnInputProps> = props => {
  const classes = useStyles()
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  console.log('herere')
  return (
    <Paper className={classes.root} data-testid="alignment-side-drawer">
      <BaseFeatureDetails {...props} />
      <AlignmentFlags feature={feat} {...props} />
    </Paper>
  )
}

export default observer(AlignmentFeatureDetails)

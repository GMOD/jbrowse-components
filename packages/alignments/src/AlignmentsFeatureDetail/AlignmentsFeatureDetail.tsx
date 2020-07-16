import Paper from '@material-ui/core/Paper'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { FunctionComponent } from 'react'
import {
  BaseFeatureDetails,
  BaseCard,
  useStyles,
} from '@gmod/jbrowse-core/BaseFeatureWidget/BaseFeatureDetail'
import { Typography } from '@material-ui/core'

interface AlnCardProps {
  title: string
}

interface AlnProps extends Partial<AlnCardProps> {
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
          <Typography variant="body2" className={classes.fieldName}>
            {key}
          </Typography>
          <Typography className={classes.fieldValue}>
            {String(feature[key])}
          </Typography>
        </div>
      ))}
    </BaseCard>
  )
}
AlignmentFlags.propTypes = {
  feature: PropTypes.objectOf(PropTypes.any).isRequired,
}

interface AlnInputProps extends Partial<AlnCardProps> {
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const AlignmentFeatureDetails: FunctionComponent<AlnInputProps> = props => {
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper data-testid="alignment-side-drawer">
      <BaseFeatureDetails {...props} />
      <AlignmentFlags feature={feat} />
    </Paper>
  )
}
AlignmentFeatureDetails.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(AlignmentFeatureDetails)

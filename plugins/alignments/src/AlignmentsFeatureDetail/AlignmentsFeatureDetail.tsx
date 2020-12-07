import Paper from '@material-ui/core/Paper'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { FunctionComponent } from 'react'
import {
  BaseFeatureDetails,
  BaseCard,
  useStyles,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'

interface AlnCardProps {
  title?: string
}

interface AlnProps extends AlnCardProps {
  feature: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

const globalOmit = ['clipPos']

const AlignmentFlags: FunctionComponent<AlnProps> = props => {
  const classes = useStyles()
  const { feature } = props
  const flagNames = [
    'read paired',
    'read mapped in proper pair',
    'read unmapped',
    'mate unmapped',
    'read reverse strand',
    'mate reverse strand',
    'first in pair',
    'second in pair',
    'not primary alignment',
    'read fails platform/vendor quality checks',
    'read is PCR or optical duplicate',
    'supplementary alignment',
  ]
  const { flags } = feature
  return (
    <BaseCard {...props} title="Flags">
      <div style={{ display: 'flex' }}>
        <div className={classes.fieldName}>Flag</div>
        <div className={classes.fieldValue}>{flags}</div>
      </div>
      {flagNames.map((name, index) => {
        // eslint-disable-next-line no-bitwise
        const val = flags & (1 << index)
        const key = `${name}_${val}`
        return (
          <div key={key}>
            <input type="checkbox" checked={Boolean(val)} id={key} readOnly />
            <label htmlFor={key}>{name}</label>
          </div>
        )
      })}
    </BaseCard>
  )
}
AlignmentFlags.propTypes = {
  feature: PropTypes.objectOf(PropTypes.any).isRequired,
}

interface AlnInputProps {
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const AlignmentFeatureDetails: FunctionComponent<AlnInputProps> = props => {
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper data-testid="alignment-side-drawer">
      <BaseFeatureDetails {...props} omit={globalOmit} />
      <AlignmentFlags feature={feat} {...props} />
    </Paper>
  )
}
AlignmentFeatureDetails.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(AlignmentFeatureDetails)

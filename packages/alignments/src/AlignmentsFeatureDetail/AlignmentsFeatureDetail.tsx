import Paper from '@material-ui/core/Paper'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useState, FunctionComponent } from 'react'
import copy from 'copy-to-clipboard'
import {
  BaseFeatureDetails,
  BaseCard,
  useStyles,
} from '@gmod/jbrowse-core/BaseFeatureDrawerWidget/BaseFeatureDetail'

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
AlignmentFlags.propTypes = {
  feature: PropTypes.objectOf(PropTypes.any).isRequired,
}

interface AlnInputProps extends AlnCardProps {
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

function Formatter({ value }: { value: string }) {
  const [show, setShow] = useState(false)
  if (String(value).length > 100) {
    return (
      <>
        <button type="button" onClick={() => copy(value)}>
          Copy
        </button>
        <button type="button" onClick={() => setShow(val => !val)}>
          {show ? 'Show less' : 'Show more'}
        </button>
        <div>{show ? value : `${value.slice(0, 100)}...`}</div>
      </>
    )
  }
  return <div>{value}</div>
}

const AlignmentFeatureDetails: FunctionComponent<AlnInputProps> = props => {
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper data-testid="alignment-side-drawer">
      <BaseFeatureDetails
        {...props}
        omit={flags}
        formatter={(value: string) => <Formatter value={value} />}
      />
      <AlignmentFlags feature={feat} {...props} />
    </Paper>
  )
}
AlignmentFeatureDetails.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(AlignmentFeatureDetails)

/* eslint-disable react/prop-types */
import Paper from '@material-ui/core/Paper'
import { observer } from 'mobx-react'
import React, { FunctionComponent } from 'react'
import {
  BaseCoreDetails,
  BaseAttributes,
} from '@gmod/jbrowse-core/BaseFeatureDrawerWidget/BaseFeatureDetail'

interface AlnCardProps {
  title: string
}

interface AlnProps extends AlnCardProps {
  feature: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface AlnInputProps extends AlnCardProps {
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const AlignmentFeatureDetails: FunctionComponent<AlnInputProps> = props => {
  const { model } = props
  const { feature1, feature2 } = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper data-testid="alignment-side-drawer">
      <BaseCoreDetails title="Feature 1" feature={feature1} />
      <BaseCoreDetails title="Feature 2" feature={feature2} />
      <BaseAttributes title="Feature 1 attributes" feature={feature1} />
      <BaseAttributes title="Feature 2 attributes" feature={feature2} />
    </Paper>
  )
}

export default observer(AlignmentFeatureDetails)

import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import AlignmentsFeatureDetails from '../AlignmentsFeatureDetail/AlignmentsFeatureDetail.tsx'

import type { AlignmentFeatureWidgetModel } from '../AlignmentsFeatureDetail/stateModelFactory.ts'
import type { BreakpointAlignmentsWidgetModel } from './stateModelFactory.ts'

const ReadDetails = observer(function ReadDetails({
  title,
  read,
}: {
  title: string
  read: AlignmentFeatureWidgetModel
}) {
  return (
    <>
      <Typography variant="overline" component="h2" sx={{ px: 1 }}>
        {title}
      </Typography>
      <AlignmentsFeatureDetails model={read} />
    </>
  )
})

const BreakpointAlignmentsFeatureDetail = observer(
  function BreakpointAlignmentsFeatureDetail({
    model,
  }: {
    model: BreakpointAlignmentsWidgetModel
  }) {
    return (
      <>
        <ReadDetails title="Alignment 1" read={model.read1} />
        <ReadDetails title="Alignment 2" read={model.read2} />
      </>
    )
  },
)

export default BreakpointAlignmentsFeatureDetail

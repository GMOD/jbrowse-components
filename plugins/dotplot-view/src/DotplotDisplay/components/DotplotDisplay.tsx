import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../../DotplotView/model.ts'
import type { DotplotDisplayModel } from '../stateModelFactory.tsx'

const DotplotDisplay = observer(function DotplotDisplay({
  model,
}: {
  model: DotplotDisplayModel
}) {
  const view = getContainingView(model) as DotplotViewModel
  const { viewWidth, viewHeight } = view

  if (model.error) {
    return <ErrorMessage error={model.error} />
  }

  return (
    <>
      <DotplotLoadingIndicator
        model={model}
        width={viewWidth}
        height={viewHeight}
      />
      <DotplotRefetchingIndicator model={model} />
    </>
  )
})

const DotplotLoadingIndicator = observer(function DotplotLoadingIndicator({
  model,
  width,
  height,
}: {
  model: Pick<DotplotDisplayModel, 'isLoading'>
  width: number
  height: number
}) {
  return model.isLoading ? (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LoadingEllipses />
    </div>
  ) : null
})

const DotplotRefetchingIndicator = observer(
  function DotplotRefetchingIndicator({
    model,
  }: {
    model: Pick<DotplotDisplayModel, 'isRefetching'>
  }) {
    return model.isRefetching ? (
      <div style={{ position: 'absolute', bottom: 4, right: 4, opacity: 0.7 }}>
        <LoadingEllipses />
      </div>
    ) : null
  },
)

export default DotplotDisplay

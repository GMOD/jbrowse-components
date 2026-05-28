import { Suspense, lazy, useRef, useState } from 'react'

import { observer } from 'mobx-react'

import SequenceFeatureMenu from './dialogs/SequenceFeatureMenu.tsx'
import SequenceTypeSelector from './dialogs/SequenceTypeSelector.tsx'
import { LoadingEllipses } from '../../ui/index.ts'
import { getSession } from '../../util/index.ts'
import { useFeatureSequence } from '../../util/useFeatureSequence.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { BaseFeatureWidgetModel } from '../stateModelFactory.ts'

// lazies
const SequenceBody = lazy(() => import('./SequenceBody.tsx'))
const SequenceDialog = lazy(() => import('./dialogs/SequenceDialog.tsx'))

const SequenceFeatureDetails = observer(function SequenceFeatureDetails({
  model,
  feature,
}: {
  model: BaseFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const { sequenceFeatureDetails } = model
  const { upDownBp } = sequenceFeatureDetails
  const seqPanelRef = useRef<HTMLDivElement>(null)

  const [openInDialog, setOpenInDialog] = useState(false)
  const [forceLoad, setForceLoad] = useState(false)
  const session = getSession(model)
  const assemblyName = model.view?.assemblyNames?.[0]
  const { sequence, error } = useFeatureSequence({
    assemblyName,
    session,
    start: feature.start,
    end: feature.end,
    refName: feature.refName,
    upDownBp,
    forceLoad,
  })

  return (
    <>
      <div>
        <SequenceTypeSelector model={sequenceFeatureDetails} />
        <SequenceFeatureMenu
          ref={seqPanelRef}
          model={sequenceFeatureDetails}
          extraItems={[
            {
              label: 'Open in dialog',
              onClick: () => {
                setOpenInDialog(true)
              },
            },
          ]}
        />
      </div>
      {openInDialog ? (
        <Suspense fallback={<LoadingEllipses />}>
          <SequenceDialog
            model={model}
            sequenceFeatureDetails={sequenceFeatureDetails}
            feature={feature}
            handleClose={() => {
              setOpenInDialog(false)
            }}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<LoadingEllipses />}>
          <SequenceBody
            error={error}
            sequence={sequence}
            feature={feature}
            seqPanelRef={seqPanelRef}
            model={sequenceFeatureDetails}
            onForceLoad={() => {
              setForceLoad(true)
            }}
          />
        </Suspense>
      )}
    </>
  )
})

export default SequenceFeatureDetails

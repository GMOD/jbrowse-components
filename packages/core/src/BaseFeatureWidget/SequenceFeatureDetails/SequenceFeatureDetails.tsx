import { Suspense, lazy, useRef, useState } from 'react'

import { observer } from 'mobx-react'

import SequenceFeatureMenu from './dialogs/SequenceFeatureMenu.tsx'
import SequenceTypeSelector from './dialogs/SequenceTypeSelector.tsx'
import { getDefaultMode } from './featureTypeUtil.ts'
import { useSequenceFetch } from './useSequenceFetch.ts'
import { LoadingEllipses } from '../../ui/index.ts'

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

  // mode is per-panel state, not on the shared model, so each subfeature panel
  // (e.g. coding vs noncoding transcripts of one gene) picks its own sequence
  // type
  const [mode, setMode] = useState(() => getDefaultMode(feature))
  const [openInDialog, setOpenInDialog] = useState(false)
  const { sequence, error, assemblyGeneticCodeId, onForceLoad } =
    useSequenceFetch({
      model,
      feature,
      upDownBp,
    })

  return (
    <>
      <div>
        <SequenceTypeSelector
          model={sequenceFeatureDetails}
          feature={feature}
          mode={mode}
          setMode={setMode}
        />
        <SequenceFeatureMenu
          ref={seqPanelRef}
          model={sequenceFeatureDetails}
          mode={mode}
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
            sequenceFeatureDetails={sequenceFeatureDetails}
            feature={feature}
            mode={mode}
            setMode={setMode}
            sequence={sequence}
            error={error}
            assemblyGeneticCodeId={assemblyGeneticCodeId}
            onForceLoad={onForceLoad}
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
            mode={mode}
            assemblyGeneticCodeId={assemblyGeneticCodeId}
            onForceLoad={onForceLoad}
          />
        </Suspense>
      )}
    </>
  )
})

export default SequenceFeatureDetails

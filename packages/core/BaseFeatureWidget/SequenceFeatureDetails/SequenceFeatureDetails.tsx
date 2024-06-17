import React, { lazy, useRef, useState, Suspense } from 'react'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

// locals
import { useFeatureSequence } from './hooks'
import { ErrorMessage, LoadingEllipses } from '../../ui'
import { SimpleFeatureSerialized, getSession } from '../../util'
import { BaseFeatureWidgetModel } from '../stateModelFactory'

// icons
import SequenceFeatureMenu from './dialogs/SequenceFeatureMenu'
import SequenceTypeSelector from './dialogs/SequenceTypeSelector'

// lazies
const SequencePanel = lazy(() => import('./SequencePanel'))
const SequenceDialog = lazy(() => import('./dialogs/SequenceDialog'))

// set the key on this component to feature.id to clear state after new feature
// is selected
const SequenceFeatureDetails = observer(function ({
  model,
  feature,
}: {
  model: BaseFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const { sequenceFeatureDetails } = model
  const { upDownBp } = sequenceFeatureDetails
  const seqPanelRef = useRef<HTMLDivElement>(null)

  const [force, setForce] = useState(false)
  const { sequence, error } = useFeatureSequence(
    model,
    feature,
    upDownBp,
    force,
  )

  return (
    <>
      <div>
        <SequenceTypeSelector
          feature={feature}
          model={sequenceFeatureDetails}
        />

        <SequenceFeatureMenu
          ref={seqPanelRef}
          model={sequenceFeatureDetails}
          extraItems={[
            {
              label: 'Open in dialog',
              onClick: () => {
                getSession(model).queueDialog(handleClose => [
                  SequenceDialog,
                  { model, feature, handleClose },
                ])
              },
            },
          ]}
        />
      </div>
      <div>
        {feature.type === 'gene' ? (
          <Typography>
            Note: inspect subfeature sequences for protein/CDS computations
          </Typography>
        ) : null}
        {error ? (
          <ErrorMessage error={error} />
        ) : !sequence ? (
          <LoadingEllipses />
        ) : sequence ? (
          'error' in sequence ? (
            <>
              <Typography color="error">{sequence.error}</Typography>
              <Button
                variant="contained"
                color="inherit"
                onClick={() => setForce(true)}
              >
                Force load
              </Button>
            </>
          ) : (
            <Suspense fallback={<LoadingEllipses />}>
              <SequencePanel
                ref={seqPanelRef}
                feature={feature}
                sequence={sequence}
                model={sequenceFeatureDetails}
              />
            </Suspense>
          )
        ) : (
          <Typography>No sequence found</Typography>
        )}
      </div>
    </>
  )
})

export default SequenceFeatureDetails

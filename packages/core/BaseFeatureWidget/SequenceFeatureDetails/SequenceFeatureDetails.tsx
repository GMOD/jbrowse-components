import React, { lazy, useRef, useState, Suspense, useEffect } from 'react'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

// locals
import { useFeatureSequence } from './hooks'
import { ErrorMessage, LoadingEllipses } from '../../ui'
import SequenceFeatureMenu from './dialogs/SequenceFeatureMenu'
import SequenceTypeSelector from './dialogs/SequenceTypeSelector'
import type { SimpleFeatureSerialized } from '../../util'
import type { BaseFeatureWidgetModel } from '../stateModelFactory'

// icons

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

  const [openInDialog, setOpenInDialog] = useState(false)
  const [force, setForce] = useState(false)
  const { sequence, error } = useFeatureSequence(
    model,
    feature,
    upDownBp,
    force,
  )
  useEffect(() => {
    sequenceFeatureDetails.setFeature(feature)
  }, [sequenceFeatureDetails, feature])

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
                // this is given a setTimeout because it allows the menu to
                // close before dialog opens
                setTimeout(() => {
                  setOpenInDialog(true)
                }, 1)
              },
            },
          ]}
        />
      </div>
      {openInDialog ? (
        <div>
          Open in dialog...
          <Suspense fallback={<LoadingEllipses />}>
            <SequenceDialog
              model={model}
              feature={feature}
              handleClose={() => {
                setOpenInDialog(false)
              }}
            />
          </Suspense>
        </div>
      ) : (
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
          ) : 'error' in sequence ? (
            <>
              <Typography color="error">{sequence.error}</Typography>
              <Button
                variant="contained"
                color="inherit"
                onClick={() => {
                  setForce(true)
                }}
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
          )}
        </div>
      )}
    </>
  )
})

export default SequenceFeatureDetails

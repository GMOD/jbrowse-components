import { Suspense, lazy, useEffect, useRef, useState } from 'react'

import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { useFeatureSequence } from './useFeatureSequence'
import { ErrorMessage, LoadingEllipses } from '../../ui'
import SequenceFeatureMenu from './dialogs/SequenceFeatureMenu'
import SequenceTypeSelector from './dialogs/SequenceTypeSelector'

import { getSession, SimpleFeature } from '../../util'

import type { SimpleFeatureSerialized } from '../../util'
import type { BaseFeatureWidgetModel } from '../stateModelFactory'

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
  const [forceLoad, setForceLoad] = useState(false)
  const session = getSession(model)
  const assemblyName = model.view?.assemblyNames?.[0]
  const { sequence, error } = useFeatureSequence({
    assemblyName,
    session,
    feature: new SimpleFeature(feature),
    upDownBp,
    forceLoad,
  })
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
                setOpenInDialog(true)
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
                  setForceLoad(true)
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

import { Button, Typography } from '@mui/material'
import SequencePanel from './SequencePanel.tsx'
import { ErrorBanner, LoadingEllipses } from '../../ui/index.ts'

import type { RefObject } from 'react'
import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { SequenceFeatureDetailsModel } from './model.ts'
import type { ErrorState, SeqState } from '../util.tsx'

export default function SequenceBody({
  error,
  sequence,
  feature,
  seqPanelRef,
  model,
  onForceLoad,
}: {
  error: unknown
  sequence: SeqState | ErrorState | undefined
  feature: SimpleFeatureSerialized
  seqPanelRef: RefObject<HTMLDivElement | null>
  model: SequenceFeatureDetailsModel
  onForceLoad: () => void
}) {
  return (
    <div>
      {feature.type === 'gene' ? (
        <Typography>
          Note: inspect subfeature sequences for protein/CDS computations
        </Typography>
      ) : null}
      {error ? (
        <ErrorBanner error={error} />
      ) : !sequence ? (
        <LoadingEllipses />
      ) : 'error' in sequence ? (
        <>
          <Typography color="error">{sequence.error}</Typography>
          <Button
            variant="contained"
            color="inherit"
            onClick={() => {
              onForceLoad()
            }}
          >
            Force load
          </Button>
        </>
      ) : (
        <SequencePanel
          ref={seqPanelRef}
          feature={feature}
          sequence={sequence}
          model={model}
        />
      )}
    </div>
  )
}

import { Button, Typography } from '@mui/material'

import { ErrorBanner, LoadingEllipses } from '../../ui/index.ts'
import SequencePanel from './SequencePanel.tsx'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { ErrorState, SeqState } from '../util.tsx'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from './model.ts'
import type { RefObject } from 'react'

export default function SequenceBody({
  error,
  sequence,
  feature,
  seqPanelRef,
  model,
  mode,
  assemblyGeneticCodeId,
  assemblyName,
  onForceLoad,
}: {
  error: unknown
  sequence: SeqState | ErrorState | undefined
  feature: SimpleFeatureSerialized
  seqPanelRef: RefObject<HTMLDivElement | null>
  model: SequenceFeatureDetailsModel
  mode: SequenceDisplayMode
  assemblyGeneticCodeId?: number
  assemblyName?: string
  onForceLoad: () => void
}) {
  return (
    <div>
      {error ? (
        <ErrorBanner error={error} />
      ) : !sequence ? (
        <LoadingEllipses />
      ) : 'error' in sequence ? (
        <>
          <Typography color="error">{sequence.error}</Typography>
          <Button
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
          mode={mode}
          assemblyGeneticCodeId={assemblyGeneticCodeId}
          assemblyName={assemblyName}
        />
      )}
    </div>
  )
}

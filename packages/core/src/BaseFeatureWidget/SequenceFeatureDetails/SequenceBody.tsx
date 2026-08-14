import { Button, Typography } from '@mui/material'

import { ErrorBanner, LoadingEllipses } from '../../ui/index.ts'
import { statusProgressLabel } from '../../util/progress.ts'
import SequencePanel from './SequencePanel.tsx'

import type { RpcStatus, SimpleFeatureSerialized } from '../../util/index.ts'
import type { ErrorState, SeqState } from '../util.tsx'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
  SequenceHoverTarget,
} from './model.ts'
import type { RefObject } from 'react'

export default function SequenceBody({
  error,
  sequence,
  status,
  feature,
  seqPanelRef,
  model,
  mode,
  revcomp,
  assemblyGeneticCodeId,
  assemblyName,
  hoverTarget,
  onForceLoad,
}: {
  error: unknown
  sequence: SeqState | ErrorState | undefined
  status?: RpcStatus
  feature: SimpleFeatureSerialized
  seqPanelRef: RefObject<HTMLDivElement | null>
  model: SequenceFeatureDetailsModel
  mode: SequenceDisplayMode
  revcomp: boolean
  assemblyGeneticCodeId?: number
  assemblyName?: string
  hoverTarget?: SequenceHoverTarget
  onForceLoad: () => void
}) {
  return (
    <div>
      {error ? (
        <ErrorBanner error={error} />
      ) : !sequence ? (
        <LoadingEllipses message={statusProgressLabel(status)} />
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
          revcomp={revcomp}
          assemblyGeneticCodeId={assemblyGeneticCodeId}
          assemblyName={assemblyName}
          hoverTarget={hoverTarget}
        />
      )}
    </div>
  )
}

import { Suspense, lazy, useRef, useState } from 'react'

import { observer } from 'mobx-react'

import { LoadingEllipses } from '../../ui/index.ts'
import { useFeatureKey } from '../BaseFeatureDetail/featureKey.ts'
import SequenceControls from './dialogs/SequenceControls.tsx'
import TranscriptSelector from './dialogs/TranscriptSelector.tsx'
import { featureHasExonOrCDS, resolveMode } from './featureTypeUtil.ts'
import { useSequenceFetch } from './useSequenceFetch.ts'

import type { MenuItem } from '../../ui/index.ts'
import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '../../util/index.ts'
import type {
  SequenceFeatureDetailsModel,
  SequenceHoverTarget,
} from './model.ts'
import type { TranscriptPick } from './useTranscriptPick.ts'

// lazies
const SequenceBody = lazy(() => import('./SequenceBody.tsx'))
const SequenceDialog = lazy(() => import('./dialogs/SequenceDialog.tsx'))

interface SequenceFeatureDetailsProps {
  model: SequenceFeatureDetailsModel
  session: AbstractSessionModel
  assemblyName: string | undefined
  feature: SimpleFeatureSerialized
  hoverTarget?: SequenceHoverTarget
  showOpenInDialog?: boolean
  transcriptPick: TranscriptPick
}

const SequenceFeatureDetailsPanel = observer(
  function SequenceFeatureDetailsPanel({
    model,
    session,
    assemblyName,
    feature,
    hoverTarget,
    showOpenInDialog = true,
    transcriptPick: pick,
  }: SequenceFeatureDetailsProps) {
    const { upDownBp } = model
    const seqPanelRef = useRef<HTMLPreElement>(null)

    // A container feature (e.g. a gene) has no CDS/exon of its own; one of its
    // transcript children does, so the panel reads the picked transcript.
    const picked = pick.transcripts[pick.index]
    const effectiveFeature =
      picked && featureHasExonOrCDS(picked) ? picked : feature

    const mode = resolveMode(model.recentModes, effectiveFeature)
    const [revcomp, setRevcomp] = useState(false)
    const [openInDialog, setOpenInDialog] = useState(false)
    const fetched = useSequenceFetch({
      session,
      assemblyName,
      feature: effectiveFeature,
      upDownBp,
    })

    const controls = (extraItems: MenuItem[]) => (
      <SequenceControls
        model={model}
        session={session}
        feature={effectiveFeature}
        mode={mode}
        revcomp={revcomp}
        setRevcomp={setRevcomp}
        seqPanelRef={seqPanelRef}
        transcriptSelector={
          pick.transcripts.length > 1 ? (
            <TranscriptSelector pick={pick} />
          ) : null
        }
        extraItems={extraItems}
      />
    )
    const body = (
      <Suspense fallback={<LoadingEllipses />}>
        <SequenceBody
          {...fetched}
          feature={effectiveFeature}
          seqPanelRef={seqPanelRef}
          model={model}
          mode={mode}
          revcomp={revcomp}
          assemblyName={assemblyName}
          hoverTarget={hoverTarget}
        />
      </Suspense>
    )

    return (
      <>
        {controls(
          showOpenInDialog
            ? [
                {
                  label: 'Open in dialog',
                  onClick: () => {
                    setOpenInDialog(true)
                  },
                },
              ]
            : [],
        )}
        {openInDialog ? (
          <Suspense fallback={<LoadingEllipses />}>
            <SequenceDialog
              feature={feature}
              handleClose={() => {
                setOpenInDialog(false)
              }}
            >
              {controls([])}
              {body}
            </SequenceDialog>
          </Suspense>
        ) : (
          body
        )}
      </>
    )
  },
)

// Takes the sequence settings model, session and assembly directly rather than
// a feature-detail widget, so anything holding a SequenceFeatureDetails model
// (the widget, a track's right-click dialog) renders the same readout. Keyed on
// the feature so revcomp and the dialog reset when the reused widget is handed
// another one.
const SequenceFeatureDetails = observer(function SequenceFeatureDetails(
  props: SequenceFeatureDetailsProps,
) {
  return (
    <SequenceFeatureDetailsPanel
      key={useFeatureKey(props.feature.uniqueId)}
      {...props}
    />
  )
})

export default SequenceFeatureDetails

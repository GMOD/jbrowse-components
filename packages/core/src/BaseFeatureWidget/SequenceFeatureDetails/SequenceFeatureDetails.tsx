import { Suspense, lazy, useRef, useState } from 'react'

import { observer } from 'mobx-react'

import { LoadingEllipses } from '../../ui/index.ts'
import { useFeatureKey } from '../BaseFeatureDetail/featureKey.ts'
import SequenceControls from './dialogs/SequenceControls.tsx'
import TranscriptSelector from './dialogs/TranscriptSelector.tsx'
import { featureHasExonOrCDS, resolveMode } from './featureTypeUtil.ts'
import { useSequenceFetch } from './useSequenceFetch.ts'
import { useTranscriptPick } from './useTranscriptPick.ts'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '../../util/index.ts'
import type { CanonicalTranscripts } from '../../util/isoformRank.ts'
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
  canonicalTranscripts?: CanonicalTranscripts
  /** a pick the caller shares with its own transcript menu */
  transcriptPick?: TranscriptPick
}

const SequenceFeatureDetailsPanel = observer(
  function SequenceFeatureDetailsPanel({
    model,
    session,
    assemblyName,
    feature,
    hoverTarget,
    showOpenInDialog = true,
    canonicalTranscripts,
    transcriptPick,
  }: SequenceFeatureDetailsProps) {
    const { upDownBp } = model
    const seqPanelRef = useRef<HTMLDivElement>(null)

    // A container feature (e.g. a gene) has no CDS/exon of its own — one of its
    // transcript children does. Default to the transcript the track draws first
    // so CDS and Protein sequence types work without an extra click into
    // Subfeatures, with a selector to switch when the gene has more than one.
    const ownPick = useTranscriptPick(feature, canonicalTranscripts)
    const pick = transcriptPick ?? ownPick
    const picked = pick.transcripts[pick.index]
    const effectiveFeature =
      picked && featureHasExonOrCDS(picked) ? picked : feature

    const mode = resolveMode(model.recentModes, effectiveFeature)
    const [revcomp, setRevcomp] = useState(false)
    const [openInDialog, setOpenInDialog] = useState(false)
    // spread into whichever readout is mounted, rather than forwarded field by
    // field: the inline body and the dialog want the same five, and listing
    // them by hand is what dropped `status` from the dialog, whose loading
    // indicator then had no progress to report
    const fetched = useSequenceFetch({
      session,
      assemblyName,
      feature: effectiveFeature,
      upDownBp,
    })

    // handed to the dialog as well, which renders the same controls: a dialog
    // without the selector strands a multi-transcript gene on whichever one was picked
    // before it opened (the inline copy is behind the modal and unclickable)
    const transcriptSelector =
      pick.transcripts.length > 1 ? <TranscriptSelector pick={pick} /> : null

    return (
      <>
        <SequenceControls
          model={model}
          session={session}
          feature={effectiveFeature}
          mode={mode}
          revcomp={revcomp}
          setRevcomp={setRevcomp}
          seqPanelRef={seqPanelRef}
          transcriptSelector={transcriptSelector}
          extraItems={
            showOpenInDialog
              ? [
                  {
                    label: 'Open in dialog',
                    onClick: () => {
                      setOpenInDialog(true)
                    },
                  },
                ]
              : []
          }
        />
        {openInDialog ? (
          <Suspense fallback={<LoadingEllipses />}>
            <SequenceDialog
              {...fetched}
              sequenceFeatureDetails={model}
              session={session}
              transcriptSelector={transcriptSelector}
              feature={effectiveFeature}
              mode={mode}
              revcomp={revcomp}
              setRevcomp={setRevcomp}
              assemblyName={assemblyName}
              hoverTarget={hoverTarget}
              handleClose={() => {
                setOpenInDialog(false)
              }}
            />
          </Suspense>
        ) : (
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
        )}
      </>
    )
  },
)

// Takes the sequence settings model, session and assembly directly rather than
// a feature-detail widget, so anything holding a SequenceFeatureDetails model
// (the widget, a track's right-click dialog) renders the same readout.
//
// The panel's transcript and revcomp are initialized from the feature, and the
// widget is reused (not remounted) when the user clicks a different feature —
// so key the panel on the feature to reinitialize them.
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

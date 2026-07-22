import { Suspense, lazy, useRef, useState } from 'react'

import { observer } from 'mobx-react'

import { LoadingEllipses } from '../../ui/index.ts'
import SequenceFeatureMenu from './dialogs/SequenceFeatureMenu.tsx'
import SequenceTypeSelector from './dialogs/SequenceTypeSelector.tsx'
import TranscriptSelector from './dialogs/TranscriptSelector.tsx'
import {
  getDefaultMode,
  getTranscripts,
  pickDefaultTranscriptIndex,
} from './featureTypeUtil.ts'
import { useSequenceFetch } from './useSequenceFetch.ts'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '../../util/index.ts'
import type { SequenceFeatureDetailsModel } from './model.ts'

// lazies
const SequenceBody = lazy(() => import('./SequenceBody.tsx'))
const SequenceDialog = lazy(() => import('./dialogs/SequenceDialog.tsx'))

// Takes the sequence settings model, session and assembly directly rather than
// a feature-detail widget, so anything holding a SequenceFeatureDetails model
// (the widget, a track's right-click dialog) renders the same readout.
const SequenceFeatureDetails = observer(function SequenceFeatureDetails({
  model,
  session,
  assemblyName,
  feature,
  showOpenInDialog = true,
}: {
  model: SequenceFeatureDetailsModel
  session: AbstractSessionModel
  assemblyName: string | undefined
  feature: SimpleFeatureSerialized
  showOpenInDialog?: boolean
}) {
  const { upDownBp } = model
  const seqPanelRef = useRef<HTMLDivElement>(null)

  // A container feature (e.g. a gene) has no CDS/exon of its own — one of its
  // transcript children does. Default to the longest-coding transcript so CDS
  // and Protein sequence types work without an extra click into Subfeatures,
  // with a selector to switch transcripts when the gene has more than one.
  const transcripts = getTranscripts(feature)
  const [transcriptIndex, setTranscriptIndex] = useState(() =>
    pickDefaultTranscriptIndex(transcripts),
  )
  const effectiveFeature = transcripts[transcriptIndex] ?? feature

  // mode and revcomp are per-panel state, not on the shared model, so each
  // subfeature panel (e.g. coding vs noncoding transcripts of one gene) picks
  // its own sequence type and strand
  const [mode, setMode] = useState(() => getDefaultMode(effectiveFeature))
  const [revcomp, setRevcomp] = useState(false)
  const [openInDialog, setOpenInDialog] = useState(false)
  const { sequence, error, assemblyGeneticCodeId, onForceLoad } =
    useSequenceFetch({
      session,
      assemblyName,
      feature: effectiveFeature,
      upDownBp,
    })

  return (
    <>
      <div>
        {transcripts.length > 1 ? (
          <TranscriptSelector
            transcripts={transcripts}
            transcriptIndex={transcriptIndex}
            setTranscriptIndex={index => {
              setTranscriptIndex(index)
              setMode(getDefaultMode(transcripts[index]!))
            }}
          />
        ) : null}
        <SequenceTypeSelector
          model={model}
          feature={effectiveFeature}
          mode={mode}
          setMode={setMode}
        />
        <SequenceFeatureMenu
          ref={seqPanelRef}
          model={model}
          mode={mode}
          revcomp={revcomp}
          setRevcomp={setRevcomp}
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
      </div>
      {openInDialog ? (
        <Suspense fallback={<LoadingEllipses />}>
          <SequenceDialog
            sequenceFeatureDetails={model}
            feature={effectiveFeature}
            mode={mode}
            setMode={setMode}
            revcomp={revcomp}
            setRevcomp={setRevcomp}
            sequence={sequence}
            error={error}
            assemblyGeneticCodeId={assemblyGeneticCodeId}
            assemblyName={assemblyName}
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
            feature={effectiveFeature}
            seqPanelRef={seqPanelRef}
            model={model}
            mode={mode}
            revcomp={revcomp}
            assemblyGeneticCodeId={assemblyGeneticCodeId}
            assemblyName={assemblyName}
            onForceLoad={onForceLoad}
          />
        </Suspense>
      )}
    </>
  )
})

export default SequenceFeatureDetails

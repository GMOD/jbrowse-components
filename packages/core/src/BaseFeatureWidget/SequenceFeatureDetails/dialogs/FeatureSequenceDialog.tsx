import { useState } from 'react'

import { observer } from 'mobx-react'

import { ErrorBanner, LoadingEllipses } from '../../../ui/index.ts'
import SequenceFeatureDetails from '../SequenceFeatureDetails.tsx'
import { SequenceFeatureDetailsF } from '../model.ts'
import { useTranscriptPick } from '../useTranscriptPick.ts'
import SequenceDialog from './SequenceDialog.tsx'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '../../../util/index.ts'
import type { CanonicalTranscripts } from '../../../util/isoformRank.ts'
import type {
  SequenceFeatureDetailsModel,
  SequenceHoverTarget,
} from '../model.ts'

const PickedSequence = observer(function PickedSequence({
  canonicalTranscripts,
  ...props
}: {
  model: SequenceFeatureDetailsModel
  session: AbstractSessionModel
  assemblyName: string | undefined
  feature: SimpleFeatureSerialized
  hoverTarget?: SequenceHoverTarget
  canonicalTranscripts?: CanonicalTranscripts
}) {
  const pick = useTranscriptPick(props.feature, canonicalTranscripts)
  return (
    <SequenceFeatureDetails
      {...props}
      showOpenInDialog={false}
      transcriptPick={pick}
    />
  )
})

// The feature sequence panel as a standalone dialog, for callers that have a
// feature but no feature-detail widget open (e.g. a track's right-click menu).
// `feature` is optional so a caller still fetching the full feature -- the
// rendered track ships only slim arrays -- can mount the dialog immediately.
// The settings model lives for as long as the dialog does: it holds no
// snapshot and reads no tree, so nothing has to carry one around on the chance
// a sequence panel is opened.
const FeatureSequenceDialog = observer(function FeatureSequenceDialog({
  feature,
  error,
  session,
  assemblyName,
  hoverTarget,
  canonicalTranscripts,
  handleClose,
}: {
  feature: SimpleFeatureSerialized | undefined
  error?: unknown
  session: AbstractSessionModel
  assemblyName: string | undefined
  hoverTarget?: SequenceHoverTarget
  canonicalTranscripts?: CanonicalTranscripts
  handleClose: () => void
}) {
  const [model] = useState(() => SequenceFeatureDetailsF().create())

  return (
    <SequenceDialog
      title={
        feature
          ? `Feature sequence - ${feature.name || feature.id || feature.type}`
          : 'Feature sequence'
      }
      handleClose={handleClose}
    >
      {error ? (
        <ErrorBanner error={error} />
      ) : feature ? (
        <PickedSequence
          model={model}
          session={session}
          assemblyName={assemblyName}
          feature={feature}
          hoverTarget={hoverTarget}
          canonicalTranscripts={canonicalTranscripts}
        />
      ) : (
        <LoadingEllipses message="Loading feature" />
      )}
    </SequenceDialog>
  )
})

export default FeatureSequenceDialog

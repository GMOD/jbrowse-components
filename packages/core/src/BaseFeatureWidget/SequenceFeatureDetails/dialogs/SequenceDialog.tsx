import { useRef } from 'react'

import { observer } from 'mobx-react'

import { InfoDialog } from '../../../ui/index.ts'
import { makeStyles } from '../../../util/tss-react/index.ts'
import SequenceBody from '../SequenceBody.tsx'
import SequenceFeatureMenu from './SequenceFeatureMenu.tsx'
import SequenceTypeSelector from './SequenceTypeSelector.tsx'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type { ErrorState, SeqState } from '../../util.tsx'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
  SequenceHoverTarget,
} from '../model.ts'

const useStyles = makeStyles()({
  content: {
    width: '80em',
  },
})

const SequenceDialog = observer(function SequenceDialog({
  handleClose,
  sequenceFeatureDetails,
  feature,
  mode,
  setMode,
  revcomp,
  setRevcomp,
  sequence,
  error,
  assemblyGeneticCodeId,
  assemblyName,
  hoverTarget,
  onForceLoad,
}: {
  handleClose: () => void
  feature: SimpleFeatureSerialized
  sequenceFeatureDetails: SequenceFeatureDetailsModel
  mode: SequenceDisplayMode
  setMode: (mode: SequenceDisplayMode) => void
  revcomp: boolean
  setRevcomp: (arg: boolean) => void
  sequence: SeqState | ErrorState | undefined
  error: unknown
  assemblyGeneticCodeId?: number
  assemblyName?: string
  hoverTarget?: SequenceHoverTarget
  onForceLoad: () => void
}) {
  const { classes } = useStyles()
  const seqPanelRef = useRef<HTMLDivElement>(null)

  return (
    <InfoDialog
      maxWidth="xl"
      open
      title="Sequence view"
      onClose={() => {
        handleClose()
      }}
    >
      <div className={classes.content}>
        <div>
          <SequenceTypeSelector
            model={sequenceFeatureDetails}
            feature={feature}
            mode={mode}
            setMode={setMode}
          />
          <SequenceFeatureMenu
            ref={seqPanelRef}
            model={sequenceFeatureDetails}
            mode={mode}
            revcomp={revcomp}
            setRevcomp={setRevcomp}
          />
        </div>
        <SequenceBody
          error={error}
          sequence={sequence}
          feature={feature}
          seqPanelRef={seqPanelRef}
          model={sequenceFeatureDetails}
          mode={mode}
          revcomp={revcomp}
          assemblyGeneticCodeId={assemblyGeneticCodeId}
          assemblyName={assemblyName}
          hoverTarget={hoverTarget}
          onForceLoad={onForceLoad}
        />
      </div>
    </InfoDialog>
  )
})

export default SequenceDialog

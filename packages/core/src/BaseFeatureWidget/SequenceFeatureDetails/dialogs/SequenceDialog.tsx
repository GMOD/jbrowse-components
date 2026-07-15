import { useRef } from 'react'

import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import SequenceBody from '../SequenceBody.tsx'
import SequenceFeatureMenu from './SequenceFeatureMenu.tsx'
import SequenceTypeSelector from './SequenceTypeSelector.tsx'
import { Dialog } from '../../../ui/index.ts'
import { makeStyles } from '../../../util/tss-react/index.ts'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type { ErrorState, SeqState } from '../../util.tsx'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from '../model.ts'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
})

const SequenceDialog = observer(function SequenceDialog({
  handleClose,
  sequenceFeatureDetails,
  feature,
  mode,
  setMode,
  sequence,
  error,
  assemblyGeneticCodeId,
  onForceLoad,
}: {
  handleClose: () => void
  feature: SimpleFeatureSerialized
  sequenceFeatureDetails: SequenceFeatureDetailsModel
  mode: SequenceDisplayMode
  setMode: (mode: SequenceDisplayMode) => void
  sequence: SeqState | ErrorState | undefined
  error: unknown
  assemblyGeneticCodeId?: number
  onForceLoad: () => void
}) {
  const { classes } = useStyles()
  const seqPanelRef = useRef<HTMLDivElement>(null)

  return (
    <Dialog
      maxWidth="xl"
      open
      title="Sequence view"
      onClose={() => {
        handleClose()
      }}
    >
      <DialogContent className={classes.dialogContent}>
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
          />
        </div>
        <SequenceBody
          error={error}
          sequence={sequence}
          feature={feature}
          seqPanelRef={seqPanelRef}
          model={sequenceFeatureDetails}
          mode={mode}
          assemblyGeneticCodeId={assemblyGeneticCodeId}
          onForceLoad={onForceLoad}
        />
      </DialogContent>

      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          variant="contained"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default SequenceDialog

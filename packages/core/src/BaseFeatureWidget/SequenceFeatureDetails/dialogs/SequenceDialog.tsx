import { useRef } from 'react'

import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import SequenceBody from '../SequenceBody.tsx'
import SequenceFeatureMenu from './SequenceFeatureMenu.tsx'
import SequenceTypeSelector from './SequenceTypeSelector.tsx'
import { Dialog } from '../../../ui/index.ts'
import { makeStyles } from '../../../util/tss-react/index.ts'
import { useSequenceFetch } from '../useSequenceFetch.ts'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type { BaseFeatureWidgetModel } from '../../stateModelFactory.ts'
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
  model,
  sequenceFeatureDetails,
  feature,
  mode,
  setMode,
}: {
  handleClose: () => void
  feature: SimpleFeatureSerialized
  model: BaseFeatureWidgetModel
  sequenceFeatureDetails: SequenceFeatureDetailsModel
  mode: SequenceDisplayMode
  setMode: (mode: SequenceDisplayMode) => void
}) {
  const { upDownBp } = sequenceFeatureDetails
  const { classes } = useStyles()
  const seqPanelRef = useRef<HTMLDivElement>(null)
  const { sequence, error, onForceLoad } = useSequenceFetch({
    model,
    feature,
    upDownBp,
  })

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

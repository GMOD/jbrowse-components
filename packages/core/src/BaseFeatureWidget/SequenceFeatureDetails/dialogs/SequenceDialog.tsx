import { useRef, useState } from 'react'

import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import SequenceBody from '../SequenceBody.tsx'
import SequenceFeatureMenu from './SequenceFeatureMenu.tsx'
import SequenceTypeSelector from './SequenceTypeSelector.tsx'
import { Dialog } from '../../../ui/index.ts'
import { getSession } from '../../../util/index.ts'
import { makeStyles } from '../../../util/tss-react/index.ts'
import { useFeatureSequence } from '../../../util/useFeatureSequence.ts'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type { BaseFeatureWidgetModel } from '../../stateModelFactory.ts'
import type { SequenceFeatureDetailsModel } from '../model.ts'

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
}: {
  handleClose: () => void
  feature: SimpleFeatureSerialized
  model: BaseFeatureWidgetModel
  sequenceFeatureDetails: SequenceFeatureDetailsModel
}) {
  const { upDownBp } = sequenceFeatureDetails
  const { classes } = useStyles()
  const seqPanelRef = useRef<HTMLDivElement>(null)
  const [forceLoad, setForceLoad] = useState(false)
  const session = getSession(model)
  const assemblyName = model.view?.assemblyNames?.[0]
  const { sequence, error } = useFeatureSequence({
    assemblyName,
    session,
    start: feature.start,
    end: feature.end,
    refName: feature.refName,
    upDownBp,
    forceLoad,
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
          <SequenceTypeSelector model={sequenceFeatureDetails} />
          <SequenceFeatureMenu
            ref={seqPanelRef}
            model={sequenceFeatureDetails}
          />
        </div>
        <SequenceBody
          error={error}
          sequence={sequence}
          feature={feature}
          seqPanelRef={seqPanelRef}
          model={sequenceFeatureDetails}
          onForceLoad={() => {
            setForceLoad(true)
          }}
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

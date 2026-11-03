import { observer } from 'mobx-react'

import { makeStyles } from '../../../util/tss-react/index.ts'
import { sequenceFileStem } from '../util.ts'
import SequenceFeatureMenu from './SequenceFeatureMenu.tsx'
import SequenceTypeSelector from './SequenceTypeSelector.tsx'

import type { MenuItem } from '../../../ui/index.ts'
import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '../../../util/index.ts'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from '../model.ts'
import type { ReactNode, RefObject } from 'react'

// room above the row for the transcript menu's floating label
const useStyles = makeStyles()(theme => ({
  controls: {
    paddingTop: theme.spacing(1),
  },
}))

const SequenceControls = observer(function SequenceControls({
  model,
  session,
  feature,
  mode,
  revcomp,
  setRevcomp,
  seqPanelRef,
  transcriptSelector,
  extraItems,
}: {
  model: SequenceFeatureDetailsModel
  session: Pick<AbstractSessionModel, 'notify' | 'notifyError'>
  feature: SimpleFeatureSerialized
  mode: SequenceDisplayMode
  revcomp: boolean
  setRevcomp: (arg: boolean) => void
  seqPanelRef: RefObject<HTMLDivElement | null>
  transcriptSelector?: ReactNode
  extraItems?: MenuItem[]
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.controls}>
      {transcriptSelector}
      <SequenceTypeSelector model={model} feature={feature} mode={mode} />
      <SequenceFeatureMenu
        ref={seqPanelRef}
        fileStem={sequenceFileStem(feature, mode)}
        model={model}
        session={session}
        mode={mode}
        revcomp={revcomp}
        setRevcomp={setRevcomp}
        extraItems={extraItems}
      />
    </div>
  )
})

export default SequenceControls

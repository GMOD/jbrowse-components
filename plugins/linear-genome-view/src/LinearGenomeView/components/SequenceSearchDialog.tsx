import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { observer } from 'mobx-react'

import CrisprGuidePanel from './CrisprGuidePanel.tsx'
import MotifListPanel from './MotifListPanel.tsx'
import SequencePatternPanel from './SequencePatternPanel.tsx'

import type { SequenceSearchModeProps } from './searchModes.ts'
import type { ComponentType } from 'react'

const useStyles = makeStyles()({
  modeBar: {
    padding: '12px 24px 0',
  },
})

const MODES: {
  id: string
  label: string
  ReactComponent: ComponentType<SequenceSearchModeProps>
}[] = [
  {
    id: 'pattern',
    label: 'Sequence pattern',
    ReactComponent: SequencePatternPanel,
  },
  {
    id: 'crispr',
    label: 'CRISPR guide RNAs',
    ReactComponent: CrisprGuidePanel,
  },
  {
    id: 'motifs',
    label: 'Motif list',
    ReactComponent: MotifListPanel,
  },
]

const SequenceSearchDialog = observer(function SequenceSearchDialog({
  model,
  handleClose,
}: {
  model: {
    assemblyNames: string[]
    launchTrack: (trackId: string) => Promise<unknown>
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [modeId, setModeId] = useState(MODES[0]!.id)
  const active = MODES.find(m => m.id === modeId) ?? MODES[0]!
  const { ReactComponent } = active

  return (
    <Dialog maxWidth="xl" open onClose={handleClose} title="Sequence search">
      <div className={classes.modeBar}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={active.id}
          onChange={(_event, value) => {
            if (value) {
              setModeId(value)
            }
          }}
        >
          {MODES.map(m => (
            <ToggleButton key={m.id} value={m.id}>
              {m.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <ReactComponent model={model} handleClose={handleClose} />
    </Dialog>
  )
})

export default SequenceSearchDialog

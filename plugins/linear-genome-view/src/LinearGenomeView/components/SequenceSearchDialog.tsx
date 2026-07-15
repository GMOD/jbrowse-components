import { useState } from 'react'
import type { ComponentType } from 'react'

import { Dialog, PluggableComponent } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { observer } from 'mobx-react'

import CrisprGuidePanel from './CrisprGuidePanel.tsx'
import MotifListPanel from './MotifListPanel.tsx'
import SequencePatternPanel from './SequencePatternPanel.tsx'

import type { SequenceSearchModeProps } from './searchModes.ts'

const useStyles = makeStyles()({
  modeBar: {
    padding: '12px 24px 0',
  },
})

// Each mode's panel is rendered through PluggableComponent under its own
// extension-point name, so a plugin can fully replace a built-in panel (e.g.
// swap in its own CRISPR guide designer) by registering on that name — the same
// single-component replacement pattern as Core-replaceWidget.
interface SearchMode {
  id: string
  label: string
  extensionPoint: string
  ReactComponent: ComponentType<SequenceSearchModeProps>
}

const MODES: SearchMode[] = [
  {
    id: 'pattern',
    label: 'Sequence pattern',
    extensionPoint: 'LinearGenomeView-sequenceSearchPanel',
    ReactComponent: SequencePatternPanel,
  },
  {
    id: 'crispr',
    label: 'CRISPR guide RNAs',
    extensionPoint: 'LinearGenomeView-crisprGuidePanel',
    ReactComponent: CrisprGuidePanel,
  },
  {
    id: 'motifs',
    label: 'Motif list',
    extensionPoint: 'LinearGenomeView-motifListPanel',
    ReactComponent: MotifListPanel,
  },
]

const SequenceSearchDialog = observer(function SequenceSearchDialog({
  model,
  handleClose,
}: {
  model: {
    assemblyNames: string[]
    showTrack: (trackId: string) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(model)
  const [modeId, setModeId] = useState(MODES[0]!.id)
  const active = MODES.find(m => m.id === modeId) ?? MODES[0]!

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
      <PluggableComponent
        pluginManager={pluginManager}
        name={active.extensionPoint}
        component={active.ReactComponent}
        props={{ model, handleClose }}
      />
    </Dialog>
  )
})

export default SequenceSearchDialog

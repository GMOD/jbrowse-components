import { setConf } from '@jbrowse/core/configuration'
import { baseDisplayConfig } from '@jbrowse/core/util/baseDisplayConfig'
import { Button } from '@mui/material'

import { writeThrough } from './writeThrough.ts'

import type { ScoreAxisDisplay } from './types.ts'

// Back to what the config.json says, or to what a session-owned track was
// added with, so an admin's declared axis survives a reset; slots the base
// leaves unset take their defaults.
export function resetAxis(display: ScoreAxisDisplay) {
  const base = baseDisplayConfig(display).scales as { y?: unknown } | undefined
  writeThrough(display, () => {
    setConf(display.configuration, ['scales', 'y'], base?.y ?? {})
  })
}

export default function ResetAxisButton({
  display,
  onReset,
}: {
  display: ScoreAxisDisplay
  onReset: () => void
}) {
  return (
    <div>
      <Button
        variant="outlined"
        size="small"
        onClick={() => {
          resetAxis(display)
          onReset()
        }}
      >
        Reset to defaults
      </Button>
    </div>
  )
}

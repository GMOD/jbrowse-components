import { ToggleButton, ToggleButtonGroup } from '@mui/material'

export type ImportFormMode = 'quick' | 'manual'

/**
 * The Quick start / Manual switch shared by the linear synteny and dotplot
 * import forms. Quick start launches straight from a pre-configured synteny
 * track (it names its own assemblies, so nothing else needs picking); Manual is
 * the full assembly-by-assembly form. Making the two an explicit mode is what
 * keeps Quick start's track picker from silently rewriting the fields of a form
 * the user thought they were filling in.
 */
export default function ImportFormModeToggle({
  mode,
  onChange,
}: {
  mode: ImportFormMode
  onChange: (mode: ImportFormMode) => void
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={mode}
      aria-label="Import form mode"
      onChange={(_event, value: ImportFormMode | null) => {
        // a null value is the click that would de-select the active button;
        // ignore it so the form always has a mode
        if (value) {
          onChange(value)
        }
      }}
    >
      <ToggleButton value="quick">Quick start</ToggleButton>
      <ToggleButton value="manual">Manual</ToggleButton>
    </ToggleButtonGroup>
  )
}

import { ToggleButton, ToggleButtonGroup } from '@mui/material'

export type ImportFormMode = 'quick' | 'manual'

/**
 * The Quick start / Manual switch shared by the linear synteny and dotplot
 * import forms. Quick start launches straight from a pre-configured synteny
 * track (it names its own assemblies, so nothing else needs picking); Manual is
 * the full assembly-by-assembly form. Making the two an explicit mode is what
 * keeps Quick start's track picker from silently rewriting the fields of a form
 * the user thought they were filling in.
 *
 * Quick start is deliberately not disabled when the session has no synteny
 * track: ToggleButtonGroup clones props onto its direct children, so the
 * wrapper a Tooltip needs to explain a disabled button can't go here. The empty
 * Quick start panel carries the way out instead. See QuickStartPanel.
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
        // null is the click that would de-select the active button. Reported as
        // a choice of the mode already showing, rather than dropped: the form
        // must always have a mode, and while the user has picked none the one
        // showing is derived from what the session has finished loading — so
        // clicking the button you are already on is how you say "stay here",
        // and it has to reach the state that latches that.
        onChange(value ?? mode)
      }}
    >
      <ToggleButton value="quick">Quick start</ToggleButton>
      <ToggleButton value="manual">Manual</ToggleButton>
    </ToggleButtonGroup>
  )
}

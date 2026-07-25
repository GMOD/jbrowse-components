import { FormControlLabel, Radio, RadioGroup } from '@mui/material'
import { observer } from 'mobx-react'

const modeDescriptions = {
  auto: (
    <div>
      Run in-app clustering (slower, particularly for large numbers of samples,
      uses JS implementation of hclust)
    </div>
  ),
  manual: (
    <div>
      Download R script to run clustering (faster, uses R implementation of
      hclust)
    </div>
  ),
}

// Auto (in-app JS hclust) vs manual (download R script) mode picker, shared by
// the wiggle and variant clustering dialogs. A controlled form control: read
// `value`, write via `onChange`. Compose a per-plugin intro by passing it as
// `children` (rendered above the radios).
const ClusterModeSelector = observer(function ClusterModeSelector({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (mode: string) => void
  children?: React.ReactNode
}) {
  return (
    <div>
      {children}
      <RadioGroup
        value={value}
        onChange={(_event, next) => {
          onChange(next)
        }}
      >
        {Object.entries(modeDescriptions).map(([key, label]) => (
          <FormControlLabel
            key={key}
            value={key}
            control={<Radio />}
            label={label}
          />
        ))}
      </RadioGroup>
    </div>
  )
})

export default ClusterModeSelector

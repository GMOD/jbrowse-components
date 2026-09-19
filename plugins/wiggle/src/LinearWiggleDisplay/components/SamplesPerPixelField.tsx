import { TextField, Typography } from '@mui/material'

// Sampling-density control shared by the auto and manual cluster dialogs — the
// two rendered it identically, so the copy lives here to prevent drift.
export default function SamplesPerPixelField({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div style={{ marginTop: 20 }}>
      <Typography>
        By default this samples the data once per screen pixel across the
        currently visible region.
      </Typography>
      <TextField
        label="Samples per pixel (>1 for denser sampling, between 0-1 for sparser sampling)"
        variant="outlined"
        size="small"
        value={value}
        onChange={event => {
          onChange(event.target.value)
        }}
      />
    </div>
  )
}

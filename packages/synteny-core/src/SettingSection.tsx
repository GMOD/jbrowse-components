import { Typography } from '@mui/material'

// Heading over a run of SettingRows. Spans the popover rather than sitting in a
// row's label column, because it names the rows under it rather than a control
// beside it — the same job a menu's `subHeader` does.
export default function SettingSection({ label }: { label: string }) {
  return (
    <Typography
      variant="caption"
      color="textSecondary"
      style={{
        marginTop: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {label}
    </Typography>
  )
}

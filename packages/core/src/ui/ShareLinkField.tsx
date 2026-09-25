import { TextField } from '@mui/material'

// Read-only single-line field for a shareable URL; clicking selects the whole
// value so it's easy to copy. Shared by jbrowse-web's ShareDialog and
// jbrowse-desktop's ExportToWebDialog.
export default function ShareLinkField({
  value,
  label = 'URL',
}: {
  value: string
  label?: string
}) {
  return (
    <TextField
      label={label}
      value={value}
      variant="filled"
      fullWidth
      onClick={event => {
        const target = event.target as HTMLInputElement
        target.select()
      }}
      slotProps={{
        input: {
          readOnly: true,
        },
      }}
    />
  )
}

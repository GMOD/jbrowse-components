import { TextField } from '@mui/material'

export default function ShareDialogLinkField({ url }: { url: string }) {
  return (
    <TextField
      label="URL"
      value={url}
      variant="filled"
      fullWidth
      onClick={event => {
        const target = event.target as HTMLTextAreaElement
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

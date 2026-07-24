import { TextField } from '@mui/material'

import type { TextFieldProps } from '@mui/material'

// Outlined + monospace: the sequence/primer inputs that are the point of these
// dialogs, kept visually distinct from the standard-variant UCSC override fields
// (db/url/apiKey) that most users never touch.
export default function MonospaceTextField(props: TextFieldProps) {
  return (
    <TextField
      variant="outlined"
      {...props}
      slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
    />
  )
}

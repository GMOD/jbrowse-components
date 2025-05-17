import { TextField } from '@mui/material'

import type { TextFieldProps } from '@mui/material'

export default function TextField2({ children, ...rest }: TextFieldProps) {
  return (
    <div>
      <TextField {...rest}>{children}</TextField>
    </div>
  )
}

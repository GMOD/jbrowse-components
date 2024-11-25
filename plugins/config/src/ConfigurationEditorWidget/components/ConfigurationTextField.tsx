import React from 'react'
import { SanitizedHTML } from '@jbrowse/core/ui'
import { TextField } from '@mui/material'
import type { TextFieldProps } from '@mui/material'

// adds ability to have html in helperText. note that FormHelperTextProps is
// div because the default is p which does not like div children
export default function ConfigurationTextField(
  props: { helperText?: string } & TextFieldProps,
) {
  const { helperText } = props
  return (
    <TextField
      {...props}
      helperText={<SanitizedHTML html={helperText || ''} />}
      fullWidth
      slotProps={{
        formHelperText: {
          component: 'div',
        },
      }}
    />
  )
}

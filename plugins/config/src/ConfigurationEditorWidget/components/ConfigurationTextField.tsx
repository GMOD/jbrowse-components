import React from 'react'
import { TextField, TextFieldProps } from '@mui/material'
import { SanitizedHTML } from '@jbrowse/core/ui'

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
      FormHelperTextProps={{
        // @ts-expect-error
        component: 'div',
      }}
      fullWidth
    />
  )
}

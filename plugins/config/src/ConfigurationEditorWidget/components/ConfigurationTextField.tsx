import { SanitizedHTML } from '@jbrowse/core/ui'
import { TextField } from '@mui/material'

import type { TextFieldProps } from '@mui/material'

// adds ability to have html in helperText. note that FormHelperTextProps is
// div because the default is p which does not like div children
export default function ConfigurationTextField(
  props: { helperText?: string } & TextFieldProps,
) {
  const { helperText, slotProps, ...rest } = props
  return (
    <TextField
      {...rest}
      helperText={<SanitizedHTML html={helperText || ''} />}
      fullWidth
      // merged, not replaced: this component owns `formHelperText` (the div
      // above needs it) while a caller owns the rest, and setting the whole bag
      // here dropped a caller's `inputLabel` silently — the shrink that lets a
      // labelled field draw its placeholder
      slotProps={{
        ...slotProps,
        formHelperText: {
          component: 'div',
        },
      }}
    />
  )
}

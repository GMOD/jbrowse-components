import { TextField } from '@mui/material'

import type {
  AutocompleteRenderInputParams,
  TextFieldProps as TFP,
} from '@mui/material'

export default function AutocompleteTextField({
  TextFieldProps,
  params,
}: {
  TextFieldProps: TFP
  params: AutocompleteRenderInputParams
}) {
  const { helperText, slotProps = {} } = TextFieldProps
  const { ref: inputRef, ...restInputProps } = params.InputProps
  const { InputProps: _InputProps, ...restParams } = params
  return (
    <TextField
      {...restParams}
      {...TextFieldProps}
      inputRef={inputRef}
      size="small"
      helperText={helperText}
      slotProps={{
        input: {
          ...restInputProps,
          // eslint-disable-next-line @typescript-eslint/no-misused-spread
          ...slotProps.input,
        },
      }}
      placeholder="Search for location"
    />
  )
}

import type { RefObject } from 'react'

import { TextField } from '@mui/material'

import type {
  AutocompleteRenderInputParams,
  TextFieldProps as TFP,
} from '@mui/material'

export default function AutocompleteTextField({
  TextFieldProps,
  inputRef,
  params,
  setCurrentSearch,
}: {
  TextFieldProps: TFP
  inputRef: RefObject<HTMLInputElement | null>
  params: AutocompleteRenderInputParams
  setCurrentSearch: (arg: string) => void
}) {
  const { helperText, slotProps = {} } = TextFieldProps
  // Remove value from inputProps to make input uncontrolled, allowing imperative updates
  const { inputProps: { value: _value, ...inputProps } = {}, ...restParams } =
    params
  return (
    <TextField
      inputRef={inputRef}
      {...restParams}
      inputProps={inputProps}
      {...TextFieldProps}
      size="small"
      helperText={helperText}
      slotProps={{
        input: {
          ...params.InputProps,
          // eslint-disable-next-line @typescript-eslint/no-misused-spread
          ...slotProps.input,
        },
      }}
      placeholder="Search for location"
      onChange={e => {
        setCurrentSearch(e.target.value)
      }}
    />
  )
}

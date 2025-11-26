import type { RefObject } from 'react'

import { TextField } from '@mui/material'

import type {
  AutocompleteRenderInputParams,
  TextFieldProps as TFP,
} from '@mui/material'

export default function AutocompleteTextField({
  TextFieldProps,
  inputBoxValRef,
  inputRef,
  params,
  setCurrentSearch,
}: {
  TextFieldProps: TFP
  inputBoxValRef: RefObject<string>
  inputRef: RefObject<HTMLInputElement | null>
  params: AutocompleteRenderInputParams
  setCurrentSearch: (arg: string) => void
}) {
  const { helperText, slotProps = {} } = TextFieldProps
  // MUI Autocomplete passes inputProps.value to control the input. We extract
  // it and override with value:undefined to make the input uncontrolled, then
  // use defaultValue for initial render. The parent updates via ref directly.
  const { inputProps, ...restParams } = params
  return (
    <TextField
      inputRef={inputRef}
      onBlur={() => {
        if (inputRef.current) {
          inputRef.current.value = inputBoxValRef.current
        }
      }}
      {...restParams}
      {...TextFieldProps}
      size="small"
      helperText={helperText}
      slotProps={{
        input: {
          ...params.InputProps,
          // eslint-disable-next-line @typescript-eslint/no-misused-spread
          ...slotProps.input,
        },
        htmlInput: {
          ...inputProps,
          value: undefined,
          defaultValue: inputBoxValRef.current,
        },
      }}
      placeholder="Search for location"
      onChange={e => {
        setCurrentSearch(e.target.value)
      }}
    />
  )
}

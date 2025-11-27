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
  const {
    variant,
    className,
    style,
    helperText,
    slotProps = {},
  } = TextFieldProps
  const { InputProps, inputProps, fullWidth } = params

  // Remove 'value' from inputProps to keep input uncontrolled,
  // allowing imperative updates via inputRef
  const { value: _value, ...inputPropsWithoutValue } = inputProps

  // slotProps.input could be a function in MUI, only spread if it's an object
  const inputSlotProps =
    typeof slotProps.input === 'object' ? slotProps.input : undefined

  return (
    <TextField
      variant={variant}
      className={className}
      style={style}
      fullWidth={fullWidth}
      inputRef={inputRef}
      size="small"
      helperText={helperText}
      slotProps={{
        input: {
          ...InputProps,
          ...inputSlotProps,
        },
        htmlInput: inputPropsWithoutValue,
      }}
      placeholder="Search for location"
      onChange={e => {
        setCurrentSearch(e.target.value)
      }}
    />
  )
}

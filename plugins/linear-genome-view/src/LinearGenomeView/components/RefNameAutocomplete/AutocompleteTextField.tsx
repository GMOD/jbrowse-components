import type { RefObject } from 'react'

import { TextField } from '@mui/material'

import type {
  AutocompleteRenderInputParams,
  InputBaseComponentProps,
  InputProps,
} from '@mui/material'

export interface TextFieldProps {
  variant?: 'outlined' | 'filled' | 'standard'
  className?: string
  style?: React.CSSProperties
  helperText?: React.ReactNode
  slotProps?: {
    input?: Partial<InputProps>
    htmlInput?: InputBaseComponentProps
  }
}

export default function AutocompleteTextField({
  TextFieldProps,
  inputRef,
  params,
  setCurrentSearch,
}: {
  TextFieldProps: TextFieldProps
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
          ...slotProps.input,
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

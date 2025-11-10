import { TextField } from '@mui/material'

import type {
  AutocompleteRenderInputParams,
  TextFieldProps as TFP,
} from '@mui/material'

export default function AutocompleteTextField({
  TextFieldProps,
  inputBoxVal,
  params,
  setInputValue,
  setCurrentSearch,
  onBlurCallback,
}: {
  TextFieldProps: TFP
  inputBoxVal: string
  params: AutocompleteRenderInputParams
  setInputValue: (arg: string) => void
  setCurrentSearch: (arg: string) => void
  onBlurCallback?: () => void
}) {
  const { helperText, slotProps = {} } = TextFieldProps
  return (
    <TextField
      onBlur={() => {
        // this is used to restore a refName or the non-user-typed input to the
        // box on blurring
        setInputValue(inputBoxVal)
        onBlurCallback?.()
      }}
      {...params}
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

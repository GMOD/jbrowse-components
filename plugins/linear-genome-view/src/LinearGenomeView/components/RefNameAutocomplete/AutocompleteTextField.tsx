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
}: {
  TextFieldProps: TFP
  inputBoxVal: string
  params: AutocompleteRenderInputParams
  setInputValue: (arg: string) => void
  setCurrentSearch: (arg: string) => void
}) {
  return (
    <TextField
      onBlur={() => {
        // this is used to restore a refName or the non-user-typed input to the
        // box on blurring
        setInputValue(inputBoxVal)
      }}
      {...params}
      {...TextFieldProps}
      size="small"
      placeholder="Search for location"
      onChange={e => {
        setCurrentSearch(e.target.value)
      }}
    />
  )
}

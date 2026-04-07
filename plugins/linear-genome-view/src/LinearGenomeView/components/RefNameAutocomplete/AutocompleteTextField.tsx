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
  const { helperText, slotProps: tfSlotProps = {} } = TextFieldProps
  const { slotProps: paramSlotProps, ...restParams } = params
  return (
    <TextField
      onBlur={() => {
        setInputValue(inputBoxVal)
      }}
      {...restParams}
      {...TextFieldProps}
      size="small"
      helperText={helperText}
      slotProps={{
        ...tfSlotProps,
        input: {
          ...paramSlotProps.input,
          // eslint-disable-next-line @typescript-eslint/no-misused-spread
          ...(tfSlotProps.input as object),
        },
        htmlInput: {
          ...paramSlotProps.htmlInput,
          ...(tfSlotProps.htmlInput as object),
        },
        inputLabel: {
          ...paramSlotProps.inputLabel,
          ...(tfSlotProps.inputLabel as object),
        },
      }}
      placeholder="Search for location"
      onChange={e => {
        setCurrentSearch(e.target.value)
      }}
    />
  )
}

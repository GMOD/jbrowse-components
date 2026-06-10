import { makeStyles } from '@jbrowse/core/util/tss-react'
import { InputLabel, TextField } from '@mui/material'

import { monospaceFontFamily as fontFamily } from './useSlotEditorStyles.ts'

import type { TextFieldProps } from '@mui/material'

const useStyles = makeStyles()(() => ({
  error: {
    color: 'red',
    fontSize: '0.8em',
  },
  container: {
    width: '100%',
    overflowX: 'auto',
  },
  field: {
    fontFamily,
  },
}))

// shared scaffolding for the jexl-callback and JSON slot editors: a monospace
// multiline TextField that turns red on a parse error, with an error banner
// above and an optional InputLabel. `children` render below the field (e.g. a
// description or help button).
export default function MonospaceTextField({
  value,
  onChange,
  error,
  label,
  children,
  style,
  ...rest
}: {
  value: string
  onChange: (value: string) => void
  error?: unknown
  label?: React.ReactNode
  children?: React.ReactNode
} & Omit<TextFieldProps, 'value' | 'onChange' | 'error'>) {
  const { classes } = useStyles()
  return (
    <>
      {error ? <p className={classes.error}>{`${error}`}</p> : null}
      <div className={classes.container}>
        {label ? <InputLabel shrink>{label}</InputLabel> : null}
        <TextField
          {...rest}
          multiline
          value={value}
          onChange={event => {
            onChange(event.target.value)
          }}
          style={{ background: error ? '#fdd' : undefined, ...style }}
          slotProps={{
            input: {
              classes: {
                input: classes.field,
              },
            },
          }}
        />
        {children}
      </div>
    </>
  )
}

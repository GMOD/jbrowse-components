import { InputLabel, TextField } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'

import type { TextFieldProps } from '@mui/material'

const monospaceFontFamily =
  'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace'

const useStyles = makeStyles()({
  error: {
    color: 'red',
    fontSize: '0.8em',
  },
  container: {
    width: '100%',
    overflowX: 'auto',
  },
  field: {
    fontFamily: monospaceFontFamily,
  },
})

// Monospace multiline TextField for code/jexl/JSON/sequence content. Turns red
// on a parse error, renders an optional error banner above and an InputLabel,
// and applies the shared monospace font stack to the input slot. `children`
// render below the field (e.g. a description or help button).
export default function MonospaceTextField({
  value,
  onChange,
  error,
  label,
  children,
  style,
  readOnly,
  variant = 'outlined',
  ...rest
}: {
  value: string
  onChange?: (value: string) => void
  error?: unknown
  label?: React.ReactNode
  children?: React.ReactNode
  readOnly?: boolean
} & Omit<TextFieldProps, 'value' | 'onChange' | 'error' | 'slotProps'>) {
  const { classes } = useStyles()
  return (
    <>
      {error ? <p className={classes.error}>{`${error}`}</p> : null}
      <div className={classes.container}>
        {label ? <InputLabel shrink>{label}</InputLabel> : null}
        <TextField
          {...rest}
          variant={variant}
          multiline
          value={value}
          onChange={event => {
            onChange?.(event.target.value)
          }}
          style={{ background: error ? '#fdd' : undefined, ...style }}
          slotProps={{
            input: {
              readOnly,
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

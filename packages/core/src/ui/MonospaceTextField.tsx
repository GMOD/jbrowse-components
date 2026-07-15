import { InputLabel, TextField, alpha } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'

import type { TextFieldProps } from '@mui/material'

const monospaceFontFamily =
  'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace'

const useStyles = makeStyles()(theme => ({
  error: {
    color: theme.palette.error.main,
    fontSize: '0.8em',
  },
  container: {
    width: '100%',
    overflowX: 'auto',
  },
  field: {
    fontFamily: monospaceFontFamily,
  },
  errorField: {
    background: alpha(theme.palette.error.main, 0.15),
  },
}))

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
  className,
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
  const { classes, cx } = useStyles()
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
          className={cx(className, error ? classes.errorField : undefined)}
          style={style}
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

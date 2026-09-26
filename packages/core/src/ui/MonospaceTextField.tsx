import { InputLabel, TextField } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'
import { alpha } from './palette.ts'

import type { TextFieldProps } from '@mui/material'

const monospaceFontFamily =
  'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace'

const useStyles = makeStyles()(theme => ({
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

// Monospace multiline TextField for code/jexl/JSON/sequence content. A parse
// error turns it red and takes the helper text's place under the field, so
// the text does not move while it flips between valid and invalid. `children`
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
  inputTestId,
  helperText,
  variant = 'outlined',
  ...rest
}: {
  value: string
  onChange?: (value: string) => void
  error?: unknown
  label?: React.ReactNode
  children?: React.ReactNode
  readOnly?: boolean
  inputTestId?: string
} & Omit<TextFieldProps, 'value' | 'onChange' | 'error' | 'slotProps'>) {
  const { classes, cx } = useStyles()
  return (
    <div className={classes.container}>
      {label ? <InputLabel shrink>{label}</InputLabel> : null}
      <TextField
        {...rest}
        variant={variant}
        multiline
        error={!!error}
        helperText={error ? `${error}` : helperText}
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
          htmlInput: {
            'data-testid': inputTestId,
            spellCheck: false,
            autoCorrect: 'off',
            autoCapitalize: 'off',
          },
        }}
      />
      {children}
    </div>
  )
}

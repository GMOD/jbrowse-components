import InputBase from '@material-ui/core/InputBase'
import Typography, { TypographyProps } from '@material-ui/core/Typography'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import React, { useEffect, useState } from 'react'

type Variant = TypographyProps['variant']

type EditableTypographyClassKey =
  | 'input'
  | 'inputBase'
  | 'inputRoot'
  | 'inputFocused'

const useStyles = makeStyles(theme => ({
  input: {},
  inputBase: {},
  typography: {
    top: 6,
    left: 2,
    position: 'absolute',
    whiteSpace: 'nowrap',
    visibility: 'hidden',
  },
  inputRoot: {
    padding: theme.spacing(0.5),
  },
  inputFocused: {
    borderStyle: 'solid',
    borderRadius: theme.shape.borderRadius,
    borderWidth: 2,
  },
}))

interface EditableTypographyPropTypes {
  value: string
  setValue: (value: string) => void
  variant: Variant
  classes?: Partial<Record<EditableTypographyClassKey, string>>
}

// using forwardRef so that MUI Tooltip can wrap this component
const EditableTypography = React.forwardRef(
  (props: EditableTypographyPropTypes, ref: React.Ref<HTMLDivElement>) => {
    const { value, setValue, variant, ...other } = props
    const [editedValue, setEditedValue] = useState<string | undefined>()
    const [width, setWidth] = useState(0)
    const [sizerNode, setSizerNode] = useState<HTMLSpanElement | null>(null)
    const [inputNode, setInputNode] = useState<HTMLInputElement | null>(null)
    const [blur, setBlur] = useState(false)

    useEffect(() => {
      if (blur) {
        inputNode && inputNode.blur()
        setBlur(false)
      }
    }, [blur, inputNode])

    const classes = useStyles(props)
    const theme = useTheme()

    const clientWidth = sizerNode && sizerNode.clientWidth
    if (clientWidth && clientWidth !== width) {
      setWidth(clientWidth)
    }

    const sizerRef = (node: HTMLSpanElement) => {
      setSizerNode(node)
    }

    const inputRef = (node: HTMLInputElement) => {
      setInputNode(node)
    }

    function handleBlur() {
      if (editedValue && editedValue !== value) {
        setValue(editedValue)
      }
      setEditedValue(undefined)
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
      // "Enter"
      if (event.keyCode === 13) {
        inputNode && inputNode.blur()
      }
      // "Esc"
      else if (event.keyCode === 27) {
        setEditedValue(undefined)
        setBlur(true)
      }
    }

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      setEditedValue(event.target.value)
    }

    return (
      <div {...other} ref={ref}>
        <div style={{ position: 'relative' }}>
          <Typography
            ref={sizerRef}
            component="span"
            variant={variant}
            className={classes.typography}
          >
            {editedValue === undefined ? value : editedValue}
          </Typography>
        </div>
        <InputBase
          inputRef={inputRef}
          className={classes.inputBase}
          inputProps={{
            style: {
              width,
              ...(variant && variant !== 'inherit' && variant !== 'srOnly'
                ? theme.typography[variant]
                : {}),
            },
          }}
          classes={{
            input: classes.input,
            root: classes.inputRoot,
            focused: classes.inputFocused,
          }}
          value={editedValue === undefined ? value : editedValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      </div>
    )
  },
)

export default EditableTypography

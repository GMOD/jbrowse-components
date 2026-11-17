import {
  buttonClasses,
  formControlClasses,
  formHelperTextClasses,
  iconButtonClasses,
  inputBaseClasses,
  inputLabelClasses,
  outlinedInputClasses,
  toggleButtonClasses,
} from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'

import type { ComponentProps } from 'react'

export const CONTROL_HEIGHT = 32

const HELPER_TEXT_GAP = 3

// how far above its box MUI floats an outlined field's shrunk label
const OUTLINED_LABEL_OVERHANG = 9

const controlsOutsideInputs = [
  buttonClasses.root,
  iconButtonClasses.root,
  toggleButtonClasses.root,
  outlinedInputClasses.root,
]
  .map(cls => `& .${cls}:not(.${inputBaseClasses.root} *)`)
  .join(', ')

const useStyles = makeStyles()(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    [controlsOutsideInputs]: {
      height: CONTROL_HEIGHT,
      marginBlock: 0,
    },
    [`& .${outlinedInputClasses.input}`]: {
      paddingBlock: 0,
    },
    [`& .${inputLabelClasses.outlined}:not(.${inputLabelClasses.shrink})`]: {
      transform: `translate(14px, calc((${CONTROL_HEIGHT}px - 1.4375em) / 2)) scale(1)`,
    },
    [`& .${formControlClasses.root}`]: {
      marginBlock: 0,
    },
    [`& .${formHelperTextClasses.root}`]: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: HELPER_TEXT_GAP,
    },
    [`&:has(.${inputLabelClasses.outlined})`]: {
      paddingTop: OUTLINED_LABEL_OVERHANG,
    },
    [`&:has(.${formHelperTextClasses.root})`]: {
      paddingBottom: `calc(${theme.typography.caption.fontSize} * ${theme.typography.caption.lineHeight} + ${HELPER_TEXT_GAP}px)`,
    },
  },
}))

/**
 * A row of controls drawn at one height. Buttons, icon buttons, toggle buttons
 * and outlined fields inside it are all CONTROL_HEIGHT tall with no vertical
 * margin. A field's floating label and helper text hang above and below it
 * in room the row reserves, so centering the row lines every control up
 * whatever MUI size each one has.
 */
const ControlRow = observer(function ControlRow({
  className,
  ...props
}: ComponentProps<'div'>) {
  const { classes, cx } = useStyles()
  return <div {...props} className={cx(classes.row, className)} />
})

export default ControlRow

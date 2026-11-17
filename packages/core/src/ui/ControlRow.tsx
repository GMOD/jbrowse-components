import {
  autocompleteClasses,
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

const CONTROL_HEIGHT = '2rem'

const HELPER_TEXT_GAP = 3

// how far above its box MUI floats an outlined field's shrunk label
const OUTLINED_LABEL_OVERHANG = 9

const outsideInputs = (selector: string) =>
  `& ${selector}:not(.${inputBaseClasses.root} *)`

const buttons = [
  buttonClasses.root,
  iconButtonClasses.root,
  toggleButtonClasses.root,
].map(cls => outsideInputs(`.${cls}`))

const singleLineInput = outsideInputs(
  `.${outlinedInputClasses.root}:not(.${inputBaseClasses.multiline}):not(:has(.${autocompleteClasses.tag}))`,
)

const useStyles = makeStyles()(theme => ({
  row: {
    '--label-room': '0px',
    '--helper-room': '0px',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    rowGap: `calc(${theme.spacing(1)} + var(--label-room) + var(--helper-room))`,
    paddingTop: 'var(--label-room)',
    paddingBottom: 'var(--helper-room)',
    [[...buttons, singleLineInput].join(', ')]: {
      height: CONTROL_HEIGHT,
      marginBlock: 0,
    },
    [outsideInputs(`.${iconButtonClasses.root}`)]: {
      minWidth: CONTROL_HEIGHT,
    },
    [`& .${outlinedInputClasses.input}`]: {
      paddingBlock: 0,
    },
    [`& .${inputLabelClasses.outlined}:not(.${inputLabelClasses.shrink})`]: {
      transform: `translate(14px, calc((${CONTROL_HEIGHT} - 1.4375em) / 2)) scale(1)`,
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
      '--label-room': `${OUTLINED_LABEL_OVERHANG}px`,
    },
    [`&:has(.${formHelperTextClasses.root})`]: {
      '--helper-room': `calc(${theme.typography.caption.fontSize} * ${theme.typography.caption.lineHeight} + ${HELPER_TEXT_GAP}px)`,
    },
  },
}))

/**
 * A row of controls drawn at one height. Buttons, icon buttons, toggle buttons
 * and single-line outlined fields inside it are all 2rem tall with no vertical
 * margin, and an icon button is round, whatever MUI size or class each one
 * has: the row's rules outrank a child's own. A field's floating label and
 * helper text hang above and below it in room the row reserves, between
 * wrapped lines too, so centering the row lines every control up.
 */
const ControlRow = observer(function ControlRow({
  className,
  ...props
}: ComponentProps<'div'>) {
  const { classes, cx } = useStyles()
  return <div {...props} className={cx(classes.row, className)} />
})

export default ControlRow

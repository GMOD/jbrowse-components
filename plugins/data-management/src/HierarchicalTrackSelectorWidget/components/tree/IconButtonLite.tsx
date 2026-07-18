import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material/styles'

// A drop-in trigger for CascadingMenuButton (via its ButtonComponent prop) that
// clones MUI's small <IconButton> visually without mounting ButtonBase +
// TouchRipple. The root merges ButtonBase.js's reset (notably
// verticalAlign:'middle', without which the button rides up superscript-style
// on the text baseline) with IconButton.js's small-size styles: fontSize
// pxToRem(18), round action.active button, alpha(action.active, hoverOpacity)
// hover. Styles are hoisted (one makeStyles), not generated per instance.
// `padding` is applied inline (not via a caller className) so it can't lose a
// stylesheet-insertion-order race with this hoisted class.
const useStyles = makeStyles()(theme => ({
  root: {
    // ButtonBase reset
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    boxSizing: 'border-box',
    WebkitTapHighlightColor: 'transparent',
    backgroundColor: 'transparent',
    outline: 0,
    border: 0,
    margin: 0,
    cursor: 'pointer',
    userSelect: 'none',
    verticalAlign: 'middle',
    MozAppearance: 'none',
    WebkitAppearance: 'none',
    textDecoration: 'none',
    // IconButton (size='small')
    textAlign: 'center',
    flex: '0 0 auto',
    fontSize: theme.typography.pxToRem(18),
    borderRadius: '50%',
    overflow: 'visible',
    color: theme.palette.action.active,
    transition: theme.transitions.create('background-color', {
      duration: theme.transitions.duration.shortest,
    }),
    '&:hover': {
      backgroundColor: alpha(
        theme.palette.action.active,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
    '&:disabled': {
      color: theme.palette.action.disabled,
      cursor: 'default',
      pointerEvents: 'none',
    },
  },
}))

export default function IconButtonLite({
  children,
  className,
  onClick,
  disabled,
  padding = 5,
  ...rest
}: {
  children?: React.ReactNode
  className?: string
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  // MUI small IconButton padding is 5; dense list rows pass 0
  padding?: number
  'aria-label'?: string
}) {
  const { classes, cx } = useStyles()
  return (
    <button
      type="button"
      className={cx(classes.root, className)}
      style={{ padding }}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
}

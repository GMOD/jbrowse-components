import { makeStyles } from '@jbrowse/core/util/tss-react'

// MUI's own CheckBox / CheckBoxOutlineBlank icon path data (24x24 viewBox), so
// the glyph is pixel-identical to <Checkbox> without mounting SwitchBase +
// ButtonBase + TouchRipple + two SvgIcon instances per row.
const checkedPath =
  'M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2m-9 14-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z'
const blankPath =
  'M19 5v14H5V5zm0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2'

// styles generated once (hoisted makeStyles), not per instance
const useStyles = makeStyles()(theme => ({
  root: {
    display: 'inline-flex',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
  },
  checked: {
    color: theme.palette.primary.main,
  },
  disabled: {
    color: theme.palette.action.disabled,
  },
  input: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    opacity: 0,
    cursor: 'inherit',
  },
  svg: {
    // MUI's medium SvgIcon is theme.typography.pxToRem(24), NOT a hardcoded
    // 1.5rem — with this theme's typography.fontSize:12 that resolves to
    // ~1.286rem. flexShrink/userSelect/display mirror MUI's SvgIcon root.
    width: theme.typography.pxToRem(24),
    height: theme.typography.pxToRem(24),
    display: 'inline-block',
    flexShrink: 0,
    userSelect: 'none',
    fill: 'currentColor',
    pointerEvents: 'none',
  },
}))

export default function CheckboxLite({
  checked,
  onChange,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  className?: string
}) {
  const { classes, cx } = useStyles()
  return (
    <span
      className={cx(
        classes.root,
        checked ? classes.checked : undefined,
        disabled ? classes.disabled : undefined,
        className,
      )}
    >
      <input
        type="checkbox"
        className={classes.input}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <svg className={classes.svg} viewBox="0 0 24 24" aria-hidden>
        <path d={checked ? checkedPath : blankPath} />
      </svg>
    </span>
  )
}

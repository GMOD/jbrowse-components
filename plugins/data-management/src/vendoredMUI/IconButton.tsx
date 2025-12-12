import React, { memo } from 'react'
import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()(theme => ({
  root: {
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
    padding: 8,
    cursor: 'pointer',
    userSelect: 'none',
    verticalAlign: 'middle',
    textDecoration: 'none',
    color: theme.palette.action.active,
    borderRadius: '50%',
    overflow: 'visible',
    textAlign: 'center',
    flex: '0 0 auto',
    fontSize: '1.5rem',
  },
  disabled: {
    color: theme.palette.action.disabled,
    cursor: 'default',
  },
}))

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode
}

function IconButton({
  children,
  className,
  disabled,
  ...other
}: IconButtonProps) {
  const { classes, cx } = useStyles()

  return (
    <button
      type="button"
      className={cx(classes.root, disabled && classes.disabled, className)}
      disabled={disabled}
      {...other}
    >
      {children}
    </button>
  )
}

export default memo(IconButton)

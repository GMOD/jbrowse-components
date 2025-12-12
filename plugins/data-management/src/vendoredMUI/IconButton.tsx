import React, { forwardRef } from 'react'

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode
  color?: 'inherit' | 'default' | 'primary' | 'secondary'
  disabled?: boolean
  edge?: 'start' | 'end' | false
  size?: 'small' | 'medium' | 'large'
}

const baseStyle: React.CSSProperties = {
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
  borderRadius: '50%',
  cursor: 'pointer',
  userSelect: 'none',
  verticalAlign: 'middle',
  textDecoration: 'none',
  color: 'rgba(0, 0, 0, 0.54)',
  textAlign: 'center',
  flex: '0 0 auto',
}

const sizeStyles: Record<string, React.CSSProperties> = {
  small: { padding: 5, fontSize: '1.125rem' },
  medium: { padding: 8, fontSize: '1.5rem' },
  large: { padding: 12, fontSize: '1.75rem' },
}

const colorStyles: Record<string, string> = {
  inherit: 'inherit',
  default: 'rgba(0, 0, 0, 0.54)',
  primary: '#1976d2',
  secondary: '#9c27b0',
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      children,
      className,
      color = 'default',
      disabled = false,
      edge = false,
      size = 'medium',
      style,
      ...other
    },
    ref,
  ) {
    const sizeStyle = sizeStyles[size]

    let marginStyle: React.CSSProperties = {}
    if (edge === 'start') {
      marginStyle = { marginLeft: size === 'small' ? -3 : -12 }
    } else if (edge === 'end') {
      marginStyle = { marginRight: size === 'small' ? -3 : -12 }
    }

    return (
      <button
        ref={ref}
        type="button"
        className={className}
        disabled={disabled}
        style={{
          ...baseStyle,
          ...sizeStyle,
          ...marginStyle,
          color: colorStyles[color],
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.38 : 1,
          pointerEvents: disabled ? 'none' : undefined,
          ...style,
        }}
        {...other}
      >
        {children}
      </button>
    )
  },
)

export default IconButton

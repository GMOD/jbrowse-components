import PropTypes from 'prop-types'
import React, { HTMLAttributes, ReactChild } from 'react'

export interface ThingProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactChild
}

// Please do not use types off of a default export module or else Storybook Docs will suffer.
// see: https://github.com/storybookjs/storybook/issues/9556
export function Thing({ children }: ThingProps) {
  return <div>{children || `the snozzberries taste like snozzberries`}</div>
}
Thing.propTypes = {
  children: PropTypes.node,
}
Thing.defaultProps = {
  children: undefined,
}

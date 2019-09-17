import { StylesProvider } from '@material-ui/styles'
import React from 'react'

const react = jest.requireActual('@testing-library/react')
const generateClassName = (rule, styleSheet) =>
  `${styleSheet.options.classNamePrefix}-${rule.key}`
const render = args => {
  return react.render(
    <StylesProvider generateClassName={generateClassName}>
      {args}
    </StylesProvider>,
  )
}

module.exports = { ...react, render }

import React from 'react'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import Sanitize from './SanitizedHTML'

test('test basic escaping with bold', () => {
  const { getByText } = render(<Sanitize html="<b>Test</b" />)
  expect(getByText('Test')).toBeInTheDocument()
})

test('test escaping', () => {
  const { getByText } = render(<Sanitize html="<bb>Test</b" />)
  expect(getByText('<bb>Test</b')).toBeInTheDocument()
})

test('test <TRA>', () => {
  const { getByText } = render(<Sanitize html="<TRA><DEL><INS><DEL:ME>" />)
  expect(getByText('<TRA><DEL><INS><DEL:ME>')).toBeInTheDocument()
})

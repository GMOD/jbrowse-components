import { render } from '@testing-library/react'
import { test } from 'vitest'

import Sanitize from './SanitizedHTML'

test('test basic escaping with bold', () => {
  const { getByText } = render(<Sanitize html="<b>Test</b" />)
  getByText('Test')
})

test('test escaping', () => {
  const { getByText } = render(<Sanitize html="<bb>Test</b" />)
  getByText('<bb>Test</b')
})

test('test <TRA>', () => {
  const { getByText } = render(<Sanitize html="<TRA><DEL><INS><DEL:ME>" />)
  getByText('<TRA><DEL><INS><DEL:ME>')
})

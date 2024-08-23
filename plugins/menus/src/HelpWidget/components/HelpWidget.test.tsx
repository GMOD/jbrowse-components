import { test, expect } from 'vitest'
import { render } from '@testing-library/react'
import HelpWidget from './HelpWidget'

test('renders', () => {
  const { container } = render(<HelpWidget />)
  expect(container).toMatchSnapshot()
})

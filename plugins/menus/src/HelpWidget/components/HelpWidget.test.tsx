import { render } from '@testing-library/react'
import { expect, test } from 'vitest'

import HelpWidget from './HelpWidget'

test('renders', () => {
  const { container } = render(<HelpWidget />)
  expect(container).toMatchSnapshot()
})

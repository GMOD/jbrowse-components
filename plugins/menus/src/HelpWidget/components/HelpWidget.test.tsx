import { render } from '@testing-library/react'

import HelpWidget from './HelpWidget.tsx'

describe('<HelpWidget />', () => {
  it('renders', () => {
    const { container } = render(<HelpWidget />)
    expect(container).toMatchSnapshot()
  })
})

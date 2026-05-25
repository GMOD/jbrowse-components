import { render } from '@testing-library/react'

import '@testing-library/jest-dom'
import { HighlightText } from './FacetedSelector.tsx'

describe('HighlightText', () => {
  it('renders plain text without query', () => {
    const { getByText } = render(<HighlightText text="plain text" query="" />)
    expect(getByText('plain text')).toBeInTheDocument()
  })

  it('renders HTML without query', () => {
    const { container } = render(
      <HighlightText text="<i>italic</i>" query="" />,
    )
    expect(container.querySelector('i')).toBeInTheDocument()
    expect(container.querySelector('i')?.textContent).toBe('italic')
  })

  it('highlights plain text with query and check style', () => {
    const { container } = render(
      <HighlightText text="hello world" query="hello" />,
    )
    const mark = container.querySelector('mark')
    expect(mark).toBeInTheDocument()
    expect(mark).toHaveStyle('background: #FFEB3B')
    expect(container.textContent).toBe('hello world')
  })

  it('maintains HTML formatting when highlighting', () => {
    const { container } = render(
      <HighlightText text="<i>italic track</i>" query="track" />,
    )
    expect(container.querySelector('i')).toBeInTheDocument()
    expect(container.querySelector('mark')).toBeInTheDocument()
    expect(
      container.querySelector('i')?.contains(container.querySelector('mark')),
    ).toBe(true)
  })

  it('handles text with < correctly', () => {
    const { container } = render(<HighlightText text="1 < 2" query="1" />)
    expect(container.querySelector('mark')).toBeInTheDocument()
    expect(container.textContent).toBe('1 < 2')
  })
})

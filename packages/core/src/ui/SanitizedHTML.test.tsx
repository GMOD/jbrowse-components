import '@testing-library/jest-dom'

import { render, waitFor } from '@testing-library/react'

import Sanitize from './SanitizedHTML.tsx'
import { UnreachableContext } from './UnreachableContext.ts'

test('test basic escaping with bold', async () => {
  const { getByText } = render(<Sanitize html="<b>Test</b>" />)
  await waitFor(() => {
    expect(getByText('Test')).toBeInTheDocument()
  })
})

test('test escaping', async () => {
  const { getByText } = render(<Sanitize html="<bb>Test</bb>" />)
  await waitFor(() => {
    expect(getByText('<bb>Test</bb>')).toBeInTheDocument()
  })
})

test('test <TRA>', async () => {
  const { getByText } = render(<Sanitize html="<TRA><DEL><INS><DEL:ME>" />)
  await waitFor(() => {
    expect(getByText('<TRA><DEL><INS><DEL:ME>')).toBeInTheDocument()
  })
})

test('uses setHTML if available', () => {
  const setHTMLMock = jest.fn(function (this: HTMLElement, html: string) {
    this.innerHTML = html
  })
  // @ts-ignore
  const oldSetHTML = Element.prototype.setHTML
  // @ts-ignore
  Element.prototype.setHTML = setHTMLMock

  try {
    const { getByText } = render(<Sanitize html="<p>Using setHTML</p>" />)
    expect(getByText('Using setHTML')).toBeInTheDocument()
    expect(setHTMLMock).toHaveBeenCalledWith('<p>Using setHTML</p>')
  } finally {
    // @ts-ignore
    Element.prototype.setHTML = oldSetHTML
  }
})

test('adds rel and target to links when using setHTML', () => {
  const setHTMLMock = jest.fn(function (this: HTMLElement, html: string) {
    this.innerHTML = html
  })
  // @ts-ignore
  const oldSetHTML = Element.prototype.setHTML
  // @ts-ignore
  Element.prototype.setHTML = setHTMLMock

  try {
    const { getByRole } = render(
      <Sanitize html='<a href="https://google.com">Google</a>' />,
    )
    const link = getByRole('link')
    expect(link).toHaveAttribute('href', 'https://google.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  } finally {
    // @ts-ignore
    Element.prototype.setHTML = oldSetHTML
  }
})

test('falls back to dompurify if setHTML is unavailable', async () => {
  // Ensure setHTML is NOT present
  // @ts-ignore
  const oldSetHTML = Element.prototype.setHTML
  // @ts-ignore
  delete Element.prototype.setHTML

  try {
    const { getByText, getByRole } = render(
      <Sanitize html='<a href="https://google.com">Google</a>' />,
    )
    await waitFor(() => {
      expect(getByRole('link')).toBeInTheDocument()
    })
    const link = getByRole('link')
    expect(link).toHaveAttribute('href', 'https://google.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(getByText('Google')).toBeInTheDocument()
  } finally {
    // @ts-ignore
    Element.prototype.setHTML = oldSetHTML
  }
})

test('unwraps links to their text where the pointer cannot reach', () => {
  const setHTMLMock = jest.fn(function (this: HTMLElement, html: string) {
    this.innerHTML = html
  })
  // @ts-ignore
  const oldSetHTML = Element.prototype.setHTML
  // @ts-ignore
  Element.prototype.setHTML = setHTMLMock

  try {
    const { getByText, queryByRole } = render(
      <UnreachableContext value>
        <Sanitize html='ID: <a href="https://example.com/x">EH38E1</a>' />
      </UnreachableContext>,
    )
    expect(queryByRole('link')).toBeNull()
    expect(getByText('ID: EH38E1')).toBeInTheDocument()
  } finally {
    // @ts-ignore
    Element.prototype.setHTML = oldSetHTML
  }
})

test('unwraps links on the dompurify path where the pointer cannot reach', async () => {
  // @ts-ignore
  const oldSetHTML = Element.prototype.setHTML
  // @ts-ignore
  delete Element.prototype.setHTML

  try {
    const { findByText, queryByRole } = render(
      <UnreachableContext value>
        <Sanitize html='ID: <a href="https://example.com/x">EH38E1</a>' />
      </UnreachableContext>,
    )
    expect(await findByText('ID: EH38E1')).toBeInTheDocument()
    expect(queryByRole('link')).toBeNull()
  } finally {
    // @ts-ignore
    Element.prototype.setHTML = oldSetHTML
  }
})

test('does not linkify a bare url where the pointer cannot reach', async () => {
  const { findByText, queryByRole } = render(
    <UnreachableContext value>
      <Sanitize html="see https://example.com/x" />
    </UnreachableContext>,
  )
  expect(await findByText('see https://example.com/x')).toBeInTheDocument()
  expect(queryByRole('link')).toBeNull()
})

import {
  MAX_LABEL_LENGTH,
  getAccountLabel,
  shorten,
} from './SourceTypeSelector.tsx'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes/index.ts'

describe('shorten', () => {
  test('returns string unchanged if shorter than MAX_LABEL_LENGTH', () => {
    expect(shorten('abc')).toBe('abc')
    expect(shorten('12345')).toBe('12345')
  })

  test('truncates and adds ellipsis if longer than MAX_LABEL_LENGTH', () => {
    expect(shorten('123456')).toBe('12345…')
    expect(shorten('very long string')).toBe('very …')
  })

  test('handles empty string', () => {
    expect(shorten('')).toBe('')
  })

  test('handles exactly MAX_LABEL_LENGTH', () => {
    const str = 'a'.repeat(MAX_LABEL_LENGTH)
    expect(shorten(str)).toBe(str)
  })
})

describe('getAccountLabel', () => {
  test('returns shortened toggleContents if string', () => {
    const account = {
      toggleContents: 'GoogleDrive',
      name: 'Google Drive Account',
    } as BaseInternetAccountModel
    expect(getAccountLabel(account)).toBe('Googl…')
  })

  test('returns toggleContents directly if not a string (React node)', () => {
    const icon = { type: 'svg' } // mock React element
    const account = {
      toggleContents: icon,
      name: 'Google Drive Account',
    } as unknown as BaseInternetAccountModel
    expect(getAccountLabel(account)).toBe(icon)
  })

  test('returns shortened name if no toggleContents', () => {
    const account = {
      toggleContents: undefined,
      name: 'Dropbox Account',
    } as BaseInternetAccountModel
    expect(getAccountLabel(account)).toBe('Dropb…')
  })

  test('falls back to name if toggleContents is empty string', () => {
    const account = {
      toggleContents: '',
      name: 'OneDrive',
    } as BaseInternetAccountModel
    expect(getAccountLabel(account)).toBe('OneDr…')
  })

  test('returns short name unchanged', () => {
    const account = {
      toggleContents: undefined,
      name: 'Box',
    } as BaseInternetAccountModel
    expect(getAccountLabel(account)).toBe('Box')
  })
})

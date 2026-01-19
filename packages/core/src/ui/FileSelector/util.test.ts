import {
  MAX_LABEL_LENGTH,
  addAccountToLocation,
  getAccountLabel,
  getInitialSourceType,
  shorten,
} from './util.ts'

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

describe('getInitialSourceType', () => {
  test('returns internetAccountId when location has one', () => {
    const location = {
      locationType: 'UriLocation' as const,
      uri: 'https://example.com/file.bam',
      internetAccountId: 'google-drive-account',
    }
    expect(getInitialSourceType(location)).toBe('google-drive-account')
  })

  test('returns "url" for UriLocation without internetAccountId', () => {
    const location = {
      locationType: 'UriLocation' as const,
      uri: 'https://example.com/file.bam',
    }
    expect(getInitialSourceType(location)).toBe('url')
  })

  test('returns "url" for undefined location', () => {
    expect(getInitialSourceType(undefined)).toBe('url')
  })

  test('returns "file" for BlobLocation', () => {
    const location = {
      locationType: 'BlobLocation' as const,
      blobId: 'b123',
      name: 'test.bam',
    }
    expect(getInitialSourceType(location)).toBe('file')
  })

  test('returns "file" for FileHandleLocation', () => {
    const location = {
      locationType: 'FileHandleLocation' as const,
      handleId: 'fh123',
      name: 'test.bam',
    }
    expect(getInitialSourceType(location)).toBe('file')
  })

  test('returns "file" for LocalPathLocation', () => {
    const location = {
      locationType: 'LocalPathLocation' as const,
      localPath: '/path/to/file.bam',
    }
    expect(getInitialSourceType(location)).toBe('file')
  })
})

describe('addAccountToLocation', () => {
  const mockAccount = {
    internetAccountId: 'test-account-id',
  } as BaseInternetAccountModel

  test('adds internetAccountId to UriLocation', () => {
    const location = {
      locationType: 'UriLocation' as const,
      uri: 'https://example.com/file.bam',
    }
    const result = addAccountToLocation(location, mockAccount)
    expect(result).toEqual({
      locationType: 'UriLocation',
      uri: 'https://example.com/file.bam',
      internetAccountId: 'test-account-id',
    })
  })

  test('returns location unchanged when no account provided', () => {
    const location = {
      locationType: 'UriLocation' as const,
      uri: 'https://example.com/file.bam',
    }
    const result = addAccountToLocation(location, undefined)
    expect(result).toEqual(location)
  })

  test('returns non-UriLocation unchanged even with account', () => {
    const location = {
      locationType: 'BlobLocation' as const,
      blobId: 'b123',
      name: 'test.bam',
    }
    const result = addAccountToLocation(location, mockAccount)
    expect(result).toEqual(location)
  })
})

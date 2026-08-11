import {
  MAX_LABEL_LENGTH,
  addAccountToLocation,
  dirFromPath,
  getAccountLabel,
  getInitialSourceType,
  isAdminMode,
  truncateLabel,
} from './util.ts'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes/index.ts'

describe('truncateLabel', () => {
  test('returns string unchanged if shorter than MAX_LABEL_LENGTH', () => {
    expect(truncateLabel('abc')).toBe('abc')
    expect(truncateLabel('12345')).toBe('12345')
  })

  test('truncates and adds ellipsis if longer than MAX_LABEL_LENGTH', () => {
    expect(truncateLabel('123456')).toBe('12345…')
    expect(truncateLabel('very long string')).toBe('very …')
  })

  test('handles empty string', () => {
    expect(truncateLabel('')).toBe('')
  })

  test('handles exactly MAX_LABEL_LENGTH', () => {
    const str = 'a'.repeat(MAX_LABEL_LENGTH)
    expect(truncateLabel(str)).toBe(str)
  })
})

describe('isAdminMode', () => {
  const setUrl = (rest: string) => {
    window.history.replaceState(null, '', `${window.location.pathname}${rest}`)
  }
  afterEach(() => {
    setUrl('')
  })

  test('reads adminKey from the query string', () => {
    setUrl('?config=foo.json&adminKey=abc')
    expect(isAdminMode()).toBe(true)
  })

  // jbrowse-web's long/json share modes relocate every param into the hash, and
  // its loader reads adminKey from there; this must agree with it
  test('reads adminKey from the hash when the URL keeps its params there', () => {
    setUrl('#config=foo.json&adminKey=abc')
    expect(isAdminMode()).toBe(true)
  })

  test('false with no adminKey in either place', () => {
    setUrl('?config=foo.json#section')
    expect(isAdminMode()).toBe(false)
  })

  // hash XOR search: once the hash holds params, only the hash is read
  test('ignores a query-string adminKey when the params live in the hash', () => {
    setUrl('?adminKey=abc#config=foo.json')
    expect(isAdminMode()).toBe(false)
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

describe('dirFromPath', () => {
  test('unix path', () => {
    expect(dirFromPath('/home/user/data/file.bam')).toBe('/home/user/data')
  })

  test('windows path', () => {
    expect(dirFromPath(String.raw`C:\Users\user\data\file.bam`)).toBe(
      String.raw`C:\Users\user\data`,
    )
  })

  test('filename only returns undefined', () => {
    expect(dirFromPath('file.bam')).toBeUndefined()
  })

  // A root is the one directory whose separator is part of its name. Dropping
  // it leaves `C:`, which Windows reads as "the current directory on drive C"
  // rather than the root — and a data drive is exactly where a file sits at the
  // root of its volume.
  test('file at a windows drive root keeps the separator', () => {
    expect(dirFromPath(String.raw`C:\reads.bam`)).toBe('C:\\')
  })

  test('file at posix root keeps the separator', () => {
    expect(dirFromPath('/file.bam')).toBe('/')
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

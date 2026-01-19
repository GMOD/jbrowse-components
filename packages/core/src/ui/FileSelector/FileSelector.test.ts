import { addAccountToLocation, getInitialSourceType } from './FileSelector.tsx'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes/index.ts'

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

import path from 'node:path'

import {
  sanitizeForFilename,
  trixFileNames,
  trixFilePaths,
  trixFileUris,
} from './trixPaths.ts'

describe('sanitizeForFilename', () => {
  it('replaces forward slash with underscore', () => {
    expect(sanitizeForFilename('test_a/b-index')).toBe('test_a_b-index')
  })
  it('replaces all Windows-invalid characters', () => {
    expect(sanitizeForFilename(String.raw`a\b/c:d*e?f"g<h>i|j`)).toBe(
      'a_b_c_d_e_f_g_h_i_j',
    )
  })
  it('leaves safe characters unchanged', () => {
    expect(sanitizeForFilename('track-name_1234.index')).toBe(
      'track-name_1234.index',
    )
  })
  it('escapes Windows reserved device names', () => {
    expect(sanitizeForFilename('NUL')).toBe('_NUL')
    expect(sanitizeForFilename('con')).toBe('_con')
    expect(sanitizeForFilename('COM1')).toBe('_COM1')
    // reserved word as a substring is fine
    expect(sanitizeForFilename('NULsomething')).toBe('NULsomething')
  })
  it('strips trailing dots and spaces', () => {
    expect(sanitizeForFilename('assembly. ')).toBe('assembly')
  })
})

// The three artifacts have to agree on one spelling of the name: the writer and
// the config that points at what it wrote are different files in different
// packages, and when only one of them sanitized the index landed where nothing
// looked for it.
test('the three artifacts share one sanitized stem', () => {
  const { ix, ixx, meta } = trixFileNames('test_a/b-1234')
  expect({ ix, ixx, meta }).toEqual({
    ix: 'test_a_b-1234.ix',
    ixx: 'test_a_b-1234.ixx',
    meta: 'test_a_b-1234_meta.json',
  })
})

test('filesystem paths land under <outDir>/trix', () => {
  expect(trixFilePaths('/some/dir', 'volvox-index')).toEqual({
    ix: path.join('/some/dir', 'trix', 'volvox-index.ix'),
    ixx: path.join('/some/dir', 'trix', 'volvox-index.ixx'),
    meta: path.join('/some/dir', 'trix', 'volvox-index_meta.json'),
  })
})

// a URI keeps forward slashes wherever it is generated; path.join would emit
// backslashes on Windows and the config would not resolve
test('uris are slash-joined rather than path-joined', () => {
  expect(trixFileUris('volvox-index')).toEqual({
    ix: 'trix/volvox-index.ix',
    ixx: 'trix/volvox-index.ixx',
    meta: 'trix/volvox-index_meta.json',
  })
})

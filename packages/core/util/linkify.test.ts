import { linkify } from './linkify'

test('converts http URL to anchor tag', () => {
  expect(linkify('Visit http://example.com today')).toBe(
    'Visit <a href=\'http://example.com\' target="_blank">http://example.com</a> today',
  )
})

test('converts https URL to anchor tag', () => {
  expect(linkify('Visit https://example.com today')).toBe(
    'Visit <a href=\'https://example.com\' target="_blank">https://example.com</a> today',
  )
})

test('converts ftp URL to anchor tag', () => {
  expect(linkify('Download from ftp://files.example.com/file.txt')).toBe(
    'Download from <a href=\'ftp://files.example.com/file.txt\' target="_blank">ftp://files.example.com/file.txt</a>',
  )
})

test('handles URL at start of string', () => {
  expect(linkify('https://example.com is a website')).toBe(
    '<a href=\'https://example.com\' target="_blank">https://example.com</a> is a website',
  )
})

test('handles URL at end of string', () => {
  expect(linkify('Check out https://example.com')).toBe(
    'Check out <a href=\'https://example.com\' target="_blank">https://example.com</a>',
  )
})

test('handles multiple URLs', () => {
  expect(linkify('Visit https://a.com and https://b.com')).toBe(
    'Visit <a href=\'https://a.com\' target="_blank">https://a.com</a> and <a href=\'https://b.com\' target="_blank">https://b.com</a>',
  )
})

test('handles URL with path', () => {
  expect(linkify('See https://example.com/path/to/page')).toBe(
    'See <a href=\'https://example.com/path/to/page\' target="_blank">https://example.com/path/to/page</a>',
  )
})

test('handles URL with query parameters', () => {
  expect(linkify('Link: https://example.com/search?q=test&page=1')).toBe(
    'Link: <a href=\'https://example.com/search?q=test&page=1\' target="_blank">https://example.com/search?q=test&page=1</a>',
  )
})

test('handles URL with fragment', () => {
  expect(linkify('See https://example.com/page#section')).toBe(
    'See <a href=\'https://example.com/page#section\' target="_blank">https://example.com/page#section</a>',
  )
})

test('handles URL with port number', () => {
  expect(linkify('Server at http://localhost:8080/api')).toBe(
    'Server at <a href=\'http://localhost:8080/api\' target="_blank">http://localhost:8080/api</a>',
  )
})

test('handles URL with authentication', () => {
  expect(linkify('Login at https://user@example.com')).toBe(
    'Login at <a href=\'https://user@example.com\' target="_blank">https://user@example.com</a>',
  )
})

test('handles URL after newline', () => {
  expect(linkify('Line 1\nhttps://example.com')).toBe(
    'Line 1\n<a href=\'https://example.com\' target="_blank">https://example.com</a>',
  )
})

test('handles URL after HTML tag', () => {
  expect(linkify('<br/>https://example.com')).toBe(
    '<br/><a href=\'https://example.com\' target="_blank">https://example.com</a>',
  )
})

test('handles URL after self-closing tag', () => {
  expect(linkify('<p>https://example.com')).toBe(
    '<p><a href=\'https://example.com\' target="_blank">https://example.com</a>',
  )
})

test('returns string unchanged when no URLs present', () => {
  expect(linkify('Just some plain text')).toBe('Just some plain text')
})

test('handles empty string', () => {
  expect(linkify('')).toBe('')
})

test('preserves surrounding text', () => {
  expect(linkify('Before https://example.com after')).toBe(
    'Before <a href=\'https://example.com\' target="_blank">https://example.com</a> after',
  )
})

test('handles URL with special characters', () => {
  expect(linkify('URL: https://example.com/path?name=test&value=123')).toBe(
    'URL: <a href=\'https://example.com/path?name=test&value=123\' target="_blank">https://example.com/path?name=test&value=123</a>',
  )
})

test('handles URL with parentheses', () => {
  expect(
    linkify('See https://en.wikipedia.org/wiki/Test_(disambiguation)'),
  ).toBe(
    'See <a href=\'https://en.wikipedia.org/wiki/Test_(disambiguation)\' target="_blank">https://en.wikipedia.org/wiki/Test_(disambiguation)</a>',
  )
})

test('handles URL with tilde', () => {
  expect(linkify('User page: https://example.com/~user')).toBe(
    'User page: <a href=\'https://example.com/~user\' target="_blank">https://example.com/~user</a>',
  )
})

test('handles URL with plus sign', () => {
  expect(linkify('Search: https://google.com/search?q=a+b')).toBe(
    'Search: <a href=\'https://google.com/search?q=a+b\' target="_blank">https://google.com/search?q=a+b</a>',
  )
})

test('handles consecutive calls correctly', () => {
  expect(linkify('https://a.com')).toBe(
    '<a href=\'https://a.com\' target="_blank">https://a.com</a>',
  )
  expect(linkify('https://b.com')).toBe(
    '<a href=\'https://b.com\' target="_blank">https://b.com</a>',
  )
})

test('does not linkify partial URLs without protocol', () => {
  expect(linkify('Visit example.com today')).toBe('Visit example.com today')
})

test('does not linkify javascript: protocol', () => {
  expect(linkify('javascript:alert(1)')).toBe('javascript:alert(1)')
})

test('handles bioinformatics URLs', () => {
  expect(linkify('NCBI: https://www.ncbi.nlm.nih.gov/gene/672')).toBe(
    'NCBI: <a href=\'https://www.ncbi.nlm.nih.gov/gene/672\' target="_blank">https://www.ncbi.nlm.nih.gov/gene/672</a>',
  )
})

test('handles URLs in genomic context', () => {
  const text =
    'Gene info at https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=chr17:43044295-43125483'
  expect(linkify(text)).toContain("href='https://genome.ucsc.edu")
  expect(linkify(text)).toContain('target="_blank"')
})

test('handles URL followed by punctuation that should not be included', () => {
  expect(linkify('See https://example.com.')).toBe(
    'See <a href=\'https://example.com\' target="_blank">https://example.com</a>.',
  )
})

test('handles URL followed by comma', () => {
  expect(linkify('Check https://a.com, https://b.com')).toBe(
    'Check <a href=\'https://a.com\' target="_blank">https://a.com</a>, <a href=\'https://b.com\' target="_blank">https://b.com</a>',
  )
})

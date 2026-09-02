import { parseArgs } from './args.ts'

test('a typical invocation', () => {
  const args = parseArgs([
    '--hub',
    'hg38',
    '--loc',
    'BRCA1',
    '--track',
    'hg38-ncbiRefSeqCurated',
    '--track',
    'hg38-clinvarMain',
    '-o',
    'out.png',
  ])
  expect(args.hub).toBe('hg38')
  expect(args.loc).toBe('BRCA1')
  expect(args.tracks).toEqual(['hg38-ncbiRefSeqCurated', 'hg38-clinvarMain'])
  expect(args.out).toBe('out.png')
})

test('--name=value and flags', () => {
  const args = parseArgs(['--width=1600', '--headed', '--fullPage'])
  expect(args.width).toBe(1600)
  expect(args.headed).toBe(true)
  expect(args.fullPage).toBe(true)
  expect(args.verbose).toBe(false)
})

test('a locstring with a leading dash is still a value', () => {
  // `--loc -1:100-200` would be read as a flag if values were sniffed for a
  // leading dash rather than taken positionally
  expect(parseArgs(['--loc', '-1:100-200']).loc).toBe('-1:100-200')
})

test('an unknown flag is an error, not a silent no-op', () => {
  expect(() => parseArgs(['--tracks', 'a,b'])).toThrow(
    'unknown flag "--tracks"',
  )
})

test('a missing value is an error', () => {
  expect(() => parseArgs(['--hub'])).toThrow('--hub needs a value')
})

test('a non-numeric size is an error', () => {
  expect(() => parseArgs(['--width', 'wide'])).toThrow(
    '--width needs a number, got "wide"',
  )
})

// `--fullPage=false` used to set the flag TRUE: the flags branch never looked
// past the name, so the one spelling a user reaches for to turn a flag off was
// the one that silently turned it on.
test('a value handed to a flag is an error, not true', () => {
  expect(() => parseArgs(['--fullPage=false'])).toThrow(
    '--fullPage is a flag and takes no value',
  )
})

test('a zero or negative viewport dimension is an error', () => {
  expect(() => parseArgs(['--scale', '0'])).toThrow(
    '--scale needs a positive number, got "0"',
  )
  expect(() => parseArgs(['--width', '-5'])).toThrow(
    '--width needs a positive number, got "-5"',
  )
  // zero is a meaningful timeout/settle, so those two stay unconstrained
  expect(parseArgs(['--settle', '0']).settle).toBe(0)
})

test('a bare positional is an error', () => {
  expect(() => parseArgs(['hg38'])).toThrow('unexpected argument "hg38"')
})

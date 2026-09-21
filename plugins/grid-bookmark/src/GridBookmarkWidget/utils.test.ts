import { downloadHighlightFile, parseHighlights } from './utils.ts'

// jsdom's Blob implements only slice/size/type (jsdom/jsdom#2555);
// `config/jest/blob.js` fills `text()` off its FileReader.
const readBlobText = (blob: Blob) => blob.text()

const mockSaveAs = jest.fn((_blob: Blob, _name: string) => {})

// Factory is hoisted, so reference mockSaveAs lazily via a wrapper to avoid
// the const TDZ at factory-eval time.
jest.mock('@jbrowse/core/util/FileSaver', () => ({
  __esModule: true,
  saveAs: (blob: Blob, name: string) => {
    mockSaveAs(blob, name)
  },
}))

const sampleHighlights = [
  {
    refName: 'ctgA',
    start: 100,
    end: 200,
    label: 'first',
    assemblyName: 'volvox',
  },
  {
    refName: 'ctgA',
    start: 300,
    end: 400,
    label: undefined,
    assemblyName: 'volvox',
  },
  {
    refName: 'ctgB',
    start: 50,
    end: 60,
    label: 'other-asm',
    assemblyName: 'hg38',
  },
]

beforeEach(() => {
  mockSaveAs.mockClear()
})

test('BED export writes one file per assembly, omits header, uses . for empty labels', async () => {
  await downloadHighlightFile('BED', sampleHighlights)
  expect(mockSaveAs).toHaveBeenCalledTimes(2)
  const byName = Object.fromEntries(
    mockSaveAs.mock.calls.map(([blob, name]) => [name, blob]),
  )

  expect(await readBlobText(byName['jbrowse_highlights_volvox.bed']!)).toBe(
    'ctgA\t100\t200\tfirst\nctgA\t300\t400\t.\n',
  )
  expect(await readBlobText(byName['jbrowse_highlights_hg38.bed']!)).toBe(
    'ctgB\t50\t60\tother-asm\n',
  )
})

test('TSV export concatenates all assemblies into one file with header and 1-based starts', async () => {
  await downloadHighlightFile('TSV', sampleHighlights)
  expect(mockSaveAs).toHaveBeenCalledTimes(1)
  const [blob, name] = mockSaveAs.mock.calls[0]!
  expect(name).toBe('jbrowse_highlights.tsv')
  expect(await readBlobText(blob)).toBe(
    'chrom\tstart\tend\tlabel\tassembly_name\tcoord_range\n' +
      'ctgA\t101\t200\tfirst\tvolvox\t{volvox}ctgA:101..200\n' +
      'ctgA\t301\t400\t.\tvolvox\t{volvox}ctgA:301..400\n' +
      'ctgB\t51\t60\tother-asm\thg38\t{hg38}ctgB:51..60\n',
  )
})

test('BED import is 0-based and adopts the chosen assembly, . means no label', () => {
  expect(
    parseHighlights('ctgA\t100\t200\tfirst\nctgA\t300\t400\t.\n', 'volvox'),
  ).toEqual([
    {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 100,
      end: 200,
      label: 'first',
    },
    {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 300,
      end: 400,
      label: undefined,
    },
  ])
})

test('TSV import converts 1-based starts back to 0-based and uses its own assembly', () => {
  const tsv =
    'chrom\tstart\tend\tlabel\tassembly_name\tcoord_range\n' +
    'ctgA\t101\t200\tfirst\tvolvox\t{volvox}ctgA:101..200\n' +
    'ctgB\t51\t60\tother-asm\thg38\t{hg38}ctgB:51..60\n'
  expect(parseHighlights(tsv, 'ignored')).toEqual([
    {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 100,
      end: 200,
      label: 'first',
    },
    {
      assemblyName: 'hg38',
      refName: 'ctgB',
      start: 50,
      end: 60,
      label: 'other-asm',
    },
  ])
})

test('TSV export then import round-trips coordinates', async () => {
  await downloadHighlightFile('TSV', sampleHighlights)
  const exported = await readBlobText(mockSaveAs.mock.calls[0]![0])
  const parsed = parseHighlights(exported, 'ignored')
  expect(parsed.map(b => ({ start: b.start, end: b.end }))).toEqual(
    sampleHighlights.map(b => ({ start: b.start, end: b.end })),
  )
})

test('import skips comment lines and throws on malformed coordinates', () => {
  expect(parseHighlights('# a comment\nctgA\t10\t20\tok\n', 'volvox')).toEqual([
    {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 10,
      end: 20,
      label: 'ok',
    },
  ])
  expect(() => parseHighlights('ctgA\tnotanumber\t20\n', 'volvox')).toThrow(
    /Invalid start/,
  )
  expect(() => parseHighlights('ctgA\t\t20\n', 'volvox')).toThrow(
    /Invalid start/,
  )
})

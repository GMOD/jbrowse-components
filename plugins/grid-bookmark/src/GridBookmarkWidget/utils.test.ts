import { downloadBookmarkFile } from './utils.ts'

import type { GridBookmarkModel } from './model.ts'

const mockSaveAs = jest.fn<void, [Blob, string]>()

// Factory is hoisted, so reference mockSaveAs lazily via a wrapper to avoid
// the const TDZ at factory-eval time.
jest.mock('@jbrowse/core/util/FileSaver', () => ({
  __esModule: true,
  saveAs: (blob: Blob, name: string) => mockSaveAs(blob, name),
}))

// jsdom's Blob does not implement Blob.prototype.text() — only slice/size/type
// are present (see jsdom/jsdom#2555). FileReader is fully implemented though.
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('FileReader error'))
    }
    reader.readAsText(blob)
  })
}

const sampleBookmarks = [
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
    label: '',
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

function makeModel(selected: typeof sampleBookmarks = []) {
  return {
    selectedBookmarks: selected,
    bookmarksWithValidAssemblies: sampleBookmarks,
  } as unknown as GridBookmarkModel
}

beforeEach(() => {
  mockSaveAs.mockClear()
})

test('BED export writes one file per assembly, omits header, uses . for empty labels', async () => {
  await downloadBookmarkFile('BED', makeModel())
  expect(mockSaveAs).toHaveBeenCalledTimes(2)
  const byName = Object.fromEntries(
    mockSaveAs.mock.calls.map(([blob, name]) => [name, blob]),
  )

  expect(await readBlob(byName['jbrowse_bookmarks_volvox.bed']!)).toBe(
    'ctgA\t100\t200\tfirst\nctgA\t300\t400\t.\n',
  )
  expect(await readBlob(byName['jbrowse_bookmarks_hg38.bed']!)).toBe(
    'ctgB\t50\t60\tother-asm\n',
  )
})

test('TSV export concatenates all assemblies into one file with header and 1-based starts', async () => {
  await downloadBookmarkFile('TSV', makeModel())
  expect(mockSaveAs).toHaveBeenCalledTimes(1)
  const [blob, name] = mockSaveAs.mock.calls[0]!
  expect(name).toBe('jbrowse_bookmarks.tsv')
  expect(await readBlob(blob)).toBe(
    'chrom\tstart\tend\tlabel\tassembly_name\tcoord_range\n' +
      'ctgA\t101\t200\tfirst\tvolvox\t{volvox}ctgA:101..200\n' +
      'ctgA\t301\t400\t.\tvolvox\t{volvox}ctgA:301..400\n' +
      'ctgB\t51\t60\tother-asm\thg38\t{hg38}ctgB:51..60\n',
  )
})

test('only selected bookmarks are exported when selection is non-empty', async () => {
  await downloadBookmarkFile(
    'TSV',
    makeModel([sampleBookmarks[0]!, sampleBookmarks[2]!]),
  )
  const text = await readBlob(mockSaveAs.mock.calls[0]![0])
  expect(text).toContain('ctgA\t101\t200\tfirst')
  expect(text).toContain('ctgB\t51\t60\tother-asm')
  expect(text).not.toContain('300\t400')
})

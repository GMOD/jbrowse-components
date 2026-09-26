import {
  adapterTypesToTrackTypeMap,
  formats,
  matchFormat,
} from '@jbrowse/add-track-core'

import {
  adapterTypes,
  applyPrimaryFile,
  classifyAssemblyFiles,
  formHasSequence,
  getAdapterConfig,
  initialFormState,
} from './assemblyConfigUtils.ts'
import { adapterConfigFromSpec } from './formatGuessers.ts'

import type { AdapterType } from './assemblyConfigUtils.ts'
import type { FileLocation } from './types/data.ts'

// `FastaAdapter` is the pane's own name for "a plain FASTA, index it for me" —
// an IndexedFastaAdapter on desktop, an UnindexedFastaAdapter on web. No
// format-table entry names it, so it is the one format left out below.
const pseudoTypes: AdapterType[] = ['FastaAdapter']

const tableTypes = adapterTypes.filter(t => !pseudoTypes.includes(t))

// The names a user types, not minimal regex witnesses: `.fas` and `.bgz` are
// here because each was once supported on only one of the two sides.
const samples: Partial<Record<AdapterType, string[]>> = {
  IndexedFastaAdapter: ['hg38.fa', 'hg38.fasta', 'hg38.fas', 'hg38.mfa'],
  BgzipFastaAdapter: ['hg38.fa.gz', 'hg38.fasta.bgz', 'hg38.fna.gz'],
  TwoBitAdapter: ['hg38.2bit'],
  ChromSizesAdapter: ['hg38.chrom.sizes'],
}

const cases = Object.entries(samples).flatMap(([adapterType, names]) =>
  names.map(name => [name, adapterType as AdapterType] as const),
)

const base = 'https://example.com'

function uri(name: string): FileLocation {
  return { uri: `${base}/${name}`, locationType: 'UriLocation' }
}

// The files the table says a format comes with. Derived rather than written
// out, so the drop the pane is handed is the table's own account of the format.
function fileSet(name: string) {
  const spec = matchFormat(name)!.spec
  return [
    name,
    ...(spec.kind === 'sidecar'
      ? spec.sidecars.map(s => `${name}${s.suffix}`)
      : []),
  ].map(uri)
}

// A sequence format added to the table and not to the pane is the divergence
// with no symptom: the file opens as a track and the genome it names cannot be
// added. `#trackType` is what says a format carries an assembly's bases.
test("the pane offers the table's sequence formats and no others", () => {
  const sequenceFormats = formats.flatMap(f =>
    'adapterType' in f.spec &&
    adapterTypesToTrackTypeMap[f.spec.adapterType] === 'ReferenceSequenceTrack'
      ? [f.spec.adapterType]
      : [],
  )
  expect(sequenceFormats.sort()).toEqual([...tableTypes].sort())
})

test('every format the pane offers has a sample filename', () => {
  expect(tableTypes.filter(t => !samples[t])).toEqual([])
})

// The pane states each format's layout a second time — the field the data file
// goes in, the sidecars it needs, each sidecar's extension, the extensions that
// name the format at all — so compare what the two write rather than that they
// share a table, which they don't. Its two ways in read different halves of
// that statement: picking one file derives the sidecars by convention, dropping
// a whole set places each file by name.

test.each(cases)(
  'a chosen %s is placed and indexed as the table says',
  name => {
    const [primary] = fileSet(name)
    const form = applyPrimaryFile(initialFormState(), primary!)
    expect(formHasSequence(form)).toBe(true)
    expect(getAdapterConfig(form)).toEqual({
      kind: 'ready',
      adapter: adapterConfigFromSpec(matchFormat(name)!.spec, primary!),
    })
  },
)

test.each(cases)(
  "a dropped %s set builds the table's config",
  (name, adapterType) => {
    const [primary, ...rest] = fileSet(name)
    const form = {
      ...initialFormState(),
      ...classifyAssemblyFiles([primary!, ...rest]),
    }
    expect(form.adapterSelection).toBe(adapterType)
    expect(getAdapterConfig(form)).toEqual({
      kind: 'ready',
      adapter: adapterConfigFromSpec(matchFormat(name)!.spec, primary!),
    })
  },
)

test('the pseudo-type is in no table and asks to be indexed', () => {
  expect(pseudoTypes.filter(t => matchFormat('', t))).toEqual([])
  const form = {
    ...initialFormState(),
    ...classifyAssemblyFiles([uri('hg38.fa')]),
  }
  expect(form.adapterSelection).toBe('FastaAdapter')
  expect(getAdapterConfig(form).kind).toBe('needsFastaIndex')
})

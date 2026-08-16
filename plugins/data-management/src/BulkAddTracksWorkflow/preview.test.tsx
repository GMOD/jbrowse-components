import GWAS from '@jbrowse/plugin-gwas'

import { summarizeBulkInput } from './preview.ts'
import { fakeAddTrackComponentPlugin, makeModel, uri } from './testUtils.tsx'

import type Plugin from '@jbrowse/core/Plugin'
import type { FileLocation } from '@jbrowse/core/util/types'

// summarizeBulkInput expects an already-deduped location list (the workflow
// dedupes via useBulkLocations before calling it).
function summarize(locations: FileLocation[], extraPlugins: Plugin[] = []) {
  return summarizeBulkInput({
    locations,
    model: makeModel(extraPlugins),
    assembly: 'volvox',
  })
}

test('pairs a data file with its index: one addable track, no orphans', () => {
  const { rows, orphanIndexCount, skippedCount } = summarize([
    uri('/a.bam'),
    uri('/a.bam.bai'),
  ])
  expect(rows).toHaveLength(1)
  expect(rows[0]!.status).toBe('ok')
  expect(orphanIndexCount).toBe(0)
  expect(skippedCount).toBe(0)
})

test('an index with no matching data file is counted as an orphan', () => {
  const { rows, orphanIndexCount } = summarize([uri('/orphan.tbi')])
  expect(rows).toHaveLength(0)
  expect(orphanIndexCount).toBe(1)
})

// the count used to be (index files pasted) - (index files paired), so any data
// file offered a second sidecar reported one as having "no matching data file"
test('a second sidecar for one data file is not counted as an orphan', () => {
  const { rows, orphanIndexCount } = summarize([
    uri('/a.bam'),
    uri('/a.bam.bai'),
    uri('/a.bam.csi'),
  ])
  expect(rows).toHaveLength(1)
  expect(orphanIndexCount).toBe(0)
})

test('an index whose kind fits no data file present is still an orphan', () => {
  const { orphanIndexCount } = summarize([uri('/s.bam'), uri('/s.tbi')])
  expect(orphanIndexCount).toBe(1)
})

test('an unrecognized extension is a skipped row, not addable', () => {
  const { rows, skippedCount } = summarize([uri('/mystery.qqq')])
  expect(rows).toHaveLength(1)
  expect(rows[0]!.status).toBe('unknown')
  expect(skippedCount).toBe(1)
})

// a synteny file guesses to a real adapter and track type, so it used to be
// counted as addable — and was then added with one assemblyNames entry and no
// assembly pair, which filterTracks never offers in the view it was made for
describe('formats whose add-track form contributes required config', () => {
  const claimsBam = [fakeAddTrackComponentPlugin(['BamAdapter'])]

  test('are held back rather than added half-configured', () => {
    const { rows, needsSetupCount, skippedCount } = summarize(
      [uri('/a.bam')],
      claimsBam,
    )
    expect(rows[0]!.status).toBe('needsSetup')
    expect(needsSetupCount).toBe(1)
    // not "unrecognized" — the type was read fine
    expect(skippedCount).toBe(0)
  })

  test('leave an unclaimed format addable', () => {
    const { rows, needsSetupCount } = summarize([uri('/v.vcf.gz')], claimsBam)
    expect(rows[0]!.status).toBe('ok')
    expect(needsSetupCount).toBe(0)
  })

  test('nothing is held back when no plugin claims an adapter', () => {
    expect(summarize([uri('/a.bam')]).needsSetupCount).toBe(0)
  })

  it('adds a format whose picker only contributes optional fields', () => {
    // GWASAdapter has a picker, but it asks for a score column with a schema
    // default rather than an assembly, so a filename is enough to build it
    const { rows, needsSetupCount } = summarize(
      [uri('/study.txt.gz')],
      [new GWAS()],
    )
    expect(rows[0]!.adapterType).toBe('GWASAdapter')
    expect(rows[0]!.status).toBe('ok')
    expect(needsSetupCount).toBe(0)
  })
})

test('surfaces url loadability warnings', () => {
  const { warnings } = summarize([uri('ftp://x.com/a.bam')])
  expect(warnings.some(w => w.includes('ftp'))).toBe(true)
})

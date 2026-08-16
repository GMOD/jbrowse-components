import { createTestSession } from '@jbrowse/web/testUtils'
import { waitFor } from '@testing-library/react'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// The files the probe is allowed to find. `mock`-prefixed so jest lets the
// factory below close over it.
const mockPresent = new Set<string>()

jest.mock('@jbrowse/core/util/io', () => ({
  ...jest.requireActual('@jbrowse/core/util/io'),
  openLocation: (location: { uri?: string }) => ({
    stat: () =>
      location.uri !== undefined && mockPresent.has(location.uri)
        ? Promise.resolve({ size: 1 })
        : Promise.reject(new Error('not found')),
  }),
}))

function widget(present: string[]) {
  mockPresent.clear()
  for (const p of present) {
    mockPresent.add(p)
  }
  const session = createTestSession()
  return session.addWidget('AddTrackWidget', 'addTrackWidget', {})
}

const uri = (u: string) => ({ uri: u, locationType: 'UriLocation' as const })

test('fills the index field from the .csi a caller actually wrote', async () => {
  // the guess this replaces appends `.tbi`, so the track failed on a path
  // nobody typed
  const w = widget(['https://x.test/calls.vcf.gz.csi'])
  w.setTrackData(uri('https://x.test/calls.vcf.gz'))
  await waitFor(() => {
    expect(w.indexTrackData).toMatchObject({
      uri: 'https://x.test/calls.vcf.gz.csi',
    })
  })
  // and says so, so a path the user did not type does not read like one they did
  expect(w.detectedIndexName).toBe('calls.vcf.gz.csi')
})

test('finds the Picard spelling beside a bam', async () => {
  const w = widget(['https://x.test/reads.bai'])
  w.setTrackData(uri('https://x.test/reads.bam'))
  await waitFor(() => {
    expect(w.detectedIndexName).toBe('reads.bai')
  })
})

test('leaves the field alone when nothing is beside the file', async () => {
  // the conventional guess still applies downstream; an empty field is what the
  // user saw before this existed
  const w = widget([])
  w.setTrackData(uri('https://x.test/reads.bam'))
  await new Promise(r => {
    setTimeout(r, 0)
  })
  expect(w.indexTrackData).toBeUndefined()
  expect(w.detectedIndexName).toBeUndefined()
})

test('never overwrites an index the user set', async () => {
  const w = widget(['https://x.test/reads.bai'])
  w.setIndexTrackData(uri('https://x.test/mine.bai'))
  w.setTrackData(uri('https://x.test/reads.bam'))
  await new Promise(r => {
    setTimeout(r, 0)
  })
  expect(w.indexTrackData).toMatchObject({ uri: 'https://x.test/mine.bai' })
  expect(w.detectedIndexName).toBeUndefined()
})

test('a new main file drops the index the last one detected', async () => {
  // the detection belonged to the file it was made against; carrying it over
  // would silently index one file with another's
  const w = widget(['https://x.test/reads.bai'])
  w.setTrackData(uri('https://x.test/reads.bam'))
  await waitFor(() => {
    expect(w.detectedIndexName).toBe('reads.bai')
  })
  w.setTrackData(uri('https://x.test/other.bam'))
  expect(w.indexTrackData).toBeUndefined()
  expect(w.detectedIndexName).toBeUndefined()
})

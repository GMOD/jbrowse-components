import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  guessTrack,
  guessTrackType,
  makeLocationProtocol,
  siblingSidecar,
} from './adapter-utils.ts'

const mapLocation = makeLocationProtocol('uri')

const guess = (location: string) =>
  guessTrack({ location, mapLocation }).adapter

describe('guessTrack', () => {
  // The CLI keeps its own guesser table, which had drifted from the browser's
  // adapter guessers. These are the cases where they disagreed.
  it('routes a bgzipped gtf to the tabix adapter, matching the browser', () => {
    expect(guess('volvox.gtf.gz')).toMatchObject({
      type: 'GtfTabixAdapter',
      gtfGzLocation: { uri: 'volvox.gtf.gz' },
      index: { indexType: 'TBI' },
    })
  })

  it('still routes a plain gtf to the whole-file adapter', () => {
    expect(guess('volvox.gtf')).toMatchObject({
      type: 'GtfAdapter',
      gtfLocation: { uri: 'volvox.gtf' },
    })
  })

  it('recognizes bedGraph, indexed and plain', () => {
    expect(guess('volvox.bg.gz')).toMatchObject({
      type: 'BedGraphTabixAdapter',
      bedGraphGzLocation: { uri: 'volvox.bg.gz' },
    })
    expect(guess('volvox.bg')).toMatchObject({
      type: 'BedGraphAdapter',
      bedGraphLocation: { uri: 'volvox.bg' },
    })
  })

  it('gives bedGraph a QuantitativeTrack, as the browser does', () => {
    expect(guessTrackType('BedGraphAdapter')).toBe('QuantitativeTrack')
    expect(guessTrackType('BedGraphTabixAdapter')).toBe('QuantitativeTrack')
  })
})

// `jbrowse add-track` appended `.bai`/`.tbi` and wrote whatever came out, so the
// two other spellings htslib produces every day left a config pointing at a path
// nobody wrote — and `--load copy` then failed trying to copy it.
describe('the index sitting beside the data file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-sidecar-'))
  const write = (name: string) => {
    const p = path.join(dir, name)
    fs.writeFileSync(p, '')
    return p
  }

  it('takes the conventional sibling when it is there', () => {
    write('a.bam')
    write('a.bam.bai')
    expect(siblingSidecar(path.join(dir, 'a.bam'), '.bai')).toBe(
      path.join(dir, 'a.bam.bai'),
    )
  })

  it('falls through to the .csi a caller actually wrote', () => {
    write('b.vcf.gz')
    write('b.vcf.gz.csi')
    const chosen = siblingSidecar(path.join(dir, 'b.vcf.gz'), '.tbi')
    expect(chosen).toBe(path.join(dir, 'b.vcf.gz.csi'))
    // and the type follows the file that was chosen, or it opens no index
    expect(
      guessTrack({ location: chosen.replace(/\.csi$/, ''), mapLocation })
        .adapter.index,
    ).toMatchObject({ indexType: 'CSI' })
  })

  it('finds the Picard spelling beside a bam', () => {
    write('c.bam')
    write('c.bai')
    expect(siblingSidecar(path.join(dir, 'c.bam'), '.bai')).toBe(
      path.join(dir, 'c.bai'),
    )
  })

  // the file list --load copies comes from the same answer, so a name nothing
  // is under still has to be the conventional one
  it('names the conventional sibling when none is there', () => {
    expect(siblingSidecar(path.join(dir, 'd.bam'), '.bai')).toBe(
      path.join(dir, 'd.bam.bai'),
    )
  })

  // a URL cannot be probed, and every candidate for one is absent
  it('leaves a URL with the conventional guess', () => {
    expect(siblingSidecar('https://x.test/e.vcf.gz', '.tbi')).toBe(
      'https://x.test/e.vcf.gz.tbi',
    )
  })

  // `replace` hands back the subject unchanged when the pattern misses, so an
  // unguarded stripped spelling offers the data file as its own index
  it('never offers an extensionless data file as its own index', () => {
    const bam = write('f')
    expect(siblingSidecar(bam, '.bai')).toBe(`${bam}.bai`)
  })
})

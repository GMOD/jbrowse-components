import path from 'path'

import { createTextSearchConf, findTrackConfigsToIndex } from './util.ts'

describe('createTextSearchConf', () => {
  const outDir = '/some/dir'
  const trixBase = path.join(outDir, 'trix')

  it('generates correct file paths for a simple name', () => {
    const conf = createTextSearchConf(
      'volvox-index',
      ['volvox'],
      ['volvox'],
      outDir,
    )
    expect(conf.ixFilePath).toEqual({
      localPath: path.join(trixBase, 'volvox-index.ix'),
      locationType: 'LocalPathLocation',
    })
    expect(conf.ixxFilePath).toEqual({
      localPath: path.join(trixBase, 'volvox-index.ixx'),
      locationType: 'LocalPathLocation',
    })
    expect(conf.metaFilePath).toEqual({
      localPath: path.join(trixBase, 'volvox-index_meta.json'),
      locationType: 'LocalPathLocation',
    })
  })

  it('replaces slashes in name with underscores (original bug: track named "test A/B")', () => {
    // The trackId for a track named "test A/B" would contain a slash.
    // Previously createTextSearchConf used sanitize-filename which stripped
    // slashes, while runIxIxx used sanitizeForFilename which replaced with _.
    // This caused ENOENT when looking up the index file.
    const conf = createTextSearchConf(
      'test_a/b-1234-index',
      ['test_a/b-1234'],
      ['volvox'],
      outDir,
    )
    expect(conf.ixFilePath).toEqual({
      localPath: path.join(trixBase, 'test_a_b-1234-index.ix'),
      locationType: 'LocalPathLocation',
    })
    expect(conf.ixxFilePath).toEqual({
      localPath: path.join(trixBase, 'test_a_b-1234-index.ixx'),
      locationType: 'LocalPathLocation',
    })
    expect(conf.metaFilePath).toEqual({
      localPath: path.join(trixBase, 'test_a_b-1234-index_meta.json'),
      locationType: 'LocalPathLocation',
    })
  })

  it('replaces all Windows-invalid characters with underscores', () => {
    const conf = createTextSearchConf(
      String.raw`track\:*?"<>|name-index`,
      [],
      [],
      outDir,
    )
    expect(conf.ixFilePath).toEqual({
      localPath: path.join(trixBase, 'track________name-index.ix'),
      locationType: 'LocalPathLocation',
    })
  })

  it('textSearchAdapterId retains the original unsanitized name', () => {
    const conf = createTextSearchConf('test_a/b-index', [], [], outDir)
    expect(conf.textSearchAdapterId).toBe('test_a/b-index')
  })
})

describe('findTrackConfigsToIndex', () => {
  const tracks = [
    {
      trackId: 'gff-track',
      name: 'GFF Track',
      assemblyNames: ['hg19', 'hg38'],
      adapter: { type: 'Gff3Adapter' },
    },
    {
      trackId: 'vcf-track',
      name: 'VCF Track',
      assemblyNames: ['hg38'],
      adapter: { type: 'VcfTabixAdapter' },
    },
    {
      trackId: 'unsupported-track',
      name: 'Other Track',
      assemblyNames: ['hg19'],
      adapter: { type: 'SomeOtherAdapter' },
    },
  ]

  it('throws when a requested trackId is not in the track list', () => {
    expect(() => findTrackConfigsToIndex(tracks, ['nonexistent'])).toThrow(
      'Track not found in session for trackId nonexistent',
    )
  })

  it('returns all matching supported tracks when no assembly filter given', () => {
    const result = findTrackConfigsToIndex(tracks, ['gff-track', 'vcf-track'])
    expect(result.map(t => t.trackId)).toEqual(['gff-track', 'vcf-track'])
  })

  it('filters by assembly name', () => {
    const result = findTrackConfigsToIndex(
      tracks,
      ['gff-track', 'vcf-track'],
      'hg19',
    )
    expect(result.map(t => t.trackId)).toEqual(['gff-track'])
  })

  it('excludes tracks with unsupported adapter types', () => {
    const result = findTrackConfigsToIndex(tracks, [
      'gff-track',
      'unsupported-track',
    ])
    expect(result.map(t => t.trackId)).toEqual(['gff-track'])
  })
})

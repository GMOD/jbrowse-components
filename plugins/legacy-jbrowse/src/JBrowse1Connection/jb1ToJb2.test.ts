import { convertTrackConfig } from './jb1ToJb2.ts'

import type { Track } from './types.ts'

const dataRoot = 'https://example.com/data'

function track(overrides: Partial<Track> & { label: string }): Track {
  return overrides as Track
}

describe('convertTrackConfig', () => {
  it('converts BAM track with default index', () => {
    const result = convertTrackConfig(
      track({
        label: 'my_bam',
        urlTemplate: 'reads.bam',
        storeClass: 'JBrowse/Store/SeqFeature/BAM',
      }),
      dataRoot,
    )
    expect(result.type).toBe('AlignmentsTrack')
    expect(result.adapter?.type).toBe('BamAdapter')
    expect(result.adapter?.bamLocation?.uri).toBe(
      'https://example.com/data/reads.bam',
    )
    expect(result.adapter?.index?.location.uri).toBe(
      'https://example.com/data/reads.bam.bai',
    )
    expect(result.adapter?.index?.indexType).toBeUndefined()
  })

  it('converts BAM track with explicit baiUrlTemplate', () => {
    const result = convertTrackConfig(
      track({
        label: 'my_bam',
        urlTemplate: 'reads.bam',
        baiUrlTemplate: 'reads.bam.custom.bai',
        storeClass: 'JBrowse/Store/SeqFeature/BAM',
      }),
      dataRoot,
    )
    expect(result.adapter?.index?.location.uri).toBe(
      'https://example.com/data/reads.bam.custom.bai',
    )
    expect(result.adapter?.index?.indexType).toBeUndefined()
  })

  it('converts BAM track with CSI index', () => {
    const result = convertTrackConfig(
      track({
        label: 'my_bam',
        urlTemplate: 'reads.bam',
        csiUrlTemplate: 'reads.bam.csi',
        storeClass: 'JBrowse/Store/SeqFeature/BAM',
      }),
      dataRoot,
    )
    expect(result.adapter?.index?.indexType).toBe('CSI')
    expect(result.adapter?.index?.location.uri).toBe(
      'https://example.com/data/reads.bam.csi',
    )
  })

  it('converts VCFTabix track with default tbi index', () => {
    const result = convertTrackConfig(
      track({
        label: 'my_vcf',
        urlTemplate: 'variants.vcf.gz',
        storeClass: 'JBrowse/Store/SeqFeature/VCFTabix',
      }),
      dataRoot,
    )
    expect(result.type).toBe('VariantTrack')
    expect(result.adapter?.type).toBe('VcfTabixAdapter')
    expect(result.adapter?.vcfGzLocation?.uri).toBe(
      'https://example.com/data/variants.vcf.gz',
    )
    expect(result.adapter?.index?.location.uri).toBe(
      'https://example.com/data/variants.vcf.gz.tbi',
    )
  })

  it('converts GFF3Tabix track', () => {
    const result = convertTrackConfig(
      track({
        label: 'my_gff',
        urlTemplate: 'genes.gff.gz',
        storeClass: 'JBrowse/Store/SeqFeature/GFF3Tabix',
      }),
      dataRoot,
    )
    expect(result.type).toBe('FeatureTrack')
    expect(result.adapter?.type).toBe('Gff3TabixAdapter')
    expect(result.adapter?.index?.location.uri).toBe(
      'https://example.com/data/genes.gff.gz.tbi',
    )
  })

  it('converts BEDTabix track', () => {
    const result = convertTrackConfig(
      track({
        label: 'my_bed',
        urlTemplate: 'features.bed.gz',
        storeClass: 'JBrowse/Store/SeqFeature/BEDTabix',
      }),
      dataRoot,
    )
    expect(result.type).toBe('FeatureTrack')
    expect(result.adapter?.type).toBe('BedTabixAdapter')
    expect(result.adapter?.index?.location.uri).toBe(
      'https://example.com/data/features.bed.gz.tbi',
    )
  })

  it('converts NCList track', () => {
    const result = convertTrackConfig(
      track({
        label: 'my_nclist',
        urlTemplate: 'features/{refseq}/trackData.json',
        storeClass: 'JBrowse/Store/SeqFeature/NCList',
      }),
      dataRoot,
    )
    expect(result.type).toBe('FeatureTrack')
    expect(result.adapter?.type).toBe('NCListAdapter')
  })

  it('converts BigWig XYPlot track', () => {
    const result = convertTrackConfig(
      track({
        label: 'my_bw',
        urlTemplate: 'signal.bw',
        type: 'JBrowse/View/Track/Wiggle/XYPlot',
        storeClass: 'JBrowse/Store/SeqFeature/BigWig',
      }),
      dataRoot,
    )
    expect(result.type).toBe('QuantitativeTrack')
    expect(result.defaultRendering).toBe('xyplot')
  })

  it('returns unsupported conf for VCFTribble', () => {
    const result = convertTrackConfig(
      track({
        label: 'old_vcf',
        urlTemplate: 'variants.vcf',
        storeClass: 'JBrowse/Store/SeqFeature/VCFTribble',
      }),
      dataRoot,
    )
    expect(result.name).toContain('old_vcf')
  })

  it('converts FromConfig track without urlTemplate', () => {
    const result = convertTrackConfig(
      track({
        label: 'static',
        storeClass: 'JBrowse/Store/SeqFeature/FromConfig',
        features: [{ seq_id: 'chr1', start: 0, end: 100, name: 'f1' }],
      }),
      dataRoot,
    )
    expect(result.type).toBe('FeatureTrack')
    expect(result.adapter?.type).toBe('FromConfigAdapter')
    expect(result.adapter?.features?.[0]?.refName).toBe('chr1')
    expect(result.adapter?.features?.[0]?.uniqueId).toBe('chr1:0-100:f1')
  })

  it('uses key as track name when available', () => {
    const result = convertTrackConfig(
      track({
        label: 'internal_id',
        key: 'Display Name',
        urlTemplate: 'reads.bam',
        storeClass: 'JBrowse/Store/SeqFeature/BAM',
      }),
      dataRoot,
    )
    expect(result.name).toBe('Display Name')
  })

  it('splits category on slash', () => {
    const result = convertTrackConfig(
      track({
        label: 'my_bam',
        urlTemplate: 'reads.bam',
        storeClass: 'JBrowse/Store/SeqFeature/BAM',
        category: 'Reads / Alignments',
      }),
      dataRoot,
    )
    expect(result.category).toEqual(['Reads', 'Alignments'])
  })
})

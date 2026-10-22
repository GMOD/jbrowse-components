import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  fileAdapter,
  fileTrack,
  genomeAssembly,
  isSequenceAdapter,
  makeLocation,
  sequenceAssembly,
} from './fileInput.ts'

describe('makeLocation', () => {
  test('a URL scheme makes a uri location', () => {
    for (const uri of [
      'https://example.com/a.bw',
      'ftp://example.com/a.bw',
      's3://bucket/a.bw',
    ]) {
      expect(makeLocation(uri)).toEqual({ uri, locationType: 'UriLocation' })
    }
  })

  test('anything else is a local path', () => {
    for (const localPath of [
      '/data/a.bw',
      './a.bw',
      String.raw`C:\data\a.bw`,
    ]) {
      expect(makeLocation(localPath)).toEqual({
        localPath,
        locationType: 'LocalPathLocation',
      })
    }
  })
})

describe('fileTrack', () => {
  test('a bam track finds its index', () => {
    expect(fileTrack('bam', ['reads.bam'], 'testAsm')).toMatchObject({
      type: 'AlignmentsTrack',
      trackId: 'reads.bam',
      name: 'reads.bam',
      assemblyNames: ['testAsm'],
      adapter: {
        type: 'BamAdapter',
        bamLocation: { localPath: 'reads.bam' },
        index: { location: { localPath: 'reads.bam.bai' }, indexType: 'BAI' },
      },
    })
  })

  test('a bare file is typed by its name, the same as its flag', () => {
    expect(fileTrack('file', ['reads.bam'], 'testAsm')).toEqual(
      fileTrack('bam', ['reads.bam'], 'testAsm'),
    )
    expect(fileTrack('file', ['calls.vcf.gz'], 'testAsm')).toMatchObject({
      type: 'VariantTrack',
      adapter: { type: 'VcfTabixAdapter' },
    })
  })

  test('a typed flag wins over the name', () => {
    expect(fileTrack('bigwig', ['signal.data'], 'testAsm')).toMatchObject({
      type: 'QuantitativeTrack',
      adapter: {
        type: 'BigWigAdapter',
        bigWigLocation: { localPath: 'signal.data' },
      },
    })
  })

  test('name: and index: modifiers', () => {
    expect(
      fileTrack(
        'bam',
        ['reads.bam', 'name:My reads', 'index:reads.bam.csi'],
        'testAsm',
      ),
    ).toMatchObject({
      trackId: 'reads.bam',
      name: 'My reads',
      adapter: { index: { indexType: 'CSI' } },
    })
  })

  test.each([
    ['cram', 'reads.cram', 'AlignmentsTrack', 'CramAdapter'],
    ['bigwig', 'signal.bw', 'QuantitativeTrack', 'BigWigAdapter'],
    ['vcf', 'variants.vcf.gz', 'VariantTrack', 'VcfTabixAdapter'],
    ['gff', 'genes.gff.gz', 'FeatureTrack', 'Gff3TabixAdapter'],
    ['hic', 'matrix.hic', 'HicTrack', 'HicAdapter'],
    ['bigbed', 'features.bb', 'FeatureTrack', 'BigBedAdapter'],
    ['bed', 'regions.bed.gz', 'FeatureTrack', 'BedTabixAdapter'],
    ['vcf', 'variants.vcf', 'VariantTrack', 'VcfAdapter'],
    ['gff', 'genes.gff3', 'FeatureTrack', 'Gff3Adapter'],
    ['bed', 'regions.bed', 'FeatureTrack', 'BedAdapter'],
    ['vcf', 'calls.gz', 'VariantTrack', 'VcfTabixAdapter'],
    ['vcf', 'calls.txt', 'VariantTrack', 'VcfAdapter'],
    ['vcf', 'calls.txt.gz', 'VariantTrack', 'VcfTabixAdapter'],
    ['gff', 'genes.gtf', 'FeatureTrack', 'GtfAdapter'],
    ['gff', 'genes.gtf.gz', 'FeatureTrack', 'GtfTabixAdapter'],
    ['bed', 'pairs.bedpe', 'VariantTrack', 'BedpeAdapter'],
    ['bed', 'cov.bedgraph', 'QuantitativeTrack', 'BedGraphAdapter'],
  ])('--%s %s', (flag, file, type, adapterType) => {
    expect(fileTrack(flag, [file], 'testAsm')).toMatchObject({
      type,
      adapter: { type: adapterType },
    })
  })

  test.each([
    ['bed', 'features.bb', /says a bigbed file.*as --bigbed/],
    ['bam', 'reads.cram', /says a cram file/],
    ['gff', 'calls.vcf.gz', /says a vcf file/],
  ])('--%s %s throws: the name says another flag', (flag, file, message) => {
    expect(() => fileTrack(flag, [file], 'testAsm')).toThrow(message)
  })

  test('index: opens the tabix adapter of the format the name says', () => {
    for (const flag of ['vcf', 'file']) {
      expect(
        fileTrack(flag, ['calls.vcf', 'index:calls.vcf.tbi'], 'testAsm')
          .adapter,
      ).toMatchObject({
        type: 'VcfTabixAdapter',
        index: { location: { localPath: 'calls.vcf.tbi' } },
      })
    }
    expect(
      fileTrack('gff', ['genes.gtf', 'index:g.tbi'], 'testAsm').adapter,
    ).toMatchObject({ type: 'GtfTabixAdapter' })
  })

  test('index: on a file that reads none throws', () => {
    expect(() =>
      fileTrack('file', ['signal.bw', 'index:signal.bw.tbi'], 'testAsm'),
    ).toThrow(/BigWigAdapter, which reads no index/)
  })

  test('a cram finds its crai', () => {
    expect(fileTrack('cram', ['reads.cram'], 'testAsm').adapter).toMatchObject({
      craiLocation: { localPath: 'reads.cram.crai' },
    })
  })

  test('a bgzipped vcf defaults to a tbi index', () => {
    expect(
      fileTrack('vcf', ['variants.vcf.gz'], 'testAsm').adapter,
    ).toMatchObject({
      index: {
        indexType: 'TBI',
        location: { localPath: 'variants.vcf.gz.tbi' },
      },
    })
  })

  describe('a local file indexed only with .csi', () => {
    // htslib writes .csi rather than .tbi/.bai for a reference over 512 Mb, and
    // on request at any size
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-args-csi-'))
    const vcf = path.join(dir, 'variants.vcf.gz')
    const bam = path.join(dir, 'reads.bam')
    beforeAll(() => {
      for (const file of [vcf, `${vcf}.csi`, bam, `${bam}.csi`]) {
        fs.writeFileSync(file, '')
      }
    })
    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true })
    })

    test('a tabix track finds it, and opens it as CSI', () => {
      expect(fileTrack('vcf', [vcf], 'testAsm').adapter).toMatchObject({
        index: { indexType: 'CSI', location: { localPath: `${vcf}.csi` } },
      })
    })

    test('a bam track finds it too', () => {
      expect(fileTrack('bam', [bam], 'testAsm').adapter).toMatchObject({
        index: { indexType: 'CSI', location: { localPath: `${bam}.csi` } },
      })
    })

    test('the conventional sibling still wins when it is there', () => {
      fs.writeFileSync(`${vcf}.tbi`, '')
      try {
        expect(fileTrack('vcf', [vcf], 'testAsm').adapter).toMatchObject({
          index: { indexType: 'TBI' },
        })
      } finally {
        fs.rmSync(`${vcf}.tbi`)
      }
    })
  })

  test('a bam finds the Picard/GATK "reads.bai" spelling', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-args-bai-'))
    const bam = path.join(dir, 'reads.bam')
    fs.writeFileSync(bam, '')
    fs.writeFileSync(path.join(dir, 'reads.bai'), '')
    try {
      expect(fileTrack('bam', [bam], 'testAsm').adapter).toMatchObject({
        index: {
          indexType: 'BAI',
          location: { localPath: path.join(dir, 'reads.bai') },
        },
      })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a non-bam is never opened as its own index', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-args-self-'))
    const data = path.join(dir, 'reads.sam')
    fs.writeFileSync(data, '')
    try {
      expect(fileTrack('bam', [data], 'testAsm').adapter).toMatchObject({
        index: { location: { localPath: `${data}.bai` } },
      })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a remote file keeps the conventional sibling, unprobed', () => {
    expect(
      fileTrack('vcf', ['https://example.com/variants.vcf.gz'], 'testAsm')
        .adapter,
    ).toMatchObject({
      index: {
        indexType: 'TBI',
        location: { uri: 'https://example.com/variants.vcf.gz.tbi' },
      },
    })
  })

  test('a file nothing can type names the flags that would', () => {
    expect(() => fileTrack('file', ['notes.txt'], 'testAsm')).toThrow(
      /cannot tell what kind of file notes\.txt is.*--bam/,
    )
  })

  test('a genome file is not a track', () => {
    expect(() => fileTrack('file', ['other.fa'], 'testAsm')).toThrow(
      /other\.fa is a genome, and this view already has one/,
    )
  })
})

describe('sequenceAssembly', () => {
  test('a FASTA, bgzipped FASTA, 2bit and chrom.sizes each type themselves', () => {
    expect(fileAdapter('ref.fa')).toMatchObject({
      type: 'IndexedFastaAdapter',
      faiLocation: { localPath: 'ref.fa.fai' },
    })
    expect(fileAdapter('ref.fa.gz')).toMatchObject({
      type: 'BgzipFastaAdapter',
      gziLocation: { localPath: 'ref.fa.gz.gzi' },
    })
    for (const file of [
      'ref.fa',
      'ref.fa.gz',
      'ref.2bit',
      'hg38.chrom.sizes',
    ]) {
      expect(isSequenceAdapter(fileAdapter(file))).toBe(true)
    }
    expect(isSequenceAdapter(fileAdapter('reads.bam'))).toBe(false)
  })

  test('named after the file, chrom.sizes stripped', () => {
    expect(sequenceAssembly(fileAdapter('ref.fa'), 'dir/ref.fa').name).toBe(
      'ref.fa',
    )
    expect(
      sequenceAssembly(fileAdapter('hs1.chrom.sizes'), 'hs1.chrom.sizes').name,
    ).toBe('hs1')
  })

  test('aliases and cytobands attach only when given', () => {
    const bare = sequenceAssembly(fileAdapter('ref.fa'), 'ref.fa')
    expect(bare.refNameAliases).toBeUndefined()
    expect(bare.cytobands).toBeUndefined()
    expect(
      sequenceAssembly(fileAdapter('ref.fa'), 'ref.fa', {
        aliases: 'a.txt',
        cytobands: 'c.txt',
      }),
    ).toMatchObject({
      refNameAliases: { adapter: { type: 'RefNameAliasAdapter' } },
      cytobands: { adapter: { type: 'CytobandAdapter' } },
    })
  })
})

describe('genomeAssembly', () => {
  test('a genome argument with its aliases: and cytobands:', () => {
    const { assembly, unused } = genomeAssembly('fasta', [
      'ref.fa',
      'aliases:a.txt',
      'height:100',
    ])
    expect(assembly).toMatchObject({
      name: 'ref.fa',
      sequence: { adapter: { type: 'IndexedFastaAdapter' } },
      refNameAliases: { adapter: { type: 'RefNameAliasAdapter' } },
    })
    expect(unused).toEqual(['height:100'])
  })

  test('--fasta opens an unknown name as an indexed FASTA; --chromSizes as sizes', () => {
    expect(
      genomeAssembly('fasta', ['genome.seq']).assembly.sequence,
    ).toMatchObject({ adapter: { type: 'IndexedFastaAdapter' } })
    expect(
      genomeAssembly('chromSizes', ['a.txt']).assembly.sequence,
    ).toMatchObject({ adapter: { type: 'ChromSizesAdapter' } })
  })

  test('a file that is not a genome says so', () => {
    expect(() => genomeAssembly('fasta', ['reads.bam'])).toThrow(/not a genome/)
  })
})

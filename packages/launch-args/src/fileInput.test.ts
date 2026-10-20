import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  fileAdapter,
  fileTrack,
  isSequenceAdapter,
  makeLocation,
  sequenceAssembly,
} from './fileInput.ts'

const fakeAssembly = {
  name: 'testAsm',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'refseq',
    adapter: { type: 'IndexedFastaAdapter' },
  },
}

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
  test('a bam track carries the sequence adapter and its index', () => {
    expect(fileTrack('bam', ['reads.bam'], fakeAssembly)).toMatchObject({
      type: 'AlignmentsTrack',
      trackId: 'reads.bam',
      name: 'reads.bam',
      assemblyNames: ['testAsm'],
      adapter: {
        type: 'BamAdapter',
        bamLocation: { localPath: 'reads.bam' },
        index: { location: { localPath: 'reads.bam.bai' }, indexType: 'BAI' },
        sequenceAdapter: { type: 'IndexedFastaAdapter' },
      },
    })
  })

  test('a bare file is typed by its name, the same as its flag', () => {
    expect(fileTrack('file', ['reads.bam'], fakeAssembly)).toEqual(
      fileTrack('bam', ['reads.bam'], fakeAssembly),
    )
    expect(fileTrack('file', ['calls.vcf.gz'], fakeAssembly)).toMatchObject({
      type: 'VariantTrack',
      adapter: { type: 'VcfTabixAdapter' },
    })
  })

  test('a typed flag wins over the name', () => {
    expect(fileTrack('bigwig', ['signal.data'], fakeAssembly)).toMatchObject({
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
        fakeAssembly,
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
    ['vcfgz', 'variants.vcf.gz', 'VariantTrack', 'VcfTabixAdapter'],
    ['gffgz', 'genes.gff.gz', 'FeatureTrack', 'Gff3TabixAdapter'],
    ['hic', 'matrix.hic', 'HicTrack', 'HicAdapter'],
    ['bigbed', 'features.bb', 'FeatureTrack', 'BigBedAdapter'],
    ['bedgz', 'regions.bed.gz', 'FeatureTrack', 'BedTabixAdapter'],
  ])('--%s %s', (flag, file, type, adapterType) => {
    expect(fileTrack(flag, [file], fakeAssembly)).toMatchObject({
      type,
      adapter: { type: adapterType },
    })
  })

  test('a cram finds its crai', () => {
    expect(
      fileTrack('cram', ['reads.cram'], fakeAssembly).adapter,
    ).toMatchObject({ craiLocation: { localPath: 'reads.cram.crai' } })
  })

  test('a vcfgz defaults to a tbi index', () => {
    expect(
      fileTrack('vcfgz', ['variants.vcf.gz'], fakeAssembly).adapter,
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
      expect(fileTrack('vcfgz', [vcf], fakeAssembly).adapter).toMatchObject({
        index: { indexType: 'CSI', location: { localPath: `${vcf}.csi` } },
      })
    })

    test('a bam track finds it too', () => {
      expect(fileTrack('bam', [bam], fakeAssembly).adapter).toMatchObject({
        index: { indexType: 'CSI', location: { localPath: `${bam}.csi` } },
      })
    })

    test('the conventional sibling still wins when it is there', () => {
      fs.writeFileSync(`${vcf}.tbi`, '')
      try {
        expect(fileTrack('vcfgz', [vcf], fakeAssembly).adapter).toMatchObject({
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
      expect(fileTrack('bam', [bam], fakeAssembly).adapter).toMatchObject({
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
      expect(fileTrack('bam', [data], fakeAssembly).adapter).toMatchObject({
        index: { location: { localPath: `${data}.bai` } },
      })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a remote file keeps the conventional sibling, unprobed', () => {
    expect(
      fileTrack('vcfgz', ['https://example.com/variants.vcf.gz'], fakeAssembly)
        .adapter,
    ).toMatchObject({
      index: {
        indexType: 'TBI',
        location: { uri: 'https://example.com/variants.vcf.gz.tbi' },
      },
    })
  })

  test('a file nothing can type names the flags that would', () => {
    expect(() => fileTrack('file', ['notes.txt'], fakeAssembly)).toThrow(
      /cannot tell what kind of file notes\.txt is.*--bam/,
    )
  })

  test('a genome file is not a track', () => {
    expect(() => fileTrack('file', ['other.fa'], fakeAssembly)).toThrow(
      /other\.fa is a genome/,
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

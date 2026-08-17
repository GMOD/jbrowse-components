import {
  detectIndexLocation,
  indexCandidateNames,
  siblingLocation,
} from './indexCandidates.ts'

import type { FileLocation } from './types/index.ts'

const uri = (u: string): FileLocation => ({
  uri: u,
  locationType: 'UriLocation',
})

describe('indexCandidateNames', () => {
  it('offers the three spellings a BAM index is written under', () => {
    // samtools writes reads.bam.bai, htslib .csi, Picard/GATK reads.bai
    expect(indexCandidateNames('reads.bam')).toEqual([
      'reads.bam.bai',
      'reads.bam.csi',
      'reads.bai',
    ])
  })

  it('offers both CRAM spellings', () => {
    expect(indexCandidateNames('reads.cram')).toEqual([
      'reads.cram.crai',
      'reads.crai',
    ])
  })

  it('spells a tabix index by the compression, not the content', () => {
    // a .gz here is a bgzipped VCF/GFF/BED, all indexed the same two ways
    for (const f of ['calls.vcf.gz', 'genes.gff3.gz', 'peaks.bed.gz']) {
      expect(indexCandidateNames(f)).toEqual([`${f}.tbi`, `${f}.csi`])
    }
  })

  it('takes .bgz as the same file under another name', () => {
    // every format guesser accepts `\.b?gz$`, so matching only `.gz` left a
    // whole spelling of bgzip output with no detection
    expect(indexCandidateNames('calls.vcf.bgz')).toEqual([
      'calls.vcf.bgz.tbi',
      'calls.vcf.bgz.csi',
    ])
  })

  it('offers nothing for a file type that carries no sibling index', () => {
    // so a caller knows not to go looking, rather than probing for a .tbi that
    // a BigWig was never going to have
    expect(indexCandidateNames('signal.bw')).toEqual([])
    expect(indexCandidateNames('contacts.hic')).toEqual([])
  })

  it('is case-insensitive about the data extension', () => {
    expect(indexCandidateNames('READS.BAM')).toContain('READS.BAM.bai')
  })
})

describe('siblingLocation', () => {
  it('replaces the last segment of a URI', () => {
    expect(
      siblingLocation(uri('https://x.test/a/b/reads.bam'), 'reads.bai'),
    ).toMatchObject({ uri: 'https://x.test/a/b/reads.bai' })
  })

  it('keeps a local path’s own separator', () => {
    // rebuilding with '/' would corrupt a Windows path
    expect(
      siblingLocation(
        { localPath: 'C:\\data\\reads.bam', locationType: 'LocalPathLocation' },
        'reads.bai',
      ),
    ).toMatchObject({ localPath: 'C:\\data\\reads.bai' })
  })

  it('carries the rest of the location, e.g. a baseUri', () => {
    expect(
      siblingLocation(
        {
          uri: 'reads.bam',
          locationType: 'UriLocation',
          baseUri: 'https://x.test/c.json',
        },
        'reads.bam.bai',
      ),
    ).toMatchObject({ baseUri: 'https://x.test/c.json' })
  })

  it('has no answer for a Blob, which is what makes detection impossible there', () => {
    // a file picked out of a browser dialog has no directory around it to look
    // in, however much anyone would like one
    expect(
      siblingLocation(
        { blobId: 'abc', name: 'reads.bam', locationType: 'BlobLocation' },
        'reads.bam.bai',
      ),
    ).toBeUndefined()
  })
})

describe('detectIndexLocation', () => {
  const detect = (file: string, present: string[]) =>
    detectIndexLocation(uri(`https://x.test/${file}`), loc =>
      Promise.resolve(
        present.some(p => 'uri' in loc && loc.uri === `https://x.test/${p}`),
      ),
    )

  it('takes the conventional sibling when it is there', async () => {
    await expect(
      detect('reads.bam', ['reads.bam.bai', 'reads.bai']),
    ).resolves.toMatchObject({ uri: 'https://x.test/reads.bam.bai' })
  })

  it('falls through to the .csi a caller actually wrote', async () => {
    await expect(
      detect('calls.vcf.gz', ['calls.vcf.gz.csi']),
    ).resolves.toMatchObject({ uri: 'https://x.test/calls.vcf.gz.csi' })
  })

  it('finds the Picard spelling when samtools’ is absent', async () => {
    await expect(detect('reads.bam', ['reads.bai'])).resolves.toMatchObject({
      uri: 'https://x.test/reads.bai',
    })
  })

  it('gives up rather than guessing when none is there', async () => {
    await expect(detect('reads.bam', [])).resolves.toBeUndefined()
  })

  it('never probes a file type with no sibling index', async () => {
    const exists = jest.fn().mockResolvedValue(true)
    await expect(
      detectIndexLocation(uri('https://x.test/signal.bw'), exists),
    ).resolves.toBeUndefined()
    expect(exists).not.toHaveBeenCalled()
  })

  it('stops at the first hit rather than probing them all', async () => {
    const exists = jest.fn().mockResolvedValue(true)
    await detectIndexLocation(uri('https://x.test/reads.bam'), exists)
    expect(exists).toHaveBeenCalledTimes(1)
  })
})

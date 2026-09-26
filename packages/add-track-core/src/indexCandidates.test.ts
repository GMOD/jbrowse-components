import {
  indexCandidateNames,
  resolveIndexType,
  sidecarCandidateNames,
} from './indexCandidates.ts'

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
    expect(indexCandidateNames('READS.BAM')).toEqual([
      'READS.BAM.bai',
      'READS.BAM.csi',
      'READS.bai',
    ])
  })
})

describe('sidecarCandidateNames', () => {
  it('keys the alternates off the suffix, not the data extension', () => {
    // an explicit adapter type picks the suffix, so the file it names may carry
    // any extension at all
    expect(sidecarCandidateNames('/d/reads.dat', '.bai')).toEqual([
      '/d/reads.dat.bai',
      '/d/reads.dat.csi',
      '/d/reads.bai',
    ])
    expect(sidecarCandidateNames('/d/aln.cram', '.crai')).toEqual([
      '/d/aln.cram.crai',
      '/d/aln.crai',
    ])
    expect(sidecarCandidateNames('/d/calls.vcf.gz', '.tbi')).toEqual([
      '/d/calls.vcf.gz.tbi',
      '/d/calls.vcf.gz.csi',
    ])
  })

  it('has one answer for a sidecar written only one way', () => {
    expect(sidecarCandidateNames('/d/ref.fa', '.fai')).toEqual([
      '/d/ref.fa.fai',
    ])
    expect(sidecarCandidateNames('/d/ref.fa.gz', '.gzi')).toEqual([
      '/d/ref.fa.gz.gzi',
    ])
  })

  it('never offers an extensionless data file as its own index', () => {
    // `replace` hands back the subject unchanged when the pattern misses
    expect(sidecarCandidateNames('/d/reads', '.bai')).toEqual([
      '/d/reads.bai',
      '/d/reads.csi',
    ])
  })

  it('reads the extension, not a directory that carries a dot', () => {
    expect(sidecarCandidateNames('/d.v2/reads', '.bai')).toEqual([
      '/d.v2/reads.bai',
      '/d.v2/reads.csi',
    ])
  })
})

describe('resolveIndexType', () => {
  it('takes the spelling of the name it was handed', () => {
    expect(resolveIndexType('calls.vcf.gz.csi', 'TBI')).toBe('CSI')
    expect(resolveIndexType('calls.vcf.gz.CSI', 'TBI')).toBe('CSI')
    expect(resolveIndexType('reads.bam.bai', 'BAI')).toBe('BAI')
  })

  it('falls back when no index was named', () => {
    expect(resolveIndexType(undefined, 'TBI')).toBe('TBI')
  })
})

import {
  matchSampleId,
  parseAssemblyAndChr,
  parseAssemblyAndChrSimple,
  selectReferenceSequenceString,
} from './parseAssemblyName.ts'

describe('matchSampleId (sample-set aware splitting)', () => {
  const samples = new Set(['Species1.1', 'Species1.2', 'mm10'])

  test('haplotype-suffixed sample with a contig', () => {
    expect(matchSampleId('Species1.1.chr3', samples)).toEqual({
      assemblyName: 'Species1.1',
      chr: 'chr3',
    })
  })

  test('haplotype-suffixed sample with a dotted accession contig', () => {
    expect(matchSampleId('Species1.2.CM012345.1', samples)).toEqual({
      assemblyName: 'Species1.2',
      chr: 'CM012345.1',
    })
  })

  test('bare sample token with no contig (regression: do not drop .1)', () => {
    // `parseAssemblyAndChr` would mis-split this to `Species1` + `1`; with the
    // known set we resolve it exactly.
    expect(matchSampleId('Species1.1', samples)).toEqual({
      assemblyName: 'Species1.1',
      chr: '',
    })
  })

  test('longest matching prefix wins', () => {
    const overlapping = new Set(['Species1', 'Species1.1'])
    expect(matchSampleId('Species1.1.chr3', overlapping)).toEqual({
      assemblyName: 'Species1.1',
      chr: 'chr3',
    })
  })

  test('falls through to a shorter (bare-species) sample id', () => {
    // tree leaves are bare species names but the data carries haplotypes —
    // haplotypes group under the species rather than vanishing.
    const bare = new Set(['Species1'])
    expect(matchSampleId('Species1.1.chr3', bare)).toEqual({
      assemblyName: 'Species1',
      chr: '1.chr3',
    })
  })

  test('token belonging to no configured sample is skipped', () => {
    expect(matchSampleId('Species9.1.chr3', samples)).toBeUndefined()
  })
})

describe('parseAssemblyAndChr (MafTabix format)', () => {
  test('no dot - entire string is assembly name', () => {
    const result = parseAssemblyAndChr('hg38')
    expect(result).toEqual({
      assemblyName: 'hg38',
      chr: '',
    })
  })

  test('single dot - simple assembly.chr format', () => {
    const result = parseAssemblyAndChr('hg38.chr1')
    expect(result).toEqual({
      assemblyName: 'hg38',
      chr: 'chr1',
    })
  })

  test('single dot - assembly.refName format with non-chr name', () => {
    const result = parseAssemblyAndChr('mm10.scaffold_1')
    expect(result).toEqual({
      assemblyName: 'mm10',
      chr: 'scaffold_1',
    })
  })

  test('two dots with numeric version - assembly.version.chr format', () => {
    const result = parseAssemblyAndChr('hg38.1.chr1')
    expect(result).toEqual({
      assemblyName: 'hg38.1',
      chr: 'chr1',
    })
  })

  test('two dots with multi-digit numeric version', () => {
    const result = parseAssemblyAndChr('GRCh38.123.chrX')
    expect(result).toEqual({
      assemblyName: 'GRCh38.123',
      chr: 'chrX',
    })
  })

  test('two dots with non-numeric middle - assembly.chr.more format', () => {
    const result = parseAssemblyAndChr('mm10.chr1.random')
    expect(result).toEqual({
      assemblyName: 'mm10',
      chr: 'chr1.random',
    })
  })

  test('two dots with non-numeric middle - chr_Un type naming', () => {
    const result = parseAssemblyAndChr('hg38.chrUn_gl000220')
    expect(result).toEqual({
      assemblyName: 'hg38',
      chr: 'chrUn_gl000220',
    })
  })

  test('three dots with numeric version - assembly.version.chr.more format', () => {
    const result = parseAssemblyAndChr('GRCh38.1.chr1.random')
    expect(result).toEqual({
      assemblyName: 'GRCh38.1',
      chr: 'chr1.random',
    })
  })

  test('empty string', () => {
    const result = parseAssemblyAndChr('')
    expect(result).toEqual({
      assemblyName: '',
      chr: '',
    })
  })

  test('just a dot', () => {
    const result = parseAssemblyAndChr('.')
    expect(result).toEqual({
      assemblyName: '',
      chr: '',
    })
  })

  test('leading dot', () => {
    const result = parseAssemblyAndChr('.chr1')
    expect(result).toEqual({
      assemblyName: '',
      chr: 'chr1',
    })
  })

  test('trailing dot', () => {
    const result = parseAssemblyAndChr('hg38.')
    expect(result).toEqual({
      assemblyName: 'hg38',
      chr: '',
    })
  })

  test('real world example - UCSC style', () => {
    const result = parseAssemblyAndChr('hg19.chr6_ssto_hap7')
    expect(result).toEqual({
      assemblyName: 'hg19',
      chr: 'chr6_ssto_hap7',
    })
  })

  test('real world example - Ensembl style with numeric', () => {
    const result = parseAssemblyAndChr('GRCh37.1.1')
    expect(result).toEqual({
      assemblyName: 'GRCh37.1',
      chr: '1',
    })
  })
})

describe('parseAssemblyAndChrSimple (BigMaf format)', () => {
  test('no dot - entire string is assembly name', () => {
    const result = parseAssemblyAndChrSimple('hg38')
    expect(result).toEqual({
      assemblyName: 'hg38',
      chr: '',
    })
  })

  test('single dot - simple org.chr format', () => {
    const result = parseAssemblyAndChrSimple('hg38.chr1')
    expect(result).toEqual({
      assemblyName: 'hg38',
      chr: 'chr1',
    })
  })

  test('multiple dots - only splits on first dot', () => {
    const result = parseAssemblyAndChrSimple('mm10.chr1.random')
    expect(result).toEqual({
      assemblyName: 'mm10',
      chr: 'chr1.random',
    })
  })

  test('empty string', () => {
    const result = parseAssemblyAndChrSimple('')
    expect(result).toEqual({
      assemblyName: '',
      chr: '',
    })
  })
})

describe('selectReferenceSequenceString', () => {
  const hg38Seq = 'ACGTACGT'
  const mm10Seq = 'TGCATGCA'
  const panTro6Seq = 'GGGGGGGG'
  const alignments = {
    hg38: { seq: hg38Seq },
    mm10: { seq: mm10Seq },
    panTro6: { seq: panTro6Seq },
  }

  test('uses refAssemblyName when provided and exists', () => {
    const result = selectReferenceSequenceString(
      alignments,
      'mm10',
      'hg38',
      'panTro6',
    )
    expect(result).toBe(mm10Seq)
  })

  test('falls back to queryAssemblyName when refAssemblyName is empty', () => {
    const result = selectReferenceSequenceString(
      alignments,
      '',
      'hg38',
      'panTro6',
    )
    expect(result).toBe(hg38Seq)
  })

  test('falls back to queryAssemblyName when refAssemblyName is undefined', () => {
    const result = selectReferenceSequenceString(
      alignments,
      undefined,
      'hg38',
      'panTro6',
    )
    expect(result).toBe(hg38Seq)
  })

  test('falls back to firstAssemblyNameFound when queryAssemblyName does not match', () => {
    const result = selectReferenceSequenceString(
      alignments,
      undefined,
      'galGal6', // not in alignments
      'hg38',
    )
    expect(result).toBe(hg38Seq)
  })

  test('falls back to firstAssemblyNameFound when both config values are empty', () => {
    const result = selectReferenceSequenceString(alignments, '', '', 'panTro6')
    expect(result).toBe(panTro6Seq)
  })

  test('returns undefined when refAssemblyName does not exist in alignments', () => {
    const result = selectReferenceSequenceString(
      alignments,
      'nonexistent',
      undefined,
      undefined,
    )
    expect(result).toBeUndefined()
  })

  test('returns undefined when no matches and all params undefined', () => {
    const result = selectReferenceSequenceString(
      alignments,
      undefined,
      undefined,
      undefined,
    )
    expect(result).toBeUndefined()
  })

  test('returns undefined for empty alignments object', () => {
    const result = selectReferenceSequenceString({}, 'hg38', 'mm10', 'panTro6')
    expect(result).toBeUndefined()
  })

  test('skips refAssemblyName when it does not exist and uses queryAssemblyName', () => {
    const result = selectReferenceSequenceString(
      alignments,
      'galGal6', // not in alignments
      'hg38',
      'panTro6',
    )
    expect(result).toBe(hg38Seq)
  })

  test('skips both refAssemblyName and queryAssemblyName when neither exists', () => {
    const result = selectReferenceSequenceString(
      alignments,
      'galGal6', // not in alignments
      'rn6', // not in alignments
      'mm10',
    )
    expect(result).toBe(mm10Seq)
  })
})

describe('assembly name lookup integration scenarios', () => {
  test('refAssemblyName config takes precedence over query.assemblyName', () => {
    const refSeq = 'REFERENCE_SEQ'
    const querySeq = 'QUERY_SEQ'
    const alignments = {
      hg38: { seq: refSeq },
      mm10: { seq: querySeq },
    }
    const result = selectReferenceSequenceString(
      alignments,
      'hg38',
      'mm10',
      'mm10',
    )
    expect(result).toBe(refSeq)
  })

  test('query.assemblyName works when refAssemblyName not configured', () => {
    const querySeq = 'QUERY_SEQ'
    const otherSeq = 'OTHER_SEQ'
    const alignments = {
      hg38: { seq: querySeq },
      mm10: { seq: otherSeq },
    }
    const result = selectReferenceSequenceString(alignments, '', 'hg38', 'mm10')
    expect(result).toBe(querySeq)
  })

  test('firstAssemblyNameFound is used as last resort fallback', () => {
    const firstSeq = 'FIRST_FOUND'
    const otherSeq = 'OTHER_SEQ'
    const alignments = {
      panTro6: { seq: firstSeq },
      mm10: { seq: otherSeq },
    }
    const result = selectReferenceSequenceString(
      alignments,
      '',
      'hg38',
      'panTro6',
    )
    expect(result).toBe(firstSeq)
  })
})

describe('real-world MAF format parsing', () => {
  test('ce10.chrI from UCSC 7-way alignment', () => {
    const result = parseAssemblyAndChr('ce10.chrI')
    expect(result).toEqual({
      assemblyName: 'ce10',
      chr: 'chrI',
    })
  })

  test('caePb3.Scfld02_18 scaffold format', () => {
    const result = parseAssemblyAndChr('caePb3.Scfld02_18')
    expect(result).toEqual({
      assemblyName: 'caePb3',
      chr: 'Scfld02_18',
    })
  })

  test('caeRem4.Crem_Contig16 contig format', () => {
    const result = parseAssemblyAndChr('caeRem4.Crem_Contig16')
    expect(result).toEqual({
      assemblyName: 'caeRem4',
      chr: 'Crem_Contig16',
    })
  })

  test('cb4.chrI C. briggsae format', () => {
    const result = parseAssemblyAndChr('cb4.chrI')
    expect(result).toEqual({
      assemblyName: 'cb4',
      chr: 'chrI',
    })
  })

  test('multiple assemblies from same MAF block produce correct lookup', () => {
    const ce10Seq = 'TCTTTTAGTATTTGTAA'
    const caePb3Seq = 'tcTTTTCGC-TTTATAA'
    const alignments = {
      ce10: { seq: ce10Seq },
      caePb3: { seq: caePb3Seq },
    }

    // When querying with ce10 assembly
    expect(selectReferenceSequenceString(alignments, '', 'ce10', 'ce10')).toBe(
      ce10Seq,
    )

    // When refAssemblyName is configured to override
    expect(
      selectReferenceSequenceString(alignments, 'caePb3', 'ce10', 'ce10'),
    ).toBe(caePb3Seq)
  })
})

describe('refName renaming compatibility', () => {
  test('parseAssemblyAndChr extracts chr correctly for refName alias matching', () => {
    // When a file uses "chrI" but assembly has alias "I" -> "chrI"
    // The chr portion extracted here should match what renameRegionsIfNeeded expects
    const { chr } = parseAssemblyAndChr('ce10.chrI')
    expect(chr).toBe('chrI')
  })

  test('parseAssemblyAndChrSimple extracts chr correctly for refName alias matching', () => {
    const { chr } = parseAssemblyAndChrSimple('ce10.chrI')
    expect(chr).toBe('chrI')
  })

  test('assembly name is isolated from chr for assembly-based lookups', () => {
    // The assembly name (e.g., "ce10") is used to look up reference sequence
    // It should not include the chr portion
    const { assemblyName } = parseAssemblyAndChr('ce10.chrI')
    expect(assemblyName).toBe('ce10')
  })
})

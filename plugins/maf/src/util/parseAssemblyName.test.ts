import {
  makeSourceResolver,
  matchSampleId,
  parseAssemblyAndChr,
  parseMafTabixEntry,
  scanMafTabixEntry,
  selectReferenceSequenceString,
} from './parseAssemblyName.ts'

// The form MafTabixAdapter actually uses: entries scanned in place out of the
// one comma-joined alignment column, never split into their own strings.
describe('scanMafTabixEntry over a comma-joined column', () => {
  const resolve = makeSourceResolver(new Set(['ce11', 'caeRem4'])).resolve
  const column =
    'ce11.chrI:100:6:+:15072434:GAATTC,' +
    'caeRem4.Crem_Contig89:203343:6:-:273340:gaattc'
  const scanAll = (text: string) => {
    const out = []
    for (let from = 0; from < text.length;) {
      let to = text.indexOf(',', from)
      if (to === -1) {
        to = text.length
      }
      out.push(scanMafTabixEntry(text, from, to, resolve))
      from = to + 1
    }
    return out
  }

  test('reads each entry at its own offset', () => {
    expect(scanAll(column)).toEqual([
      {
        assemblyName: 'ce11',
        chr: 'chrI',
        start: 100,
        strand: 1,
        srcSize: 15072434,
        seq: 'GAATTC',
      },
      {
        assemblyName: 'caeRem4',
        chr: 'Crem_Contig89',
        start: 203343,
        strand: -1,
        srcSize: 273340,
        seq: 'gaattc',
      },
    ])
  })

  // The hazard of scanning in place instead of splitting: `indexOf` does not
  // stop at the entry boundary, so a truncated entry would happily take its
  // fields from the species after it — a real sequence filed under the wrong
  // genome at the wrong coordinate, which nothing downstream could detect.
  test('a truncated entry is rejected, not completed from the next one', () => {
    const truncated =
      'ce11.chrI:100:6,caeRem4.Crem_Contig89:203343:6:-:273340:gaattc'
    const [first, second] = scanAll(truncated)
    expect(first).toBeUndefined()
    // ...and the scan still picks the following entry up intact
    expect(second).toMatchObject({ assemblyName: 'caeRem4', seq: 'gaattc' })
  })

  test('an entry with no sequence is rejected', () => {
    expect(scanAll('ce11.chrI:100:6:+:15072434:')[0]).toBeUndefined()
  })

  test('a sequence runs to the entry end, so a stray colon cannot truncate it', () => {
    // Colons cannot occur in MAF sequence characters, so taking the remainder
    // is strictly safer than stopping at a sixth colon would be.
    const entry = 'ce11.chrI:100:6:+:15072434:GA:TTC'
    expect(scanMafTabixEntry(entry, 0, entry.length, resolve)?.seq).toBe(
      'GA:TTC',
    )
  })
})

describe('parseMafTabixEntry', () => {
  const samples = makeSourceResolver(new Set(['ce11', 'caeRem4'])).resolve

  test('parses strand and srcSize from a + entry', () => {
    expect(
      parseMafTabixEntry('ce11.chrI:2996373:67:+:15072434:GAATTC', samples),
    ).toEqual({
      assemblyName: 'ce11',
      chr: 'chrI',
      start: 2996373,
      strand: 1,
      srcSize: 15072434,
      seq: 'GAATTC',
    })
  })

  test('parses a − entry (the strand the old code dropped)', () => {
    const e = parseMafTabixEntry(
      'caeRem4.Crem_Contig89:203343:79:-:273340:gaaatc',
      samples,
    )
    expect(e).toMatchObject({ strand: -1, srcSize: 273340, start: 203343 })
  })

  test('returns undefined for an unknown sample or malformed entry', () => {
    expect(
      parseMafTabixEntry('unknown.chr1:1:2:+:9:ACGT', samples),
    ).toBeUndefined()
    expect(parseMafTabixEntry('', samples)).toBeUndefined()
  })
})

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

describe('parseAssemblyAndChr (shared sample-discovery split)', () => {
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

// A bare accession's `.11` is its version, not a chromosome. Split the other
// way it collided with the file's real chromosome 11: the two interleave under
// one `.tai` key, breaking the ascending binary search over it, while a query
// for the accession itself resolved nothing at all.
describe('bare versioned accessions', () => {
  test('a RefSeq accession is the whole sequence name', () => {
    expect(parseAssemblyAndChr('NC_000001.11')).toEqual({
      assemblyName: 'NC_000001.11',
      chr: '',
    })
  })

  test('an assembly accession too', () => {
    expect(parseAssemblyAndChr('GCA_000001405.15')).toEqual({
      assemblyName: 'GCA_000001405.15',
      chr: '',
    })
  })

  test('a prefixed accession still splits on the assembly', () => {
    expect(parseAssemblyAndChr('hg38.NC_000001.11')).toEqual({
      assemblyName: 'hg38',
      chr: 'NC_000001.11',
    })
  })

  // Only the underscore form is recognised. `NA12878.1` has exactly the shape
  // of a bare GenBank accession and is exactly as likely to be a sample id
  // carrying an Ensembl chromosome number, so guessing there would break a real
  // naming scheme to fix a rarer one.
  test('a sample id with an Ensembl chromosome is untouched', () => {
    expect(parseAssemblyAndChr('NA12878.1')).toEqual({
      assemblyName: 'NA12878',
      chr: '1',
    })
    expect(parseAssemblyAndChr('CM000663.2')).toEqual({
      assemblyName: 'CM000663',
      chr: '2',
    })
  })

  test('an underscore-bearing assembly name is untouched', () => {
    expect(parseAssemblyAndChr('Homo_sapiens.1')).toEqual({
      assemblyName: 'Homo_sapiens',
      chr: '1',
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

  test('assembly name is isolated from chr for assembly-based lookups', () => {
    // The assembly name (e.g., "ce10") is used to look up reference sequence
    // It should not include the chr portion
    const { assemblyName } = parseAssemblyAndChr('ce10.chrI')
    expect(assemblyName).toBe('ce10')
  })
})

// Dropping a row whose token matches no configured sample is normal — listing
// five species of a thirty-way is how you ask for five rows. The failure this
// watches for is the all-or-nothing one: ids that describe some *other* file, so
// every row drops and the track paints the configured species as labelled rows
// with not one base under them. Only here are both sides in hand to tell those
// apart.
describe('makeSourceResolver reports a sample set that matches nothing', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  afterEach(() => {
    warn.mockClear()
  })
  afterAll(() => {
    warn.mockRestore()
  })

  it('says nothing when a subset config matches some of the file', () => {
    const r = makeSourceResolver(new Set(['hg38']))
    expect(r.resolve('hg38.chr1')).toEqual({
      assemblyName: 'hg38',
      chr: 'chr1',
    })
    expect(r.resolve('panTro4.chr1')).toBeUndefined()
    r.reportUnmatched()
    expect(warn).not.toHaveBeenCalled()
  })

  it('names both sides when nothing at all matched', () => {
    const r = makeSourceResolver(new Set(['Pan_troglodytes', 'Mus_musculus']))
    for (const token of ['hg38.chr1', 'panTro4.chr1', 'mm10.chr1']) {
      expect(r.resolve(token)).toBeUndefined()
    }
    r.reportUnmatched()
    expect(warn).toHaveBeenCalledTimes(1)
    const msg = warn.mock.calls[0]![0] as string
    // the file's tokens, so the user can see what the ids should have looked like
    expect(msg).toContain('"hg38.chr1"')
    // ...and their own ids back, so they can see which side is wrong
    expect(msg).toContain('"Pan_troglodytes"')
  })

  it('caps both lists rather than printing a 447-way', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `sample${i}`)
    const r = makeSourceResolver(new Set(ids))
    for (let i = 0; i < 40; i++) {
      r.resolve(`other${i}.chr1`)
    }
    r.reportUnmatched()
    const msg = warn.mock.calls[0]![0] as string
    expect(msg).toContain('(+37 more)')
    expect(msg).toContain('(+35 more)')
  })

  // No configured set is the discovery path, where every token resolves by the
  // dot heuristic and there is nothing to report.
  it('stays silent with no sample set at all', () => {
    const r = makeSourceResolver()
    expect(r.resolve('hg38.chr1')).toEqual({
      assemblyName: 'hg38',
      chr: 'chr1',
    })
    r.reportUnmatched()
    expect(warn).not.toHaveBeenCalled()
  })

  // Memoization changed `matched`/`seen` from counting occurrences to counting
  // distinct tokens. The diagnostic fires on `matched === 0`, which is the same
  // statement either way — these pin that the two mixed cases still behave.
  it('still stays silent when one of several distinct tokens matches', () => {
    const r = makeSourceResolver(new Set(['hg38']))
    for (let i = 0; i < 50; i++) {
      r.resolve('hg38.chr1')
      r.resolve('panTro4.chr1')
      r.resolve('mm10.chr1')
    }
    r.reportUnmatched()
    expect(warn).not.toHaveBeenCalled()
  })

  it('memoizes per token, including the undefined answer', () => {
    const r = makeSourceResolver(new Set(['hg38']))
    // same object back, which is only true if the walk was not redone — and the
    // filtered-out species is the case that most needs it, since every one of
    // its rows asks the same question
    expect(r.resolve('hg38.chr1')).toBe(r.resolve('hg38.chr1'))
    expect(r.resolve('panTro4.chr1')).toBeUndefined()
    expect(r.resolve('panTro4.chr1')).toBeUndefined()
    // ...and the memo did not corrupt the answers themselves
    expect(r.resolve('hg38.chr2')).toEqual({
      assemblyName: 'hg38',
      chr: 'chr2',
    })
  })

  it('reports once per fetch, not once per row', () => {
    const r = makeSourceResolver(new Set(['nope']))
    for (let i = 0; i < 100; i++) {
      r.resolve('hg38.chr1')
    }
    r.reportUnmatched()
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

// PanSN (`sample#haplotype#contig`) is a written spec with `#` as its declared
// delimiter, and this repo's own `build_ecoli_pangenome_graph.sh` emits it. The
// resolver knew only `.`, so a PanSN file discovered one row per *contig* named
// with the whole token and an empty `chr` — and with a configured `samples` list
// it matched nothing whatsoever.
describe('PanSN source tokens', () => {
  test('discovery keeps the haplotype on the row and the contig as chr', () => {
    expect(parseAssemblyAndChr('HG002#1#chr1')).toEqual({
      assemblyName: 'HG002#1',
      chr: 'chr1',
    })
    // this repo's E. coli pangenome naming
    expect(parseAssemblyAndChr('K12#1#chr')).toEqual({
      assemblyName: 'K12#1',
      chr: 'chr',
    })
  })

  // Collapsing both haplotypes onto `HG002` would make them one key in the
  // per-block `alignments` record, so the second would overwrite the first and a
  // diploid assembly would lose half its rows.
  test('two haplotypes of one sample stay two rows', () => {
    expect(parseAssemblyAndChr('HG002#1#chr1').assemblyName).not.toBe(
      parseAssemblyAndChr('HG002#2#chr1').assemblyName,
    )
  })

  test('tolerates the two-field form and a contig containing #', () => {
    expect(parseAssemblyAndChr('HG002#chr1')).toEqual({
      assemblyName: 'HG002',
      chr: 'chr1',
    })
    expect(parseAssemblyAndChr('HG002#1#ctg#7')).toEqual({
      assemblyName: 'HG002#1',
      chr: 'ctg#7',
    })
  })

  test('matches at a # boundary, longest id first', () => {
    expect(matchSampleId('K12#1#chr', new Set(['K12']))).toEqual({
      assemblyName: 'K12',
      chr: '1#chr',
    })
    expect(matchSampleId('K12#1#chr', new Set(['K12#1']))).toEqual({
      assemblyName: 'K12#1',
      chr: 'chr',
    })
    // both listed: the more specific one wins, as with dotted haplotypes
    expect(matchSampleId('K12#1#chr', new Set(['K12', 'K12#1']))).toEqual({
      assemblyName: 'K12#1',
      chr: 'chr',
    })
  })

  // Widening the separator set can only resolve tokens that resolved to
  // nothing, or resolve one to a longer id the config explicitly listed — it
  // never invents a genome.
  test('leaves dotted tokens resolving exactly as before', () => {
    expect(parseAssemblyAndChr('hg38.chr1')).toEqual({
      assemblyName: 'hg38',
      chr: 'chr1',
    })
    expect(parseAssemblyAndChr('Species1.1.chr3')).toEqual({
      assemblyName: 'Species1.1',
      chr: 'chr3',
    })
    expect(matchSampleId('mm10.chr1.random', new Set(['mm10']))).toEqual({
      assemblyName: 'mm10',
      chr: 'chr1.random',
    })
    expect(matchSampleId('nope.chr1', new Set(['mm10']))).toBeUndefined()
  })
})

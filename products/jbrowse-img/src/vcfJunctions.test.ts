import { parseVcfJunctions } from './vcfJunctions.ts'

function vcf(...lines: string[]) {
  return [
    '##fileformat=VCFv4.2',
    '##contig=<ID=chr3,length=198295559>',
    '##contig=<ID=chr12,length=133275309>',
    '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
    ...lines,
  ].join('\n')
}

describe('parseVcfJunctions', () => {
  it('reads a breakend whose ALT carries inserted sequence', () => {
    // The case a regex over one base of context drops in silence, and the one
    // COLO829's own callset is mostly made of. Delegated to @gmod/vcf.
    const { records } = parseVcfJunctions(
      vcf(
        'chr3\t25359111\ta1\tG\tGTGATGGATTCA[chr12:72273112[\t.\tPASS\tSVTYPE=BND',
      ),
    )
    expect(records).toHaveLength(1)
    expect(records[0]!.loci).toEqual([
      { refName: 'chr3', start: 25359110, end: 25359111 },
      { refName: 'chr12', start: 72273111, end: 72273112 },
    ])
  })

  it('writes the mate contig in the file’s own spelling, not the ALT’s', () => {
    // Callers upper-case it in the bracket. `CHR12` is not a region the assembly
    // has, so the panel renders empty rather than failing.
    const { records } = parseVcfJunctions(
      vcf('chr3\t25359111\ta1\tG\tG[CHR12:72273112[\t.\tPASS\tSVTYPE=BND'),
    )
    expect(records[0]!.loci[1]!.refName).toBe('chr12')
  })

  it('collapses a reciprocal breakend pair into one junction', () => {
    const { records } = parseVcfJunctions(
      vcf(
        'chr3\t25359111\ta1\tG\tGTGATGGATTCA[CHR12:72273112[\t.\tPASS\tSVTYPE=BND',
        'chr12\t72273112\ta0\tG\t]CHR3:25359111]TGAATCCATCAG\t.\tPASS\tSVTYPE=BND',
      ),
    )
    expect(records).toHaveLength(1)
  })

  it('collapses a pair the caller disagrees with itself about by a base', () => {
    const { records } = parseVcfJunctions(
      vcf(
        'chr3\t25359111\ta1\tG\tG[CHR12:72273112[\t.\tPASS\tSVTYPE=BND',
        'chr12\t72273114\ta0\tG\t]CHR3:25359109]T\t.\tPASS\tSVTYPE=BND',
      ),
    )
    expect(records).toHaveLength(1)
  })

  it('does not chain a drifting run into one junction', () => {
    // Each record is compared to what was KEPT, not to its neighbour, so
    // 300/308/316 at tolerance 10 keeps the two ends and drops only the middle.
    const { records } = parseVcfJunctions(
      vcf(
        'chr3\t300\tx\tG\tG[chr12:1[\t.\tPASS\tSVTYPE=BND',
        'chr3\t308\ty\tG\tG[chr12:1[\t.\tPASS\tSVTYPE=BND',
        'chr3\t316\tz\tG\tG[chr12:1[\t.\tPASS\tSVTYPE=BND',
      ),
    )
    expect(records.map(r => r.loci[0]!.end)).toEqual([300, 316])
  })

  it('reads a symbolic DEL/DUP/INV through INFO END', () => {
    const { records } = parseVcfJunctions(
      vcf('chr3\t1000\td\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL;END=2000'),
    )
    expect(records[0]!.loci).toEqual([
      { refName: 'chr3', start: 999, end: 1000 },
      { refName: 'chr3', start: 1999, end: 2000 },
    ])
  })

  it('matches END at the start of its own field, not inside CIEND', () => {
    // `END=(\d+)` unanchored also matches inside CIEND=5,10 and the first hit
    // wins, which puts the junction at position 5: a plausible locus, no
    // warning, wrong picture.
    const { records } = parseVcfJunctions(
      vcf('chr3\t1000\td\tN\t<DUP>\t.\tPASS\tSVTYPE=DUP;CIEND=5,10;END=9000'),
    )
    expect(records[0]!.loci[1]!.end).toBe(9000)
  })

  it('honours CHR2 when a caller writes an interchromosomal symbolic record', () => {
    const { records } = parseVcfJunctions(
      vcf('chr3\t1000\tt\tN\t<TRA>\t.\tPASS\tSVTYPE=INV;CHR2=chr12;END=9000'),
    )
    expect(records[0]!.loci[1]!.refName).toBe('chr12')
  })

  it('reads a Delly/LUMPY-style SVTYPE=TRA', () => {
    const { records } = parseVcfJunctions(
      vcf('chr3\t1000\tt\tN\t<TRA>\t.\tPASS\tSVTYPE=TRA;CHR2=chr12;END=9000'),
    )
    expect(records[0]!.loci).toEqual([
      { refName: 'chr3', start: 999, end: 1000 },
      { refName: 'chr12', start: 8999, end: 9000 },
    ])
  })

  it('keeps a record that names no second locus as the one it does name', () => {
    // half of a long-read germline callset is insertions
    const { records, skipped } = parseVcfJunctions(
      vcf(
        'chr3\t1000\ti\tN\t<INS>\t.\tPASS\tSVTYPE=INS',
        'chr3\t2000\ts\tN\tN.\t.\tPASS\tSVTYPE=BND',
      ),
    )
    expect(records.map(r => r.loci)).toEqual([
      [{ refName: 'chr3', start: 999, end: 1000 }],
      [{ refName: 'chr3', start: 1999, end: 2000 }],
    ])
    expect(skipped).toEqual([])
  })

  it('reads an insertion whose END is its own POS as one locus', () => {
    const { records } = parseVcfJunctions(
      vcf('chr3\t1000\ti\tN\t<INS>\t.\tPASS\tSVTYPE=INS;END=1000;SVLEN=312'),
    )
    expect(records[0]!.loci).toHaveLength(1)
  })

  it('keeps two insertions at one position as two calls', () => {
    const { records } = parseVcfJunctions(
      vcf(
        'chr3\t1000\ti1\tN\t<INS>\t.\tPASS\tSVTYPE=INS',
        'chr3\t1000\ti2\tN\t<INS>\t.\tPASS\tSVTYPE=INS',
      ),
    )
    expect(records.map(r => r.name)).toEqual(['i1', 'i2'])
  })

  it('does not mistake a symbolic mate placeholder for a contig', () => {
    // parseBreakend returns `<DEL>:1` for `G<DEL>`, i.e. a symbolic allele id
    // where a contig name belongs.
    const { records } = parseVcfJunctions(
      vcf('chr3\t1000\tp\tG\tG<DEL>\t.\tPASS\tSVTYPE=BND'),
    )
    expect(records[0]!.loci).toEqual([
      { refName: 'chr3', start: 999, end: 1000 },
    ])
  })

  it('reports a record with no SVTYPE', () => {
    const { records, skipped } = parseVcfJunctions(
      vcf('chr3\t1000\tsnv\tA\tG\t.\tPASS\tDP=30'),
    )
    expect(records).toEqual([])
    expect(skipped[0]).toMatch(/no SVTYPE/)
  })

  it('files a junction under the caller’s own ID', () => {
    // So an image traces back to the VCF row that produced it. The old
    // `junction_N` was outputName's leading index again, off by one from it.
    const { records } = parseVcfJunctions(
      vcf('chr3\t1000\tgridss12o\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL;END=2000'),
    )
    expect(records[0]!.name).toBe('gridss12o')
  })

  it('falls back to an index when the file supplies no ID', () => {
    const { records } = parseVcfJunctions(
      vcf('chr3\t1000\t.\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL;END=2000'),
    )
    expect(records[0]!.name).toBe('junction_0')
  })

  it('canonicalizes a mate contig first seen before its own record', () => {
    // The map is filled WHILE the records are read, so reading it inside the
    // loop left `CHR12` uncanonical whenever it appeared before the record that
    // establishes `chr12` — and a header that names no contigs is what exposes
    // it. The panel then renders empty rather than failing.
    const { records } = parseVcfJunctions(
      [
        '##fileformat=VCFv4.2',
        '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
        'chr3\t100\ta\tG\tG[CHR12:200[\t.\tPASS\tSVTYPE=BND',
        'chr12\t900\tb\tG\tG[chr3:500[\t.\tPASS\tSVTYPE=BND',
      ].join('\n'),
    )
    expect(records.map(r => r.loci[1]!.refName)).toEqual(['chr12', 'chr3'])
  })

  it('drops a filtered record under passOnly, and reports it', () => {
    const { records, skipped } = parseVcfJunctions(
      vcf(
        'chr3\t1000\ta\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL;END=2000',
        'chr3\t5000\tb\tN\t<DEL>\t.\tLOW_QUAL\tSVTYPE=DEL;END=6000',
        // `.` is "no filter applied", which is a pass rather than a fail
        'chr3\t8000\tc\tN\t<DEL>\t.\t.\tSVTYPE=DEL;END=9000',
      ),
      { passOnly: true },
    )
    expect(records.map(r => r.name)).toEqual(['a', 'c'])
    expect(skipped[0]).toMatch(/FILTER is "LOW_QUAL"/)
  })
})

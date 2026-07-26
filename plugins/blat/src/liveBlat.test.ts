/**
 * Live UCSC round-trip: a real hgBlat response, parsed and converted to SAM.
 *
 * Skipped unless UCSC_API_KEY is set, since it needs an account key (keyless
 * hgBlat is behind a Cloudflare Turnstile) and the network. Everything else
 * about the conversion is covered offline by pslToSam.test.ts / blatQuery.test.ts;
 * what only a live run can show is that the response shape those tests fake is
 * the shape the server actually sends, and that a hit's coordinates come back
 * where the query was taken from.
 *
 * UCSC rate-limits a key to one hgBlat hit per 15s, so all four queries go in
 * one multi-record FASTA — the same path a user pasting a multi-FASTA takes.
 */
import {
  DEFAULT_BLAT_URL,
  buildBlatBody,
  parseBlatResponse,
} from './blatQuery.ts'
import { parseQuerySequences, pslToSam } from './pslToSam.ts'

const apiKey = process.env.UCSC_API_KEY

// hg38 ACTB intron 1, a locus with one good placement
const DB = 'hg38'
const CHROM = 'chr7'
const START = 5527151
const END = 5527451

// leading bases that should come back as a soft clip rather than aligning
const JUNK = 'CGTACGTACGTACGT'

function cigarOps(cigar: string) {
  return [...cigar.matchAll(/(\d+)([A-Z])/g)].map(m => ({
    len: Number(m[1]),
    op: m[2]!,
  }))
}

function opTotal(cigar: string, op: string) {
  return cigarOps(cigar)
    .filter(o => o.op === op)
    .reduce((a, b) => a + b.len, 0)
}

function samLines(sam: string) {
  return sam
    .split('\n')
    .filter(line => line && !line.startsWith('@'))
    .map(line => {
      const f = line.split('\t')
      return {
        qName: f[0]!,
        flag: Number(f[1]),
        rName: f[2]!,
        pos: Number(f[3]),
        mapq: Number(f[4]),
        cigar: f[5]!,
        seq: f[9]!,
        nm: Number(/NM:i:(\d+)/.exec(line)?.[1]),
      }
    })
}

function substitute(seq: string, at: number, base: string) {
  return seq.slice(0, at) + base + seq.slice(at + 1)
}

const maybe = apiKey ? describe : describe.skip

maybe('live UCSC BLAT round-trip', () => {
  it('places four variants of a known hg38 locus back at that locus', async () => {
    fetchMock.dontMock()

    const seqRes = await fetch(
      `https://api.genome.ucsc.edu/getData/sequence?genome=${DB};chrom=${CHROM};start=${START};end=${END}`,
    )
    const { dna } = (await seqRes.json()) as { dna: string }
    const ref = dna.toUpperCase()
    expect(ref).toHaveLength(END - START)

    const del = ref.slice(0, 150) + ref.slice(156)
    const clipped = JUNK + ref
    const snvSites = [50, 150, 250]
    const snv = snvSites.reduce(
      (seq, at) => substitute(seq, at, ref[at] === 'A' ? 'C' : 'A'),
      ref,
    )
    const query = [
      `>exact\n${ref}`,
      `>del6\n${del}`,
      `>clip15\n${clipped}`,
      `>snv3\n${snv}`,
      '',
    ].join('\n')

    const res = await fetch(DEFAULT_BLAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildBlatBody({ db: DB, seq: query, apiKey }),
    })
    const rows = parseBlatResponse(await res.text())
    const sam = pslToSam(rows, parseQuerySequences(query))
    const lines = samLines(sam)
    const primary = new Map(
      lines.filter(l => !(l.flag & 256)).map(l => [l.qName, l]),
    )

    // the @SQ line lets a SamAdapter know the reference without the assembly
    expect(sam).toContain(`@SQ\tSN:${CHROM}\t`)

    for (const [name, line] of primary) {
      expect(line.rName).toBe(CHROM)
      expect(line.mapq).toBe(255)
      // forward-strand placement of a forward-strand query
      expect(line.flag & 16).toBe(0)
      // CIGAR and SEQ agree on the query length, which is what makes the
      // record walkable at all
      expect(
        opTotal(line.cigar, 'M') +
          opTotal(line.cigar, 'I') +
          opTotal(line.cigar, 'S'),
      ).toBe(line.seq.length)
      expect(line.seq).not.toBe('*')
      // what the server actually placed, for a manual run
      // eslint-disable-next-line no-console
      console.log(`${name}\t${line.rName}:${line.pos}\t${line.cigar}`)
    }

    const exact = primary.get('exact')!
    expect(exact.pos).toBe(START + 1)
    expect(exact.cigar).toBe(`${ref.length}M`)

    // a query missing 6 target bases states them as a deletion, not a shorter
    // block or a second hit
    const del6 = primary.get('del6')!
    expect(del6.pos).toBe(START + 1)
    expect(opTotal(del6.cigar, 'D')).toBe(6)
    expect(opTotal(del6.cigar, 'M')).toBe(del.length)

    // unalignable query bases stay in SEQ as a soft clip, so the read keeps
    // its full sequence and the clip renders
    const clip15 = primary.get('clip15')!
    expect(cigarOps(clip15.cigar)[0]!.op).toBe('S')
    expect(clip15.seq).toHaveLength(clipped.length)
    expect(clip15.pos + opTotal(clip15.cigar, 'M')).toBe(END + 1)

    // PSL states mismatches as a count, so the bases themselves have to come
    // from the submitted query — this is the record a pileup reads to draw
    // per-base mismatches against the assembly
    const snv3 = primary.get('snv3')!
    expect(snv3.pos).toBe(START + 1)
    expect(snv3.cigar).toBe(`${ref.length}M`)
    expect(snv3.nm).toBe(snvSites.length)
    const differing: number[] = []
    for (let i = 0; i < ref.length; i++) {
      if (snv3.seq[i] !== ref[i]) {
        differing.push(i)
      }
    }
    expect(differing).toEqual(snvSites)
  }, 120000)
})

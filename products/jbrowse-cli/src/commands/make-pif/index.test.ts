/**
 * @jest-environment node
 */

import fs from 'node:fs'
import path from 'node:path'
import { Writable } from 'node:stream'
import { gunzipSync } from 'node:zlib'

import { runCommand, runInTmpDir } from '../../testUtil.ts'
import { createPIF } from './pif-generator.ts'

const base = path.join(__dirname, '..', '..', '..', 'test', 'data')
const simplePaf = path.join(base, 'volvox_inv_indels.paf')

const exists = (p: string) => fs.existsSync(p)

// discards the PIF output; the tests using it only care about the returned
// PanSN detection
const sink = () =>
  new Writable({
    write(_chunk, _enc, cb) {
      cb()
    },
  })

test('make-pif', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn])
    expect(exists(fn)).toBeTruthy()
    expect(gunzipSync(fs.readFileSync(fn)).toString()).toMatchSnapshot()
  })
})

test('make-pif with --coarse emits one T/Q coarse row per alignment, CIGAR stripped', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn, '--coarse', '50000'])
    const content = gunzipSync(fs.readFileSync(fn)).toString()
    const lines = content.split('\n').filter(Boolean)
    const fineT = lines.filter(l => l.startsWith('t'))
    const fineQ = lines.filter(l => l.startsWith('q'))
    const coarseT = lines.filter(l => l.startsWith('T'))
    const coarseQ = lines.filter(l => l.startsWith('Q'))
    expect(coarseT.length).toBeGreaterThan(0)
    expect(coarseT.length).toBe(fineT.length)
    expect(coarseQ.length).toBe(fineQ.length)
    for (const l of coarseT) {
      expect(l).not.toMatch(/cg:Z:/)
      // no row has an indel over 25kb or leans by that much, so every fold is
      // one run and there is no coarse CIGAR to write
      expect(l).not.toMatch(/cr:Z:/)
      expect(l).toMatch(/de:f:/)
    }
  })
})

test('make-pif emits T/Q coarse tier by default', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn])
    const content = gunzipSync(fs.readFileSync(fn)).toString()
    const lines = content.split('\n').filter(Boolean)
    const coarseT = lines.filter(l => l.startsWith('T'))
    const coarseQ = lines.filter(l => l.startsWith('Q'))
    expect(coarseT.length).toBeGreaterThan(0)
    expect(coarseQ.length).toBeGreaterThan(0)
    for (const l of coarseT) {
      expect(l).not.toMatch(/cg:Z:/)
      expect(l).toMatch(/de:f:/)
    }
  })
})

test('make-pif --no-coarse omits T/Q coarse tier', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn, '--no-coarse'])
    const content = gunzipSync(fs.readFileSync(fn)).toString()
    const lines = content.split('\n').filter(Boolean)
    expect(lines.some(l => l.startsWith('T'))).toBe(false)
    expect(lines.some(l => l.startsWith('Q'))).toBe(false)
  })
})

test('make-pif converts a cs difference string to a cg CIGAR', async () => {
  await runInTmpDir(async ({ dir }) => {
    const pafPath = path.join(dir, 'cs.paf')
    // one PAF row on + strand carrying only a cs:Z: tag (no cg:Z:)
    fs.writeFileSync(
      pafPath,
      `${[
        'q1',
        '100',
        '0',
        '10',
        '+',
        't1',
        '100',
        '0',
        '10',
        '9',
        '10',
        '60',
        'cs:Z::6*ct+gt:1',
      ].join('\t')}\n`,
    )
    const fn = 'cs.pif.gz'
    await runCommand(['make-pif', pafPath, '--out', fn, '--no-coarse'])
    const lines = gunzipSync(fs.readFileSync(fn))
      .toString()
      .split('\n')
      .filter(Boolean)
    const tRow = lines.find(l => l.startsWith('t'))!
    const qRow = lines.find(l => l.startsWith('q'))!
    // cs :6*ct+gt:1 -> 6=1X2I1=; q-row swaps I<->D on + strand
    expect(tRow).toContain('cg:Z:6=1X2I1=')
    expect(qRow).toContain('cg:Z:6=1X2D1=')
    expect(tRow).not.toContain('cs:Z:')
  })
})

test('coarse-tier identity matches the fine tier (no LOD-threshold jump)', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn])
    const lines = gunzipSync(fs.readFileSync(fn))
      .toString()
      .split('\n')
      .filter(Boolean)
    const de = (l: string) =>
      l
        .split('\t')
        .find(f => f.startsWith('de:f:'))
        ?.slice(5)
    // Every fine `t` row carries the aligner's de:f: tag; a coarse `T` row must
    // reuse that exact value rather than recomputing a divergent one, so
    // identity coloring is continuous across the coarse/fine LOD switch.
    const fineDe = new Set(lines.filter(l => l.startsWith('t')).map(de))
    const coarseDe = lines.filter(l => l.startsWith('T')).map(de)
    expect(coarseDe.length).toBeGreaterThan(0)
    for (const d of coarseDe) {
      expect(fineDe.has(d)).toBe(true)
    }
  })
})

test('coarse tier keeps the aligner de:f: tag for a plain M CIGAR', async () => {
  await runInTmpDir(async ({ dir }) => {
    const pafPath = path.join(dir, 'mcigar.paf')
    // A plain `cg:Z:100M` CIGAR folds substitutions into M, so a CIGAR
    // recompute would report 0 divergence. minimap2's de:f: tag carries the
    // real 10% divergence and must survive into the (unsplit) coarse row.
    fs.writeFileSync(
      pafPath,
      `${[
        'q1',
        '100',
        '0',
        '100',
        '+',
        't1',
        '100',
        '0',
        '100',
        '90',
        '100',
        '60',
        'cg:Z:100M',
        'de:f:0.100000',
      ].join('\t')}\n`,
    )
    const fn = 'mcigar.pif.gz'
    await runCommand(['make-pif', pafPath, '--out', fn])
    const lines = gunzipSync(fs.readFileSync(fn))
      .toString()
      .split('\n')
      .filter(Boolean)
    const coarseT = lines.find(l => l.startsWith('T'))!
    const coarseQ = lines.find(l => l.startsWith('Q'))!
    expect(coarseT).toContain('de:f:0.100000')
    expect(coarseQ).toContain('de:f:0.100000')
  })
})

test('coarse identity matches fine for a cg CIGAR with no de:f: tag', async () => {
  await runInTmpDir(async ({ dir }) => {
    const pafPath = path.join(dir, 'nodetag.paf')
    // A cg:Z:100M CIGAR folds substitutions into M, and there is NO de:f: tag.
    // The row's own num_matches/block_len columns (90/100) are the only honest
    // identity signal. A CIGAR recompute would report 0 divergence (100%
    // identity) — the coarse tier must instead reuse 1 - 90/100 = 0.1 so it
    // colors identically to the fine tier across the LOD switch.
    fs.writeFileSync(
      pafPath,
      `${[
        'q1',
        '100',
        '0',
        '100',
        '+',
        't1',
        '100',
        '0',
        '100',
        '90',
        '100',
        '60',
        'cg:Z:100M',
      ].join('\t')}\n`,
    )
    const fn = 'nodetag.pif.gz'
    await runCommand(['make-pif', pafPath, '--out', fn])
    const lines = gunzipSync(fs.readFileSync(fn))
      .toString()
      .split('\n')
      .filter(Boolean)
    const coarseT = lines.find(l => l.startsWith('T'))!
    const coarseQ = lines.find(l => l.startsWith('Q'))!
    expect(coarseT).toContain('de:f:0.100000')
    expect(coarseQ).toContain('de:f:0.100000')
  })
})

// A PAF row helper: 12 mandatory columns plus whatever tags the test needs
function pafRow(
  tags: string[],
  overrides: Partial<Record<number, string>> = {},
) {
  const cols = [
    'q1',
    '100',
    '0',
    '100',
    '+',
    't1',
    '100',
    '0',
    '100',
    '90',
    '100',
    '60',
  ]
  for (const [i, v] of Object.entries(overrides)) {
    cols[+i] = v!
  }
  return `${[...cols, ...tags].join('\t')}\n`
}

async function pifLines(paf: string, args: string[] = []) {
  const pafPath = path.join(process.cwd(), 'in.paf')
  fs.writeFileSync(pafPath, paf)
  await runCommand(['make-pif', pafPath, '--out', 'out.pif.gz', ...args])
  return gunzipSync(fs.readFileSync('out.pif.gz'))
    .toString()
    .split('\n')
    .filter(Boolean)
}

const tagValue = (line: string, prefix: string) =>
  line
    .split('\t')
    .find(f => f.startsWith(prefix))
    ?.slice(prefix.length)

// `minimap2 -c --cs` emits BOTH cg:Z: and cs:Z:. The two disagree about
// orientation once a row is re-anchored on its query: make-pif flips the cg,
// and a cs left beside it still describes the target perspective. That is not
// merely stale — SyntenyFeature.forEachMismatch prefers cs over the CIGAR, so
// the q row drew every indel with reversed sense. A PIF row carries one
// alignment string; cs is folded into the cg (and wins, since it spells out
// =/X where minimap2's own cg says M).
test('a row carrying both cg and cs emits one cg, folded from the cs', async () => {
  await runInTmpDir(async () => {
    const lines = await pifLines(
      pafRow(['cg:Z:10M4D30M', 'cs:Z::10-acgt:30'], { 3: '40', 8: '44' }),
      ['--no-coarse'],
    )
    const tRow = lines.find(l => l.startsWith('t'))!
    const qRow = lines.find(l => l.startsWith('q'))!
    // the cs spells the run out as =/X where the cg said M, so it is what
    // survives; the deletion flips to an insertion on the query perspective
    expect(tagValue(tRow, 'cg:Z:')).toBe('10=4D30=')
    expect(tagValue(qRow, 'cg:Z:')).toBe('10=4I30=')
    // neither perspective carries a cs that could contradict its CIGAR
    expect(tRow).not.toContain('cs:Z:')
    expect(qRow).not.toContain('cs:Z:')
    // exactly one alignment string per row
    expect(tRow.split('\t').filter(f => f.startsWith('cg:Z:'))).toHaveLength(1)
    expect(qRow.split('\t').filter(f => f.startsWith('cg:Z:'))).toHaveLength(1)
  })
})

// odgi untangle writes id:f: and no de:f:. pafIdentity reads de -> id ->
// num_matches/block_len, so a coarse tier that skipped the id rung colored off
// 90/100 while the fine tier colored off id=0.99 — a visible jump at the zoom
// where the tier switches.
test('coarse identity follows the id:f: tag when there is no de:f:', async () => {
  await runInTmpDir(async () => {
    const lines = await pifLines(pafRow(['cg:Z:100M', 'id:f:0.99']))
    const coarseT = lines.find(l => l.startsWith('T'))!
    // 1 - 0.99, not 1 - 90/100
    expect(+tagValue(coarseT, 'de:f:')!).toBeCloseTo(0.01, 6)
    expect(tagValue(coarseT, 'id:f:')).toBe('0.99')
  })
})

test('a degenerate zero block length reads as 0% identity on both tiers', async () => {
  await runInTmpDir(async () => {
    // block_len 0 makes pafIdentity return 0; the coarse tier used to write
    // de:f:0, which reads back as 100%
    const lines = await pifLines(pafRow(['cg:Z:100M'], { 9: '0', 10: '0' }))
    const coarseT = lines.find(l => l.startsWith('T'))!
    expect(tagValue(coarseT, 'de:f:')).toBe('1.000000')
  })
})

test('coarse rows carry the non-alignment tags through', async () => {
  await runInTmpDir(async () => {
    const lines = await pifLines(
      pafRow(['tp:A:P', 'cm:i:87', 'cg:Z:100M', 'cs:Z::100', 'de:f:0.0908']),
    )
    for (const l of lines.filter(l => /^[TQ]/.test(l))) {
      expect(l).toContain('tp:A:P')
      expect(l).toContain('cm:i:87')
      // the alignment strings are the whole point of the tier being coarse
      expect(l).not.toContain('cg:Z:')
      expect(l).not.toContain('cs:Z:')
      // and a 100M row has no gap for a coarse CIGAR to keep
      expect(l).not.toContain('cr:Z:')
      // the aligner's own de string, not a toFixed restatement of it
      expect(tagValue(l, 'de:f:')).toBe('0.0908')
      expect(l.split('\t').filter(f => f.startsWith('de:f:'))).toHaveLength(1)
    }
  })
})

test('a coarse row keeps its columns and carries the CIGAR fold as cr:Z:', async () => {
  await runInTmpDir(async () => {
    // 40M + a 1kb deletion + 40M. The row stays one row with the PAF columns
    // verbatim; the deletion, at or above --coarse, survives into the coarse
    // CIGAR, which the Q row carries from the query's side (D<->I on +).
    const lines = await pifLines(
      pafRow(['cg:Z:40M1000D40M'], { 3: '80', 8: '1080', 9: '40', 10: '80' }),
      ['--coarse', '500'],
    )
    const coarseT = lines.filter(l => l.startsWith('T'))
    const coarseQ = lines.filter(l => l.startsWith('Q'))
    expect(coarseT).toHaveLength(1)
    expect(coarseQ).toHaveLength(1)
    const [, , tstart, tend, , , , qstart, qend, numMatches, blockLen] =
      coarseT[0]!.split('\t')
    expect([tstart, tend, qstart, qend]).toEqual(['0', '1080', '0', '80'])
    expect([numMatches, blockLen]).toEqual(['40', '80'])
    expect(tagValue(coarseT[0]!, 'cr:Z:')).toBe('40M1000D40M')
    expect(tagValue(coarseQ[0]!, 'cr:Z:')).toBe('40M1000I40M')
  })
})

test('a minus-strand coarse row flips the fold for the Q row', async () => {
  await runInTmpDir(async () => {
    // small indels fold into an unequal run; on '-' the Q row reverses the op
    // order as well as trading axes, the way flipCigar does for the fine tier
    const lines = await pifLines(
      pafRow(['cg:Z:40M5I35M1000D40M'], {
        3: '120',
        4: '-',
        8: '1115',
        9: '40',
        10: '80',
      }),
      ['--coarse', '500'],
    )
    expect(
      tagValue(
        lines.find(l => l.startsWith('T'))!,
        'cr:Z:',
      ),
    ).toBe('75:80M1000D40M')
    expect(
      tagValue(
        lines.find(l => l.startsWith('Q'))!,
        'cr:Z:',
      ),
    ).toBe('40M1000I80:75M')
  })
})

test('a coarse row keeps the PAF coordinate columns verbatim and no fold when the CIGAR does not close on them', async () => {
  await runInTmpDir(async () => {
    // a CIGAR whose spans disagree with the coordinate columns: the fine tier
    // draws the columns, so the coarse row must not say anything the walk
    // reconstructed from a CIGAR that never reached them
    const lines = await pifLines(pafRow(['cg:Z:50M1000D40M']), [
      '--coarse',
      '500',
    ])
    const coarseT = lines.find(l => l.startsWith('T'))!
    const [, , start, end] = coarseT.split('\t')
    expect([start, end]).toEqual(['0', '100'])
    expect(coarseT).not.toContain('cr:Z:')
  })
})

test('a lopsided cluster of small indels is written as several runs', async () => {
  await runInTmpDir(async () => {
    // three 300bp deletions under --coarse 1000: none is kept on its own, but
    // together they bend the path by 900bp, and a straight ribbon across the
    // row would be off by that much. The fold's runs each lean at most 500.
    const lines = await pifLines(
      pafRow(['cg:Z:1000M300D1000M300D1000M300D1000M'], {
        3: '4000',
        8: '4900',
      }),
      ['--coarse', '1000'],
    )
    expect(
      tagValue(
        lines.find(l => l.startsWith('T'))!,
        'cr:Z:',
      ),
    ).toBe('2300:2000M1300:1000M1300:1000M')
  })
})

test('--coarse 0 is rejected: a coarse tier always has a bound', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand([
      'make-pif',
      simplePaf,
      '--out',
      'o.pif.gz',
      '--coarse',
      '0',
    ])
    expect(error?.message).toMatch('Invalid --coarse')
  })
})

test('the header line sorts first and states the tiers, the bound and the CIGAR census', async () => {
  await runInTmpDir(async () => {
    const lines = await pifLines(pafRow(['cg:Z:100M']), ['--coarse', '500'])
    expect(lines[0]).toBe(
      '#pif\tversion:i:1\ttiers:Z:fine,coarse\tcoarse:i:500\tcigars:Z:all',
    )
    expect(lines.filter(l => l.startsWith('#'))).toHaveLength(1)
  })
})

test('a fine-only file says so in its header, and a CIGAR-less one too', async () => {
  await runInTmpDir(async () => {
    const fineOnly = await pifLines(pafRow(['cg:Z:100M']), ['--no-coarse'])
    expect(fineOnly[0]).toBe('#pif\tversion:i:1\ttiers:Z:fine\tcigars:Z:all')
    const noCigar = await pifLines(pafRow(['tp:A:P']))
    expect(noCigar[0]).toBe(
      '#pif\tversion:i:1\ttiers:Z:fine,coarse\tcoarse:i:10000\tcigars:Z:none',
    )
  })
})

// `cigars:Z:all` is the reader's licence to take a coarse row with no `cr:Z:`
// as one run within the bound (`coarseRowsAreBounded`), and a row whose fold
// does not close on its own far corner is not one — the tag is withheld for the
// same reason a clipped or hand-made CIGAR's is. Counting it as a CIGAR row
// anyway had the header licence a run the fold never produced, and the follow
// then called itself exact where the fine tier lands 580bp away.
test('a CIGAR the fold cannot stand behind downgrades the census to some', async () => {
  await runInTmpDir(async () => {
    const lines = await pifLines(
      // 40M1000D40M walks 1080 of the target, but the row's columns claim 500
      pafRow(['cg:Z:40M1000D40M'], {
        1: '1000',
        3: '450',
        6: '1000',
        8: '500',
      }),
      ['--coarse', '500'],
    )
    expect(lines[0]).toBe(
      '#pif\tversion:i:1\ttiers:Z:fine,coarse\tcoarse:i:500\tcigars:Z:some',
    )
    for (const l of lines.filter(l => /^[TQ]/.test(l))) {
      expect(l).not.toContain('cr:Z:')
    }
  })
})

test('a file with no rows at all carries no CIGAR census either', async () => {
  await runInTmpDir(async () => {
    const lines = await pifLines('q1\t100\t0\t100\n')
    expect(lines[0]).toBe(
      '#pif\tversion:i:1\ttiers:Z:fine,coarse\tcoarse:i:10000\tcigars:Z:none',
    )
  })
})

test('an incoming cr:Z: is dropped from both tiers', async () => {
  await runInTmpDir(async () => {
    const lines = await pifLines(
      pafRow(['cr:Z:40M1000I40M', 'cg:Z:40M1000D40M'], { 3: '80', 8: '1080' }),
      ['--coarse', '500'],
    )
    for (const l of lines.filter(l => /^[tq]/.test(l))) {
      expect(l).not.toContain('cr:Z:')
    }
    const coarseT = lines.find(l => l.startsWith('T'))!
    expect(coarseT.split('\t').filter(f => f.startsWith('cr:Z:'))).toEqual([
      'cr:Z:40M1000D40M',
    ])
  })
})

test('--coarse and --no-coarse together is an error', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand([
      'make-pif',
      simplePaf,
      '--out',
      'o.pif.gz',
      '--no-coarse',
      '--coarse',
      '500',
    ])
    expect(error?.message).toMatch('mutually exclusive')
  })
})

test.each(['0', '-1', '2.5', 'many', '4; rm -rf /'])(
  '--threads %s is rejected rather than reaching the bgzip command line',
  async threads => {
    await runInTmpDir(async () => {
      const { error } = await runCommand([
        'make-pif',
        simplePaf,
        '--out',
        'o.pif.gz',
        `--threads=${threads}`,
      ])
      expect(error?.message).toMatch('Invalid --threads')
    })
  },
)

test('--threads writes the same PIF the default does', async () => {
  await runInTmpDir(async ({ dir }) => {
    await runCommand(['make-pif', simplePaf, '--out', 'one.pif.gz'])
    await runCommand([
      'make-pif',
      simplePaf,
      '--out',
      'eight.pif.gz',
      '--threads',
      '8',
    ])
    expect(
      gunzipSync(fs.readFileSync(path.join(dir, 'eight.pif.gz'))).toString(),
    ).toBe(gunzipSync(fs.readFileSync(path.join(dir, 'one.pif.gz'))).toString())
  })
})

test('a file with no valid PAF rows fails instead of writing an empty PIF', async () => {
  await runInTmpDir(async ({ dir }) => {
    const notPaf = path.join(dir, 'notpaf.txt')
    fs.writeFileSync(notPaf, 'chr1\t100\t200\nchr1\t300\t400\n')
    const { error } = await runCommand([
      'make-pif',
      notPaf,
      '--out',
      'o.pif.gz',
    ])
    expect(error?.message).toMatch('Is this a PAF file?')
  })
})

test('detects a plain-named PAF as pairwise (no PanSN samples)', async () => {
  const { samples } = await createPIF(simplePaf, sink())
  expect(samples.size).toBe(0)
})

test('collects the PanSN sample names from an all-vs-all PAF', async () => {
  await runInTmpDir(async ({ dir }) => {
    const pafPath = path.join(dir, 'ava.paf')
    const rows = fs
      .readFileSync(simplePaf, 'utf8')
      .trim()
      .split('\n')
      .map(l => {
        const p = l.split('\t')
        p[0] = `K12#1#${p[0]}`
        p[5] = `Sakai#1#${p[5]}`
        return p.join('\t')
      })
    fs.writeFileSync(pafPath, `${rows.join('\n')}\n`)
    const { samples } = await createPIF(pafPath, sink())
    expect([...samples].sort()).toEqual(['K12', 'Sakai'])
  })
})

test('make pif with CSI', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn, '--csi'])
    expect(exists(fn)).toBeTruthy()
    expect(exists(`${fn}.csi`)).toBeTruthy()
  })
})

// A PAF whose sequence names are PanSN but which does not state every sample
// pair indexes perfectly well and then draws an empty synteny band for each pair
// the aligner never emitted. Building the file is the one moment anyone is
// looking at it, and the census the warning needs was already being taken.
const avaFixture = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'test_data',
  'volvox',
  'volvox_all_vs_all.paf',
)

const dropPair = (from: string, pair: string) =>
  fs
    .readFileSync(from, 'utf8')
    .split('\n')
    .filter(Boolean)
    .filter(l => {
      const p = l.split('\t')
      return (
        [p[0]!.split('#')[0], p[5]!.split('#')[0]].sort().join('-') !== pair
      )
    })
    .join('\n')

test('warns when an all-vs-all PAF does not state every sample pair', async () => {
  await runInTmpDir(async () => {
    fs.writeFileSync(
      'star.paf',
      `${dropPair(avaFixture, 'volvox_del-volvox_ins')}\n`,
    )
    const { warnings } = await runCommand([
      'make-pif',
      'star.paf',
      '--out',
      'star.pif.gz',
    ])
    expect(warnings).toMatch(/states only 2 of their 3 pairs/)
    expect(warnings).toMatch(/volvox_del<->volvox_ins/)
    // and says what shape the file actually is, rather than leaving it a puzzle
    expect(warnings).toMatch(/reference-anchored/)
  })
})

test('a complete all-vs-all draws no such warning', async () => {
  await runInTmpDir(async () => {
    const { warnings } = await runCommand([
      'make-pif',
      avaFixture,
      '--out',
      'full.pif.gz',
    ])
    expect(warnings).not.toMatch(/pairs/)
  })
})

// a pairwise PAF has no PanSN names, so there are no sample pairs to be missing
test('a pairwise PAF draws no such warning', async () => {
  await runInTmpDir(async () => {
    const { warnings } = await runCommand([
      'make-pif',
      simplePaf,
      '--out',
      'pairwise.pif.gz',
    ])
    expect(warnings).not.toMatch(/pairs/)
  })
})

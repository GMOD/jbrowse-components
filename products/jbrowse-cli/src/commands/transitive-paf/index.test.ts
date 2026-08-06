/**
 * @jest-environment node
 */

import fs from 'node:fs'
import path from 'node:path'

import { runCommand, runInTmpDir } from '../../testUtil.ts'
import { orientToPivot } from './compose.ts'
import { parsePafRow } from './paf.ts'

// A real three-way all-vs-all: volvox, volvox_ins and volvox_del, each aligned
// to both others with CIGARs. The fixture is COMPLETE, which is what makes it
// useful here — dropping one pair gives a star topology whose missing pair the
// aligner's own answer is still on hand to check against.
const fixture = path.join(
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

const rows = () =>
  fs
    .readFileSync(fixture, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => ({ line: l, row: parsePafRow(l)! }))

const samplesOf = (line: string) => {
  const p = line.split('\t')
  return [p[0]!.split('#')[0]!, p[5]!.split('#')[0]!].sort().join('-')
}

/** the fixture minus the direct volvox_ins <-> volvox_del alignment */
function writeStarPaf(to: string) {
  fs.writeFileSync(
    to,
    rows()
      .filter(r => samplesOf(r.line) !== 'volvox_del-volvox_ins')
      .map(r => `${r.line}\n`)
      .join(''),
  )
}

const direct = () =>
  rows().find(r => samplesOf(r.line) === 'volvox_del-volvox_ins')!.row

test('composes the pair a star topology is missing', async () => {
  await runInTmpDir(async () => {
    writeStarPaf('star.paf')
    await runCommand([
      'transitive-paf',
      'star.paf',
      '--out',
      'full.paf',
      '--via',
      'volvox',
    ])
    const out = fs.readFileSync('full.paf', 'utf8').split('\n').filter(Boolean)
    // the two input rows are passed through, and the missing pair is filled in
    expect(out.filter(l => samplesOf(l) === 'volvox-volvox_ins')).toHaveLength(
      1,
    )
    expect(out.filter(l => samplesOf(l) === 'volvox-volvox_del')).toHaveLength(
      1,
    )
    const composed = out.filter(l => samplesOf(l) === 'volvox_del-volvox_ins')
    expect(composed.length).toBeGreaterThan(0)
    // and it says it was derived rather than aligned
    for (const l of composed) {
      expect(l).toMatch(/vi:Z:volvox#1#ctgA/)
    }
  })
})

// The payoff test: the fixture holds what the ALIGNER produced for this pair, so
// the composition can be checked against it rather than against itself.
test('the composed pair lands on the alignment the aligner produced for it', async () => {
  await runInTmpDir(async () => {
    writeStarPaf('star.paf')
    await runCommand([
      'transitive-paf',
      'star.paf',
      '--out',
      'full.paf',
      '--via',
      'volvox',
    ])
    const composed = fs
      .readFileSync('full.paf', 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => parsePafRow(l)!)
      .filter(r => r.tags.some(t => t.startsWith('vi:Z:')))

    const truth = direct()
    expect(composed).toHaveLength(1)
    // Which side is query and which is target is a property of how each row was
    // written, so turn the composition around onto the aligner's perspective
    // before comparing — orientToPivot is what reverses the CIGAR with it.
    const got = orientToPivot(composed[0]!, truth.tname)!

    // Not "close to": the two legs' indels compose to exactly the 9660 bp gap
    // wfmash reported for this pair (volvox_del's 4860 bp deletion plus
    // volvox_ins's 4800 bp insertion, which fall at the same locus of volvox).
    // Composition through an intermediate cannot promise this in general — the
    // pivot only carries what both legs aligned to it — but where the legs are
    // clean it recovers the alignment rather than approximating it.
    expect(got.strand).toBe(truth.strand)
    expect([got.qname, got.qstart, got.qend]).toEqual([
      truth.qname,
      truth.qstart,
      truth.qend,
    ])
    expect([got.tname, got.tstart, got.tend]).toEqual([
      truth.tname,
      truth.tstart,
      truth.tend,
    ])
    expect(got.cigar).toBe(truth.cigar)
  })
})

test('a file that already states every pair composes nothing', async () => {
  await runInTmpDir(async () => {
    await runCommand(['transitive-paf', fixture, '--out', 'full.paf'])
    const out = fs.readFileSync('full.paf', 'utf8').split('\n').filter(Boolean)
    // all three input rows pass through, nothing is added
    expect(out).toHaveLength(3)
    expect(out.filter(l => l.includes('vi:Z:'))).toHaveLength(0)
  })
})

test('--only-composed omits the input rows', async () => {
  await runInTmpDir(async () => {
    writeStarPaf('star.paf')
    await runCommand([
      'transitive-paf',
      'star.paf',
      '--out',
      'new.paf',
      '--only-composed',
    ])
    const out = fs.readFileSync('new.paf', 'utf8').split('\n').filter(Boolean)
    expect(out.length).toBeGreaterThan(0)
    for (const l of out) {
      expect(samplesOf(l)).toBe('volvox_del-volvox_ins')
    }
  })
})

test('--min-length discards short compositions', async () => {
  await runInTmpDir(async () => {
    writeStarPaf('star.paf')
    await runCommand([
      'transitive-paf',
      'star.paf',
      '--out',
      'new.paf',
      '--only-composed',
      '--min-length',
      '1000000',
    ])
    expect(fs.readFileSync('new.paf', 'utf8')).toBe('')
  })
})

// The two mistakes that otherwise produce an empty, valid-looking output file
test('a non-PanSN file says so rather than composing nothing', async () => {
  await runInTmpDir(async () => {
    fs.writeFileSync(
      'plain.paf',
      'chr1\t100\t0\t50\t+\tchr2\t100\t0\t50\t50\t50\t60\tcg:Z:50M\n',
    )
    expect(
      (await runCommand(['transitive-paf', 'plain.paf'])).error?.message,
    ).toMatch(/carries a PanSN sample prefix/)
  })
})

test('a PAF with no CIGARs says so rather than composing nothing', async () => {
  await runInTmpDir(async () => {
    fs.writeFileSync(
      'nocigar.paf',
      'a#1#c\t100\t0\t50\t+\tb#1#c\t100\t0\t50\t50\t50\t60\n',
    )
    expect(
      (await runCommand(['transitive-paf', 'nocigar.paf'])).error?.message,
    ).toMatch(/cg:Z:/)
  })
})

test('an unknown --via names the samples the file does hold', async () => {
  await runInTmpDir(async () => {
    expect(
      (await runCommand(['transitive-paf', fixture, '--via', 'nope'])).error
        ?.message,
    ).toMatch(/volvox, volvox_del, volvox_ins/)
  })
})

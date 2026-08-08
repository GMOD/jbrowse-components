// The tree that orders a MAF track's rows. Two of the decisions in here are
// recorded in the script as bugs that already happened once -- reading names
// from `group.a` alone dropped a sample from the tree with no warning, and
// taking whichever orientation of a pair arrived last is not the same as their
// mean -- so both get a test rather than a comment.
import { readFileSync } from 'node:fs'

import { assertPython3, fixture, runPython } from './pythonHelperScript.ts'

function toNewick(tsv: string, args: string[] = []) {
  const at = fixture({ 'sim.tsv': tsv })
  const run = runPython('odgi_similarity_to_newick.py', [
    at('sim.tsv'),
    at('out.nh'),
    ...args,
  ])
  return {
    ...run,
    newick: run.status === 0 ? readFileSync(at('out.nh'), 'utf8') : '',
  }
}

// odgi similarity -D '#' -p 1, cut to the three columns the script reads.
// CFT073 appears only ever as group.b, which is the shape that lost it.
const SIM = `group.a\tgroup.b\testimated.identity
K12\tK12\t1
K12\tSakai\t0.9
K12\tCFT073\t0.5
Sakai\tCFT073\t0.5
`

beforeAll(() => {
  assertPython3()
})

test('a sample seen only as group.b is still a leaf', () => {
  // Taking group.a alone dropped it silently, and the MAF track then drew it in
  // input order beneath the dendrogram, which looks like a tree that placed it.
  const { newick, stdout } = toNewick(SIM)
  for (const name of ['K12', 'Sakai', 'CFT073']) {
    expect(newick).toContain(name)
  }
  expect(stdout).toContain('3 samples')
})

test('the closest pair by identity is the innermost clade', () => {
  const { newick } = toNewick(SIM)
  // K12/Sakai share 0.9 against 0.5 for either against CFT073
  expect(newick).toMatch(/\(K12:[\d.]+,Sakai:[\d.]+\)/)
  expect(newick).toBe(
    '(CFT073:0.250000,(K12:0.050000,Sakai:0.050000):0.200000);\n',
  )
})

test('branch lengths are half the merge distance, so leaves share a depth', () => {
  const { newick } = toNewick(SIM)
  // UPGMA: the K12/Sakai node sits at 0.1/2, and CFT073 joins at 0.5/2, so
  // every leaf is 0.25 from the root
  const depthViaK12 = 0.05 + 0.2
  expect(depthViaK12).toBeCloseTo(0.25)
  expect(newick).toContain('CFT073:0.250000')
})

test('both orientations of a pair are averaged, not last-one-wins', () => {
  // jaccard is symmetric, but the length-normalized columns need not be to the
  // last bit, so the mean is what the distance comes from.
  const asymmetric = `group.a\tgroup.b\testimated.identity
A\tB\t0.8
B\tA\t0.6
A\tC\t0.1
C\tA\t0.1
B\tC\t0.1
C\tB\t0.1
`
  const { newick } = toNewick(asymmetric)
  // mean 0.7 -> distance 0.3 -> the A/B node sits at 0.15
  expect(newick).toMatch(/\(A:0\.150000,B:0\.150000\)/)
})

test('a column that is not in the file is named rather than defaulted', () => {
  const run = toNewick(SIM, ['--column', 'jaccard'])
  expect(run.status).not.toBe(0)
  expect(run.stderr).toMatch(/no 'jaccard' column/)
})

test('one sample is not a tree', () => {
  const run = toNewick('group.a\tgroup.b\testimated.identity\nK12\tK12\t1\n')
  expect(run.status).not.toBe(0)
  expect(run.stderr).toMatch(/need at least two samples/)
})

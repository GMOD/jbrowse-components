import { bandRows } from './arrangeRows.ts'
import {
  buildTree,
  computeClusterHierarchy,
  getLeafNames,
  matchBandClades,
} from './clusterUtils.ts'
import {
  TREE_LEFT_PAD,
  bandForestLayout,
  descendants,
  eachAfter,
  links,
  renderTreeSVG,
  treeLinks,
} from './hierarchy.ts'
import { buildSpatialIndex } from './spatialIndex.ts'

import type { RowBand } from './arrangeRows.ts'
import type * as Hierarchy from './hierarchy.ts'

jest.mock('./hierarchy.ts', () => {
  const actual = jest.requireActual<typeof Hierarchy>('./hierarchy.ts')
  return { ...actual, eachAfter: jest.fn(actual.eachAfter) }
})

const walks = jest.mocked(eachAfter)

// Two bands, AFR and EUR, as `clusterMatrix` writes a run under them: each
// band's tree under one root, joined at the taller band's height.
const FOREST = '((a:2,(b:1,c:1):1):0,(d:1,e:1):1);'

const POP: Record<string, string> = {
  a: 'AFR',
  b: 'AFR',
  c: 'AFR',
  d: 'EUR',
  e: 'EUR',
  f: 'EUR',
}

function banded(names: string[], domain: string[] = []) {
  return bandRows(
    names.map(name => ({ name })),
    row => POP[row.name] ?? '',
    { field: 'pop', domain },
  )
}

const cladeNames = (
  clades: ReturnType<typeof matchBandClades>,
): (string[] | undefined)[] =>
  clades.map(clade => (clade ? getLeafNames(clade) : undefined))

describe('matchBandClades', () => {
  test("finds each band's clade", () => {
    const { rows, bands } = banded(['a', 'b', 'c', 'd', 'e'])
    expect(
      cladeNames(matchBandClades(buildTree(FOREST), rows, bands)),
    ).toStrictEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ])
  })

  test('labels every node in one walk', () => {
    const { rows, bands } = banded(['a', 'b', 'c', 'd', 'e'])
    const tree = buildTree(FOREST)
    walks.mockClear()
    matchBandClades(tree, rows, bands)
    expect(walks).toHaveBeenCalledTimes(1)
  })

  test("a row added to one band hides that band's clade only", () => {
    const { rows, bands } = banded(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(
      cladeNames(matchBandClades(buildTree(FOREST), rows, bands)),
    ).toStrictEqual([['a', 'b', 'c'], undefined])
  })

  test('a band in another order than its clade has none', () => {
    const { rows, bands } = banded(['b', 'a', 'c', 'd', 'e'])
    expect(
      cladeNames(matchBandClades(buildTree(FOREST), rows, bands)),
    ).toStrictEqual([undefined, ['d', 'e']])
  })

  test('moving the bands keeps every clade', () => {
    const { rows, bands } = banded(['a', 'b', 'c', 'd', 'e'], ['EUR'])
    expect(rows.map(r => r.name)).toEqual(['d', 'e', 'a', 'b', 'c'])
    expect(
      cladeNames(matchBandClades(buildTree(FOREST), rows, bands)),
    ).toStrictEqual([
      ['d', 'e'],
      ['a', 'b', 'c'],
    ])
  })

  test('a whole-cohort tree matches only the bands it happens to hold', () => {
    const { rows, bands } = banded(['a', 'b', 'c', 'd', 'e'])
    const cohort = buildTree('((a,d),((b,c),e));')
    expect(cladeNames(matchBandClades(cohort, rows, bands))).toStrictEqual([
      undefined,
      undefined,
    ])
  })
})

describe('the band forest as drawn', () => {
  function forest(names: string[], showBranchLength = true, tree = FOREST) {
    const { rows, bands } = banded(names)
    return computeClusterHierarchy(
      buildTree(tree),
      rows,
      rows.length * 10,
      100,
      showBranchLength,
      bands,
    )!
  }

  test("each leaf lands on its own band's row", () => {
    const laid = forest(['a', 'b', 'c', 'd', 'e'])
    const leafRows = descendants(laid)
      .filter(n => !n.children)
      .map(n => [n.data.name, (n.x - 5) / 10])
    expect(leafRows).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
      ['d', 3],
      ['e', 4],
    ])
  })

  test('the root joins the bands and draws no link', () => {
    const laid = forest(['a', 'b', 'c', 'd', 'e'])
    expect(laid.forestRoot).toBe(true)
    expect(treeLinks(laid)).toHaveLength(links(laid).length - 2)
    expect(treeLinks(laid).some(({ source }) => source === laid)).toBe(false)
    expect(renderTreeSVG(laid)).not.toContain(`M${laid.y},${laid.x}L`)
    expect(buildSpatialIndex(laid)!.nodes).not.toContain(laid)
  })

  // ComplexHeatmap's slice dendrograms: the shorter band's root sits right of
  // the taller one's, so a branch reads the same length in either band.
  test('one depth scale across the bands', () => {
    const laid = forest(['a', 'b', 'c', 'd', 'e'])
    const [afr, eur] = laid.children!
    expect(afr!.y).toBe(TREE_LEFT_PAD)
    expect(eur!.y).toBeCloseTo(TREE_LEFT_PAD + (100 - TREE_LEFT_PAD) / 2)
    for (const leaf of descendants(laid).filter(n => !n.children)) {
      expect(leaf.y).toBe(100)
    }
  })

  test('the cladogram shares its depth scale too', () => {
    const laid = forest(['a', 'b', 'c', 'd', 'e'], false)
    const [afr, eur] = laid.children!
    expect(afr!.y).toBe(TREE_LEFT_PAD)
    expect(eur!.y).toBeCloseTo(TREE_LEFT_PAD + (100 - TREE_LEFT_PAD) / 2)
  })

  test('a band with no clade leaves its rows bare, the others draw', () => {
    const laid = forest(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(laid.children!.map(c => getLeafNames(c))).toEqual([['a', 'b', 'c']])
  })

  test('a one-row band is a bare leaf at the right edge', () => {
    const laid = forest(
      ['a', 'b', 'c', 'd'],
      true,
      '((a:2,(b:1,c:1):1):0,d:2);',
    )
    const [, d] = laid.children!
    expect(d!.data.name).toBe('d')
    expect(d!.y).toBe(100)
  })

  test('bare leaves alone draw nothing', () => {
    const { rows, bands } = banded(['a', 'd'])
    expect(
      computeClusterHierarchy(
        buildTree('(a:1,d:1);'),
        rows,
        20,
        100,
        true,
        bands,
      ),
    ).toBeUndefined()
  })
})

test('bandForestLayout draws nothing for no clade', () => {
  expect(bandForestLayout([], 10, 100)).toBeUndefined()
})

test('a band forest is laid out without walking once per band', () => {
  const rows: { name: string }[] = []
  const bands: RowBand[] = []
  const trees: string[] = []
  for (let b = 0; b < 2_000; b++) {
    rows.push({ name: `x${b}` }, { name: `y${b}` })
    bands.push({ key: `${b}`, label: `${b}`, start: 2 * b, end: 2 * b + 2 })
    trees.push(`(x${b}:1,y${b}:1):0`)
  }
  const tree = buildTree(`(${trees.join(',')});`)
  walks.mockClear()
  const laid = computeClusterHierarchy(tree, rows, 4_000, 100, true, bands)
  expect(laid!.children).toHaveLength(2_000)
  expect(walks).toHaveBeenCalledTimes(1)
})

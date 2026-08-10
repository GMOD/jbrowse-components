import {
  assertJsSkipsResolve,
  collectExportUses,
  collectSkips,
  emitLiftReport,
  refusalBucket,
} from './liftReport.ts'

import type { ShaderScan } from './liftReport.ts'
import type { WgslFn } from './wgslToJs.ts'

// The inventory's value is entirely in its diff, so these tests are about the
// two ways a diff stops meaning anything: a row that churns for no reason, and
// a row that is silently attributed to the wrong bucket.

const fn = (name: string, params: string[] = ['f32'], ret = 'f32') =>
  ({
    name,
    params: params.map((type, i) => ({ name: `p${i}`, type })),
    returnType: ret,
    body: [],
  }) as WgslFn

const scan = (shader: string, inSubset: WgslFn[] = [], refused = []) =>
  ({ shader, inSubset, refused }) as ShaderScan

describe('refusal bucketing', () => {
  test('drops the line and the advice, so a row does not churn per edit', () => {
    const a = refusalBucket(
      `wgslToJs: type 'vec3' is outside the supported scalar subset ` +
        `(line 41, near "vec3"). Either narrow the //! js-export set or extend`,
    )
    const b = refusalBucket(
      `wgslToJs: type 'vec3' is outside the supported scalar subset ` +
        `(line 903, near "vec3"). Either narrow the //! js-export set or extend`,
    )
    expect(a).toBe(b)
    expect(a).toBe("type 'vec3' is outside the supported scalar subset")
  })

  test('normalizes a location named mid-sentence, not just the suffix', () => {
    // Not every refusal puts its line in the ` (line N,` tail. One that names it
    // inline gave a function refused at two call sites two rows, each of which
    // churned whenever anything above it moved.
    expect(
      refusalBucket("wgslToJs: call to 'length' at line 227 is neither a"),
    ).toBe(refusalBucket("wgslToJs: call to 'length' at line 389 is neither a"))
  })

  test('collapses slangc’s per-shader numbering on a struct name', () => {
    // The same struct is `Corners_0` in one shader and `Corners_3` in another,
    // purely because slangc counts declarations module-wide. Left alone, one
    // struct produces a new row every time an unrelated shader gains a function.
    expect(refusalBucket("wgslToJs: type 'Corners_0' is outside")).toBe(
      refusalBucket("wgslToJs: type 'Corners_7' is outside"),
    )
  })
})

describe('the exported set is tree-wide', () => {
  // A decision authored in a module is inlined into every importer's WGSL, so
  // it appears in many scans while being named in one directive. Reading
  // exports per shader listed every module-authored export as a candidate.
  const scans = [
    scan('packages/x/a.slang', [fn('snapBoxHeightPx_0')]),
    scan('packages/x/b.slang', [fn('snapBoxHeightPx_4')]),
  ]

  test('a module export is not a candidate in its importers', () => {
    const out = emitLiftReport(scans, new Set(['snapBoxHeightPx']), new Map())
    expect(out).toContain('## Candidates\n\nIn the subset')
    expect(out.split('## Declined')[0]).not.toContain('snapBoxHeightPx')
  })

  test('…and is a candidate when nothing exports it', () => {
    const out = emitLiftReport(scans, new Set(), new Map())
    expect(out.split('## Declined')[0]).toContain('`snapBoxHeightPx`')
    // One row, not one per shader that inlined it.
    expect(out.match(/`snapBoxHeightPx`/g)).toHaveLength(1)
  })
})

describe('js-skip resolution', () => {
  const skips = (entries: [string, string, string][]) =>
    collectSkips(
      entries.map(([shader, name, reason]) => ({
        shader,
        skips: [{ name, reason }],
      })),
    )

  test('a skip for a liftable, unexported function is fine', () => {
    const s = skips([['a.slang', 'quadLocal', 'no vertices on a canvas']])
    expect(() => {
      assertJsSkipsResolve([scan('a.slang', [fn('quadLocal_0')])], new Set(), s)
    }).not.toThrow()
  })

  test('refuses a skip naming a function nothing can lift', () => {
    // The case this exists for: the function was renamed or deleted and the
    // decline outlived it, so the report kept asserting a decision about
    // nothing. Silent without the check.
    const s = skips([['a.slang', 'renamedAway', 'obsolete reason']])
    expect(() => {
      assertJsSkipsResolve([scan('a.slang', [fn('other_0')])], new Set(), s)
    }).toThrow(/js-skip names 'renamedAway'/)
  })

  test('refuses a function that is both skipped and exported', () => {
    const s = skips([['a.slang', 'f', 'declined']])
    expect(() => {
      assertJsSkipsResolve([scan('a.slang', [fn('f_0')])], new Set(['f']), s)
    }).toThrow(/both \/\/! js-skip and \/\/! js-export/)
  })

  test('refuses the same function declined by two shaders', () => {
    expect(() => {
      skips([
        ['a.slang', 'f', 'one reason'],
        ['b.slang', 'f', 'a different reason'],
      ])
    }).toThrow(/declined twice, by a\.slang and b\.slang/)
  })
})

describe('who imports an export', () => {
  const scan1 = [scan('a.slang', [fn('used_0'), fn('testOnly_0')])]
  const files = [
    {
      path: 'plugins/x/src/Renderer.ts',
      text: "import { used } from './a.js.generated.ts'\n",
    },
    {
      path: 'plugins/x/src/parity.test.ts',
      text: "import { used, testOnly } from './a.js.generated.ts'\n",
    },
  ]

  test('separates production importers from test-only ones', () => {
    const uses = collectExportUses(files, new Set(['used', 'testOnly']))
    expect(uses.get('used')!.production).toStrictEqual([
      'plugins/x/src/Renderer.ts',
    ])
    expect(uses.get('testOnly')!.production).toStrictEqual([])
    expect(uses.get('testOnly')!.test).toStrictEqual([
      'plugins/x/src/parity.test.ts',
    ])
  })

  test('counts a re-export and an aliased import', () => {
    // `labelConstants.ts` is a one-line re-export of a twin, and that is a real
    // consumer; `import { x as y }` names the export on the LEFT.
    const uses = collectExportUses(
      [
        {
          path: 'packages/core/src/reexport.ts',
          text: "export { textWidth } from './insertionWidth.generated.ts'\n",
        },
        {
          path: 'packages/core/src/alias.ts',
          text: "import { drawnRowHeightPx as h } from '@jbrowse/render-core/shaders/rowRect'\n",
        },
      ],
      new Set(['textWidth', 'drawnRowHeightPx']),
    )
    expect(uses.get('textWidth')!.production).toHaveLength(1)
    expect(uses.get('drawnRowHeightPx')!.production).toHaveLength(1)
  })

  // The module path is deliberately not matched: consumers reach a twin both
  // directly and through a package exports map that hides the generated file.
  test('does not require the import path to look generated', () => {
    const uses = collectExportUses(
      [
        {
          path: 'plugins/x/src/R.ts',
          text: "import { snapBoxHeightPx } from '@jbrowse/render-core/shaders/hpmath'\n",
        },
      ],
      new Set(['snapBoxHeightPx']),
    )
    expect(uses.get('snapBoxHeightPx')!.production).toHaveLength(1)
  })

  test('lists an unimported export in the report, with what does use it', () => {
    const out = emitLiftReport(
      scan1,
      new Set(['used', 'testOnly']),
      new Map(),
      collectExportUses(files, new Set(['used', 'testOnly'])),
    )
    const section = out.split('## Exported, but nothing imports it')[1]!
    expect(section).toContain('`testOnly`')
    expect(section).toContain('parity.test.ts')
    expect(section).not.toContain('`used`')
  })

  // An empty map means "consumers were not scanned", which a path-scoped build
  // does not do — it must not read as "every export is dead".
  test('says nothing when consumers were not measured', () => {
    const out = emitLiftReport(scan1, new Set(['used']), new Map())
    expect(out.split('## Exported, but nothing imports it')[1]).toContain(
      '_None._',
    )
  })
})

describe('report shape', () => {
  test('a declined function shows its reason, not its shaders', () => {
    const out = emitLiftReport(
      [scan('a.slang', [fn('discExpand_0')])],
      new Set(),
      collectSkips([
        {
          shader: 'a.slang',
          skips: [{ name: 'discExpand', reason: 'Canvas2D has no quad' }],
        },
      ]),
    )
    const declined = out.split('## Declined')[1]!.split('## Outside')[0]!
    expect(declined).toContain('`discExpand`')
    expect(declined).toContain('Canvas2D has no quad')
    expect(out.split('## Declined')[0]).not.toContain('discExpand')
  })

  test('an empty section says so rather than emitting a headerless table', () => {
    const out = emitLiftReport([], new Set(), new Map())
    expect(out).toContain('_None._')
  })

  test('is deterministic under shader order', () => {
    // Files compile concurrently, so scan order is nondeterministic. An
    // unsorted report would diff against itself on every run and be reverted
    // as noise within a week.
    const a = scan('z.slang', [fn('beta_0')])
    const b = scan('a.slang', [fn('alpha_0')])
    expect(emitLiftReport([a, b], new Set(), new Map())).toBe(
      emitLiftReport([b, a], new Set(), new Map()),
    )
  })
})

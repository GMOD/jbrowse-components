import {
  assertJsSkipsResolve,
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

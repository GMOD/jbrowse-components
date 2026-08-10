// The generated inventory of what the shader→JS codegen can and cannot lift.
//
// Why this exists: `js-export` only ever gets *audited* where an export already
// goes. The emitter's refusals are exercised by the functions someone happened
// to name, and finding the next candidate has been a manual grep sweep — run
// twice, declared finished, and wrong both times about at least one function
// (adr-051's "no counterpart exists" list had an entry that had quietly become
// false). A sweep that has to be re-run by hand is a sweep that stops happening.
//
// So the sweep is a build artifact. Every full `pnpm gen:shaders` reads back the
// WGSL it just compiled, parses each function with the same parser the emitter
// uses, and writes what it found. The three sections answer three questions a
// reader actually has:
//
//   - What could be lifted and has not been? (`Candidates` — should stay empty;
//     a row appearing in the diff is the signal.)
//   - What was looked at and turned down, and why? (`Declined`, from
//     `//! js-skip`, checked against reality rather than remembered.)
//   - What is outside the subset, and what is blocking it? (`Outside the
//     subset` — this is the emitter's coverage boundary, and it moves only when
//     someone moves it.)

import { demangle } from './slangcMangling.ts'

import type { JsSkip } from './parseDirectives.ts'
import type { WgslFn, WgslRefusal } from './wgslToJs.ts'

export interface ShaderScan {
  /** Repo-relative path of the `.slang`. */
  shader: string
  /** Every function in its compiled WGSL the emitter could read. */
  inSubset: WgslFn[]
  /** …and every one it could not. */
  refused: WgslRefusal[]
}

/** One `//! js-skip`, and which `.slang` declared it. */
export interface ResolvedSkip extends JsSkip {
  shader: string
}

/**
 * Skips are collected from EVERY `.slang`, not from the scans, and that is
 * load-bearing: a module file never reaches the compile path that produces a
 * scan (it has no entry points to compile), so gathering them there would make
 * a skip on `hpmath.slang` or `alignmentsUniforms.slang` do nothing at all —
 * silently, since the function would simply keep appearing as a candidate. The
 * modules are where most of the shared decisions are authored, so that is
 * exactly where the skips belong.
 */
export function collectSkips(
  files: readonly { shader: string; skips: readonly JsSkip[] }[],
) {
  const out = new Map<string, ResolvedSkip>()
  for (const file of files) {
    for (const skip of file.skips) {
      const prior = out.get(skip.name)
      if (prior) {
        throw new Error(
          `//! js-skip: '${skip.name}' is declined twice, by ${prior.shader} ` +
            `and ${file.shader}. One function, one decision — otherwise the ` +
            `report shows whichever the file walk reached last.`,
        )
      }
      out.set(skip.name, { ...skip, shader: file.shader })
    }
  }
  return out
}

/**
 * The exported set is tree-wide, not per-shader, and that is not a
 * simplification — it is the only correct reading. A decision authored in a
 * module and exported from it (`snapBoxHeightPx` in hpmath, the LD estimators
 * in ldUniforms) is inlined into the WGSL of every shader that imports it, so
 * it appears in a dozen scans while being named in one directive. Attributing
 * exports per shader listed all fourteen of them as unexported candidates.
 */
export type ExportedNames = ReadonlySet<string>

/** Signature as the report prints it, e.g. `(f32, f32) -> f32`. */
function signatureOf(fn: WgslFn) {
  const params = fn.params.map(p => p.type).join(', ')
  return `(${params}) -> ${fn.returnType}`
}

/**
 * The construct a refusal is about, with the location and the advice stripped
 * and slangc's numbering removed, so two shaders refusing the same thing land
 * in one row.
 *
 * Bucketing on the WHOLE message would make every row unique — the line number
 * is in it — and the report would then churn on any edit to any shader, which
 * is the failure mode that makes a generated file get ignored.
 */
export function refusalBucket(reason: string) {
  const body = reason.replace(/^wgslToJs: /, '')
  const construct = body.split(' (line ')[0]!.split('. ')[0]!
  // `'Corners_0'` and `'Corners_3'` are the same struct seen from two shaders.
  return construct.replaceAll(/'(\w+?)_\d+'/g, "'$1'").trim()
}

/**
 * Fail the build on a `//! js-skip` that no longer describes reality: naming a
 * function the emitter cannot see (renamed, deleted, or never in the subset),
 * or one that is exported after all.
 *
 * Without this a skip is just a comment, and a comment about why something is
 * not generated is exactly the kind that stops being true silently — which is
 * the whole failure mode this file exists to close.
 */
export function assertJsSkipsResolve(
  scans: readonly ShaderScan[],
  exported: ExportedNames,
  skips: ReadonlyMap<string, ResolvedSkip>,
) {
  const liftable = new Set(
    scans.flatMap(s => s.inSubset.map(f => demangle(f.name))),
  )
  const problems: string[] = []
  for (const skip of skips.values()) {
    if (exported.has(skip.name)) {
      problems.push(
        `${skip.shader}: '${skip.name}' is both //! js-skip and //! js-export`,
      )
    } else if (!liftable.has(skip.name)) {
      problems.push(
        `${skip.shader}: //! js-skip names '${skip.name}', which is not a ` +
          `function the emitter can read in any compiled shader — it was ` +
          `renamed or removed, or it is outside the subset (in which case it ` +
          `is already reported under "Outside the subset" and needs no skip)`,
      )
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `//! js-skip is out of date:\n${problems.map(p => `  ${p}`).join('\n')}`,
    )
  }
}

/** Collapse one function's appearances across shaders into a single row. */
function byFunction(scans: readonly ShaderScan[]) {
  const out = new Map<string, { signature: string; shaders: Set<string> }>()
  for (const scan of scans) {
    for (const fn of scan.inSubset) {
      const name = demangle(fn.name)
      const row = out.get(name) ?? {
        signature: signatureOf(fn),
        shaders: new Set(),
      }
      row.shaders.add(scan.shader)
      out.set(name, row)
    }
  }
  return out
}

const shaderList = (shaders: Iterable<string>) =>
  [...shaders]
    .map(s => s.replace(/^.*\//, '').replace(/\.slang$/, ''))
    .sort()
    .join(', ')

const table = (headers: string[], rows: string[][]) =>
  rows.length === 0
    ? ['_None._']
    : [
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map(r => `| ${r.join(' | ')} |`),
      ]

export function emitLiftReport(
  scans: readonly ShaderScan[],
  exported: ExportedNames,
  skips: ReadonlyMap<string, ResolvedSkip>,
): string {
  const sorted = [...scans].sort((a, b) => a.shader.localeCompare(b.shader))
  const fns = byFunction(sorted)

  const candidates: string[][] = []
  const declined: string[][] = []
  for (const [name, row] of [...fns].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (exported.has(name)) {
      continue
    }
    const skip = skips.get(name)
    const cells = [`\`${name}\``, `\`${row.signature}\``]
    if (skip) {
      declined.push([...cells, skip.reason])
    } else {
      candidates.push([...cells, shaderList(row.shaders)])
    }
  }

  const buckets = new Map<string, Set<string>>()
  for (const scan of sorted) {
    for (const r of scan.refused) {
      const key = refusalBucket(r.reason)
      const names = buckets.get(key) ?? new Set<string>()
      names.add(demangle(r.name))
      buckets.set(key, names)
    }
  }
  const refusalRows = [...buckets]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([key, names]) => [
      key,
      String(names.size),
      [...names]
        .sort()
        .slice(0, 6)
        .map(n => `\`${n}\``)
        .join(', ') + (names.size > 6 ? ', …' : ''),
    ])

  const exportedCount = exported.size
  return [
    '---',
    'name: shader-lift-inventory',
    'description: Generated inventory of which shader functions the JS codegen' +
      ' can lift, which were declined and why, and what the emitter refuses —' +
      ' the standing sweep for the next `//! js-export`, as a diff.',
    '---',
    '',
    '# Shader → JS liftability inventory',
    '',
    '**Generated by `pnpm gen:shaders`. Do not edit.** The decisions this',
    'reports on live in the `.slang` files, as `//! js-export` and `//! js-skip`.',
    '',
    'Read [ADR-051](../architecture-decision-records/' +
      'adr-051-shader-js-codegen-is-scalar-only.md) first: it says what belongs',
    'in the export set and what deliberately does not. This file says what the',
    'tree currently looks like against that standard.',
    '',
    `Scanned ${sorted.length} shaders with entry points. ${fns.size} functions`,
    `are inside the emitter's subset, of which **${exportedCount} are exported**.`,
    '',
    '## Candidates',
    '',
    'In the subset, not exported, and not declined. **This table should be',
    'empty.** A row here is either the next export or the next `//! js-skip` —',
    'and a row appearing in a diff means a shader edit created one without',
    'anyone deciding which.',
    '',
    ...table(['Function', 'Signature', 'Shaders'], candidates),
    '',
    '## Declined',
    '',
    'Liftable, and deliberately not lifted — `//! js-skip` in the shader. Each',
    'is checked on every build: a skip naming a function the emitter can no',
    'longer see, or one that is exported after all, fails `pnpm gen:shaders`.',
    '',
    ...table(['Function', 'Signature', 'Why not'], declined),
    '',
    '## Outside the subset',
    '',
    "The emitter's coverage boundary, by what blocks it. These are refusals, not",
    'bugs — a function here is one nothing has needed on the Canvas2D side. The',
    'counts move when a shader gains or loses a function; the *rows* move only',
    'when someone changes what the emitter can read, which is the thing worth',
    'noticing in a diff.',
    '',
    ...table(['Refused because', 'Functions', 'For example'], refusalRows),
    '',
  ].join('\n')
}

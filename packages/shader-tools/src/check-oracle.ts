#!/usr/bin/env node
/* eslint-disable no-console */
// Differential check: every `//! js-export` twin against slangc's own C++
// translation of the same Slang source.
//
// This is the gate a SLANG_VERSION bump needs. The existing `*Parity.test.ts`
// files compare a generated function against a hand-written fixture — one
// function each, written when that function was retired, and they cover the
// EMITTER only where somebody happened to add one. A desugaring change in a new
// slangc affects every twin at once, and the documented procedure for it is to
// read the generated diff by eye.
//
// So the second implementation is generated instead of written: slangc emits
// C++ for the same functions, `oracleProbe.ts` drives it over a deterministic
// sweep, and the two are compared. A disagreement means `wgslToJs.ts` read
// slangc's WGSL wrong — which is the failure the whole codegen is built to be
// incapable of, and until now was checked only by inspection.
//
// Run: `pnpm check-shader-oracle`. Needs slangc (auto-fetched, shared with
// gen:shaders) and a C++ compiler; skips with a warning if the latter is
// missing, since a contributor without one can still regenerate shaders.
import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  RETURN_WIDTH,
  agrees,
  buildOracleMain,
  buildProbeEntry,
  resolveCppName,
  stripEntryPoints,
} from './shader-codegen/oracleProbe.ts'
import {
  isSupportedSignature,
  parseDeclaredFunctions,
  parseJsExports,
  parseOutPath,
  stripComments,
} from './shader-codegen/parseDirectives.ts'
import { demangle } from './shader-codegen/slangcMangling.ts'
import {
  emitJsTwins,
  emitRefusal,
  parseWgsl,
} from './shader-codegen/wgslToJs.ts'

import type { JsExportFn } from './shader-codegen/parseDirectives.ts'

const PROJECT_ROOT = path.resolve(
  process.env.JBROWSE_SHADER_ROOT ?? process.cwd(),
)
const SLANGC = process.env.SLANGC ?? `${PROJECT_ROOT}/.cache/slangc/bin/slangc`
const SHARED_INCLUDE = `${PROJECT_ROOT}/packages/render-core/src/shaders`
const DRAWS = Number(process.env.ORACLE_DRAWS ?? 400)

function resolveCompiler() {
  for (const bin of [process.env.CXX, 'c++', 'g++', 'clang++'].filter(
    Boolean,
  )) {
    if (
      spawnSync(bin!, ['--version'], { stdio: 'ignore' }).error === undefined
    ) {
      return bin!
    }
  }
  return undefined
}

function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    if (
      entry === 'node_modules' ||
      entry === '.cache' ||
      entry === 'dist' ||
      entry === 'esm' ||
      entry.startsWith('.')
    ) {
      continue
    }
    const full = path.join(dir, entry)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      walk(full, out)
    } else if (entry.endsWith('.slang')) {
      out.push(full)
    }
  }
  return out
}

// Same resolution `build-shaders.ts` uses, so the file checked is the file
// consumers import rather than one regenerated here.
function twinPathFor(slangPath: string, source: string) {
  const out = parseOutPath(source, 'js-export')
  return out
    ? path.join(PROJECT_ROOT, out)
    : path.join(
        path.dirname(slangPath),
        `${path.basename(slangPath, '.slang')}.js.generated.ts`,
      )
}

/** Sources of every module a shader imports, transitively — as build-shaders does. */
function readImportedSources(
  slangPath: string,
  source: string,
  seen = new Set<string>(),
): string[] {
  const dir = path.dirname(slangPath)
  const out: string[] = []
  for (const m of stripComments(source).matchAll(/^\s*import\s+(\w+)\s*;/gm)) {
    const found = [dir, SHARED_INCLUDE]
      .map(d => path.join(d, `${m[1]!}.slang`))
      .find(p => existsSync(p))
    if (!found || seen.has(found)) {
      continue
    }
    seen.add(found)
    const imported = readFileSync(found, 'utf8')
    out.push(imported, ...readImportedSources(found, imported, seen))
  }
  return out
}

interface Mismatch {
  fn: string
  args: number[]
  cpp: number[]
  js: number[]
}

/**
 * `printf("%.17g")` spells the non-finite values `inf` / `-inf` / `nan`, none
 * of which `Number()` understands — it answers NaN for all three. Left alone,
 * every division by a zero the sweep produced (a zero chevron count, a locus
 * with no called samples) read as C++ NaN against a JS Infinity and was
 * reported as a mistranslation. The values are the interesting ones to compare,
 * so they are parsed rather than excluded from the pools.
 */
function parseOracleNumber(text: string) {
  const t = text.trim()
  return t === 'inf'
    ? Infinity
    : t === '-inf'
      ? -Infinity
      : t === 'nan' || t === '-nan'
        ? NaN
        : Number(t)
}

/**
 * Every function in this shader's WGSL that the emitter can emit but nothing
 * exports — the declined ones, plus any private helper no export happens to
 * reach.
 *
 * Checking these is the point, not a bonus. Exported functions are the ones a
 * consumer already depends on and a hand-written parity test may already cover;
 * the untested surface is what the emitter *could* produce and nobody has
 * asked it to, which is where ADR-051 says the next silent bug lives. It is
 * also where the newest emitter paths sit: `quadLocal` is the only integer `%`
 * with chained comparisons in the tree, and `expandMinWidthX` is a `vec2`
 * return with a branch — the least-exercised feature, added last.
 *
 * They have no committed twin to compare against, so one is emitted on the fly.
 * That tests the emitter rather than an artifact, which is the right target:
 * the artifacts are already pinned by the staleness check.
 */
function candidateFunctions(source: string, exported: ReadonlySet<string>) {
  return [...parseDeclaredFunctions([source]).values()].filter(
    fn => !exported.has(fn.name) && isSupportedSignature(fn),
  )
}

/**
 * Of the candidates, the ones the emitter can actually emit — decided against
 * the compiled WGSL, which is the only place that question has an answer.
 */
function emittableOf(
  wgsl: string,
  candidates: readonly JsExportFn[],
): JsExportFn[] {
  const mod = parseWgsl(wgsl)
  const byName = new Map<string, string>()
  for (const fn of mod.fns) {
    const short = demangle(fn.name)
    // An overloaded base name has no unambiguous mangled counterpart; skip it
    // rather than sweep one overload under the other's label.
    byName.set(short, byName.has(short) ? '' : fn.name)
  }
  return candidates.filter(c => {
    const mangled = byName.get(c.name)
    return (
      mangled !== undefined &&
      mangled !== '' &&
      emitRefusal(mod, mangled) === undefined
    )
  })
}

async function checkShader(cxx: string, slangPath: string, source: string) {
  const imported = readImportedSources(slangPath, source)
  // A shader with entry points may export a function it merely imports, so the
  // imported sources are in scope here exactly as they are for the twin.
  const hasEntryPoints = stripComments(source).includes('[shader(')
  const fns = parseJsExports(source, hasEntryPoints ? imported : [])
  if (!fns) {
    return { comparisons: 0, mismatches: [] as Mismatch[] }
  }
  const unsupported = fns.filter(f => !(f.returnType in RETURN_WIDTH))
  if (unsupported.length > 0) {
    throw new Error(
      `oracle cannot read return type(s) ` +
        `${[...new Set(unsupported.map(f => f.returnType))].join(', ')} ` +
        `(${unsupported.map(f => f.name).join(', ')})`,
    )
  }

  const base = path.basename(slangPath, '.slang')
  const tmp = mkdtempSync(path.join(tmpdir(), `oracle-${base}-`))
  const includes = ['-I', path.dirname(slangPath), '-I', SHARED_INCLUDE]
  try {
    // One probe, referencing the exports AND every other function in this file
    // with a signature the emitter could handle. Both compiles read it, which
    // is what makes the unexported set reachable at all: a module compiled on
    // its own yields no WGSL (Slang keeps nothing an entry point cannot reach,
    // and slangc then fails to write the file), and a shader compiled on its
    // own keeps only what its draw path uses. The probe is the entry point that
    // keeps the candidates alive in both.
    const candidates = candidateFunctions(source, new Set(fns.map(f => f.name)))
    const stripped = stripEntryPoints(source)
    const wgslProbePath = path.join(tmp, `${base}WgslProbe.slang`)
    writeFileSync(
      wgslProbePath,
      stripped + buildProbeEntry([...fns, ...candidates], 'fragment'),
    )
    const wgslPath = path.join(tmp, `${base}.wgsl`)
    execFileSync(
      SLANGC,
      [wgslProbePath, '-target', 'wgsl', '-o', wgslPath, ...includes],
      { stdio: 'pipe' },
    )
    const extras = emittableOf(readFileSync(wgslPath, 'utf8'), candidates)
    const swept = [...fns, ...extras]

    const probePath = path.join(tmp, `${base}Oracle.slang`)
    writeFileSync(probePath, stripped + buildProbeEntry(swept, 'compute'))
    const cppPath = path.join(tmp, `${base}.cpp`)
    execFileSync(
      SLANGC,
      [
        probePath,
        '-target',
        'cpp',
        '-entry',
        'oracleProbe',
        '-o',
        cppPath,
        ...includes,
      ],
      { stdio: 'pipe' },
    )
    // Dropped, not kept: slangc maps its output back to the `.slang` with
    // `#line`, so a C++ compile error in the generated glue is reported at a
    // line of the shader source — which is not where it is, and which sent the
    // first run of this hunting an imaginary Slang bug.
    const cpp = readFileSync(cppPath, 'utf8').replaceAll(/^#line .*$/gm, '')
    const cppNames = new Map(
      swept.map(f => [f.name, resolveCppName(cpp, f.name)] as const),
    )
    writeFileSync(cppPath, cpp + buildOracleMain(swept, cppNames, DRAWS))
    const exePath = path.join(tmp, base)
    execFileSync(cxx, ['-O0', '-std=c++17', '-o', exePath, cppPath], {
      stdio: 'pipe',
    })
    const rows = execFileSync(exePath, { encoding: 'utf8' }).trim().split('\n')

    type Twin = Record<
      string,
      (...args: (number | boolean)[]) => number | boolean | [number, number]
    >
    // The committed artifact for the exported names — so a hand-edited
    // generated file is caught too, not just a bad generator — and a
    // freshly-emitted module for the rest, which have no committed twin by
    // definition. Written to disk and imported rather than eval'd, so Node's
    // own type stripping handles the annotations instead of a regex.
    const twin = (await import(twinPathFor(slangPath, source))) as Twin
    let extraTwin: Twin = {}
    if (extras.length > 0) {
      const freshPath = path.join(tmp, `${base}.extras.generated.ts`)
      writeFileSync(
        freshPath,
        emitJsTwins(
          base,
          readFileSync(wgslPath, 'utf8'),
          extras.map(f => f.name),
          [],
        ),
      )
      extraTwin = (await import(freshPath)) as Twin
    }
    const lookup = (name: string) => twin[name] ?? extraTwin[name]
    const byName = new Map(swept.map(f => [f.name, f]))
    const mismatches: Mismatch[] = []
    for (const row of rows) {
      const [name, ...rest] = row.split('\t')
      const fn = byName.get(name!)!
      const nums = rest.map(parseOracleNumber)
      const args = nums.slice(0, fn.paramTypes.length)
      const cppOut = nums.slice(fn.paramTypes.length)
      const called = lookup(name!)!(
        ...args.map((v, i) => (fn.paramTypes[i] === 'bool' ? v !== 0 : v)),
      )
      const jsOut =
        typeof called === 'boolean'
          ? [called ? 1 : 0]
          : typeof called === 'number'
            ? [called]
            : called
      const floatArgs = args.filter((_, i) => fn.paramTypes[i] === 'float')
      if (
        jsOut.length !== cppOut.length ||
        !jsOut.every((v, i) => agrees(v, cppOut[i]!, floatArgs))
      ) {
        mismatches.push({ fn: name!, args, cpp: cppOut, js: [...jsOut] })
      }
    }
    return { comparisons: rows.length, mismatches }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

async function main() {
  const cxx = resolveCompiler()
  if (!cxx) {
    console.warn(
      'check-oracle: no C++ compiler (tried $CXX, c++, g++, clang++); ' +
        'skipping. CI runs this, so a contributor without one is fine.',
    )
    return
  }
  if (!existsSync(SLANGC)) {
    throw new Error(
      `check-oracle: slangc not found at ${SLANGC}. Run 'pnpm gen:shaders' ` +
        `once to fetch it, or set $SLANGC.`,
    )
  }
  const files = [
    ...walk(path.join(PROJECT_ROOT, 'packages')),
    ...walk(path.join(PROJECT_ROOT, 'plugins')),
  ]
    .map(p => ({ path: p, source: readFileSync(p, 'utf8') }))
    .filter(f => /^\/\/!\s*js-export:/m.test(f.source))
    .sort((a, b) => a.path.localeCompare(b.path))

  console.log(
    `Checking ${files.length} shader(s) with //! js-export against slangc's ` +
      `C++ output, ${DRAWS} draws per function`,
  )
  let comparisons = 0
  const failures: { shader: string; mismatches: Mismatch[] }[] = []
  for (const file of files) {
    const rel = file.path.replace(`${PROJECT_ROOT}/`, '')
    const result = await checkShader(cxx, file.path, file.source)
    comparisons += result.comparisons
    if (result.mismatches.length > 0) {
      failures.push({ shader: rel, mismatches: result.mismatches })
      console.log(`  FAIL ${rel} (${result.mismatches.length} mismatches)`)
    } else {
      console.log(`  ok   ${rel} (${result.comparisons})`)
    }
  }

  // A run that compared nothing passes every assertion it makes, so say the
  // number rather than only "ok" — a resolution bug that silently found no
  // exports would otherwise read as a clean check.
  console.log(`\n${comparisons} comparisons across ${files.length} shaders`)
  if (comparisons === 0) {
    throw new Error(
      'check-oracle: compared nothing. Either no shader declares ' +
        '//! js-export, or the sweep produced no rows.',
    )
  }
  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`\n${f.shader}:`)
      for (const m of f.mismatches.slice(0, 10)) {
        console.error(
          `  ${m.fn}(${m.args.join(', ')}) -> C++ [${m.cpp.join(', ')}] ` +
            `vs generated JS [${m.js.join(', ')}]`,
        )
      }
      if (f.mismatches.length > 10) {
        console.error(`  …and ${f.mismatches.length - 10} more`)
      }
    }
    throw new Error(
      `${failures.length} shader(s) whose generated twin disagrees with ` +
        `slangc's own C++. The twin is transliterated from slangc's WGSL, so ` +
        `a disagreement is usually a bug in wgslToJs.ts — not in the shader. ` +
        `The exception is float32 against float64: the tolerance already ` +
        `admits the rounding an input's own magnitude carries, so check a ` +
        `surviving near-miss against that before reading it as a ` +
        `mistranslation (agrees() in oracleProbe.ts).`,
    )
  }
}

try {
  await main()
} catch (e) {
  console.error(`\ncheck-oracle failed: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
}

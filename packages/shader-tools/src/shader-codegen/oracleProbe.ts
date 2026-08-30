// Build the C++ program that acts as the oracle for one shader's `js-export`
// set: slangc's own CPU translation of the same functions, driven over a
// deterministic input sweep and printed for comparison against the generated
// TypeScript.
//
// The point is what it is NOT: the twins are transliterated by `wgslToJs.ts`
// from slangc's WGSL, so every existing check on them is a hand-written parity
// test against a hand-written fixture, covering one function each. That leaves
// the emitter itself — the tokenizer, the integer inference, the desugaring
// assumptions — verified only where somebody happened to write a test. A
// SLANG_VERSION bump is exactly the change that can invalidate all of it at
// once, and the procedure for one is currently "read the generated diff".
//
// slangc can emit C++ for the same source, so the second implementation can be
// generated rather than written. It disagrees with the twin only if the emitter
// is wrong (or if float32 and float64 genuinely diverge, which is why the
// comparison has a tolerance and the inputs are exactly representable).
//
// Three facts shape the build, each of which costs a session to rediscover:
//
//   - `-target cpp` SEGFAULTS on a vertex entry point (exit 139) and errors on
//     a fragment one. It is fine on `[shader("compute")]`. So the entry points
//     are stripped and a compute probe is appended in their place.
//   - The probe exists only to defeat dead-code elimination. Its own body is
//     never run: the emitted C++ carries every reachable function as a plain
//     free function, and `main` calls those directly rather than going through
//     slangc's kernel ABI for StructuredBuffer.
//   - Appending the probe to the shader's own source, rather than importing the
//     shader from a wrapper, is what makes this work for a module and a
//     stage-carrying shader alike — and it sidesteps Slang's cross-module
//     visibility rules, which would otherwise require `public` on every
//     shader-local function the set names.

import { demangle } from './slangcMangling.ts'

import type { JsExportFn } from './parseDirectives.ts'

/** Slang scalar/vector types the oracle knows how to feed and read. */
const CPP_PRINT: Record<string, (call: string) => string> = {
  float: c => `emit(${c});`,
  int: c => `emit(double(${c}));`,
  uint: c => `emit(double(${c}));`,
  bool: c => `emit(double(${c} ? 1 : 0));`,
  // The one non-scalar in the subset. Printed as two columns, so the TS side
  // compares the tuple element-wise rather than through a lossy summary.
  float2: c => `{ auto v = ${c}; emit(v.x); emit(v.y); }`,
}

/** How many numbers a return type prints. */
export const RETURN_WIDTH: Record<string, number> = {
  float: 1,
  int: 1,
  uint: 1,
  bool: 1,
  float2: 2,
}

/**
 * Remove every `[shader(...)]` function from a Slang source, and the `module`
 * declaration if it has one, leaving a plain translation unit the probe can be
 * appended to.
 *
 * Brace-matched rather than regexed to the next blank line: a vertex body
 * contains nested blocks, and stopping early leaves a dangling `}` whose
 * slangc error points at the probe rather than at the cut.
 */
export function stripEntryPoints(source: string) {
  let out = ''
  let i = 0
  for (;;) {
    const m = /\[shader\("\w+"\)\]/.exec(source.slice(i))
    if (!m) {
      out += source.slice(i)
      break
    }
    const start = i + m.index
    out += source.slice(i, start)
    let j = source.indexOf('{', start)
    if (j < 0) {
      out += source.slice(start)
      break
    }
    let depth = 0
    for (; j < source.length; j++) {
      if (source[j] === '{') {
        depth++
      } else if (source[j] === '}') {
        depth--
        if (depth === 0) {
          break
        }
      }
    }
    i = j + 1
  }
  // `module x;` would make this a module again, and a module may not declare an
  // entry point. Blanked rather than deleted so slangc's line numbers — and any
  // diagnostic a contributor has to read — still match the original file.
  return out.replace(/^\s*module\s+\w+\s*;/m, '')
}

const PROBE_ARG: Record<string, Record<string, string>> = {
  compute: {
    float: 'float(tid.x)',
    uint: 'tid.x',
    int: 'int(tid.x)',
    bool: 'tid.x != 0u',
  },
  fragment: {
    float: 'pos.x',
    uint: 'uint(pos.x)',
    int: 'int(pos.x)',
    bool: 'pos.x > 0.0',
  },
}

/**
 * The throwaway entry point whose only job is to reference each function, so
 * Slang keeps it rather than eliminating what nothing reaches. The value it
 * computes is discarded.
 *
 * The stage is not a detail. **Compute** is what the C++ pass needs — `-target
 * cpp` segfaults on a vertex entry and errors on a fragment one. But compute
 * cannot reference a function using `ddx`/`ddy`/`fwidth`, which are
 * fragment-only, and the candidate set is chosen by signature before anything
 * knows which functions those are: `pointGlyph.slang`'s `glyphEdgeAlpha` reads
 * as an ordinary `float -> float`.
 *
 * So the WGSL pass — which exists only to decide what the emitter can emit —
 * uses a **fragment** entry, where every builtin is legal and nothing is
 * dropped. By the time the C++ pass runs, the list has been filtered to what
 * the emitter accepts, and that set contains no derivatives by construction:
 * the emitter refuses them.
 */
export function buildProbeEntry(
  fns: readonly JsExportFn[],
  stage: 'compute' | 'fragment' = 'compute',
) {
  const argFor = PROBE_ARG[stage]!
  const calls = fns.map((fn, i) => {
    const args = fn.paramTypes.map(t => argFor[t]!).join(', ')
    const call = `${fn.name}(${args})`
    const asFloat =
      fn.returnType === 'float'
        ? call
        : fn.returnType === 'bool'
          ? `(${call} ? 1.0 : 0.0)`
          : fn.returnType === 'float2'
            ? `(${call}).x`
            : `float(${call})`
    return stage === 'compute'
      ? `  oracleSink[${i}] = ${asFloat};`
      : `  acc += ${asFloat};`
  })
  return stage === 'fragment'
    ? [
        '',
        '[shader("fragment")]',
        'float4 oracleProbe(float4 pos : SV_Position) : SV_Target {',
        '  float acc = 0.0;',
        ...calls,
        '  return float4(acc);',
        '}',
        '',
      ].join('\n')
    : [
        '',
        '[[vk::binding(0, 0)]] RWStructuredBuffer<float> oracleSink;',
        '',
        '[shader("compute")]',
        '[numthreads(1, 1, 1)]',
        'void oracleProbe(uint3 tid : SV_DispatchThreadID) {',
        ...calls,
        '}',
        '',
      ].join('\n')
}

/**
 * Find the name slangc gave an exported function in its C++ output.
 *
 * Resolved from the emitted C++ rather than reused from the WGSL resolution:
 * the disambiguating suffix comes from a counter over everything slangc has
 * declared, and the two targets do not declare the same set. Assuming they
 * match happens to work today and would fail as a wrong-function comparison,
 * which is the one failure this whole file must not have.
 */
export function resolveCppName(cpp: string, want: string) {
  const found = new Set<string>()
  for (const m of cpp.matchAll(/^[\w:<>,\s*]+?\s(\w+_\d+)\s*\(/gm)) {
    if (demangle(m[1]!) === want) {
      found.add(m[1]!)
    }
  }
  if (found.size === 1) {
    return [...found][0]!
  }
  throw new Error(
    found.size === 0
      ? `oracle: '${want}' is not in the emitted C++. Slang drops what the ` +
          `probe cannot reach — check that it is named in //! js-export.`
      : `oracle: '${want}' is ambiguous in the emitted C++ (${[...found].join(', ')}).`,
  )
}

// Inputs are drawn from these pools by a deterministic LCG in the generated
// `main`. Every value is exactly representable in BOTH float32 and float64, so
// the two implementations start from identical numbers and any difference in
// the result is the emitter's, not the literal's. They also straddle the shapes
// the exported decisions actually branch on: sub-pixel offsets and half-pixel
// snaps, the 0..1 range a fraction or a probability lives in, small counts, and
// magnitudes past a screen.
const FLOAT_POOL = [
  0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 4.5, 7.5, 20, 39.5, 40, 100.5, 255,
  1024, 65536, -0.5, -1, -2.5, -40, -100.5,
]
// Small counts and flags, then the values where JS's signed coercion differs
// from WGSL's unsigned: 2^31 and above.
const UINT_POOL = [
  0, 1, 2, 3, 6, 7, 8, 12, 255, 256, 1000, 2147483647, 2147483648, 4294967295,
]
const INT_POOL = [0, 1, -1, 2, -2, 7, -7, 255, -255, 2147483647, -2147483648]

const poolFor = (type: string) =>
  type === 'uint' ? UINT_POOL : type === 'int' ? INT_POOL : FLOAT_POOL

const cppLiteral = (type: string, v: number) =>
  type === 'float'
    ? // `0f` and `255f` are not C++ — a float suffix needs a fractional part or
      // an exponent, so a whole-numbered pool entry has to carry `.0`. Every
      // pool value is a short decimal, so the default formatting is exact.
      `${Number.isInteger(v) ? `${v}.0` : v}f`
    : type === 'uint'
      ? `${v}u`
      : type === 'int'
        ? // -2147483648 written as a literal is (unary minus applied to
          // 2147483648), which does not fit an int. Spell it as the limit.
          v === -2147483648
          ? '(-2147483647 - 1)'
          : `${v}`
        : `${v}`

/**
 * The `main` appended to slangc's C++: sweeps `draws` pseudo-random argument
 * tuples per function and prints one tab-separated row each.
 *
 * Self-describing on purpose — it prints the arguments it used alongside the
 * result, instead of both sides agreeing on a random seed. Two implementations
 * of one generator is the same drift this project exists to remove, and it
 * would fail as a mismatch on every row rather than as an obvious bug.
 */
/**
 * Draws for one function, scaled by how many parameters it has.
 *
 * A flat count spends the same effort on `ldRSquared(r)` — where 400 draws
 * saturate a 24-value pool sixteen times over — as on
 * `showChevron(bool, f32, f32, u32, u32, u32, f32, f32)`, whose input space is
 * eight pools wide. The space grows exponentially and this compensates
 * linearly, which is not coverage and is not claimed to be; it just stops the
 * thinnest-sampled functions being the ones with the most room to hide a bug.
 */
const drawsFor = (fn: JsExportFn, base: number) =>
  base * Math.max(1, fn.paramTypes.length)

export function buildOracleMain(
  fns: readonly JsExportFn[],
  cppNames: ReadonlyMap<string, string>,
  draws: number,
) {
  const lines: string[] = [
    '',
    '#include <cstdio>',
    '',
    'static unsigned int oracleSeed = 2463534242u;',
    'static unsigned int oracleNext() {',
    '  oracleSeed ^= oracleSeed << 13;',
    '  oracleSeed ^= oracleSeed >> 17;',
    '  oracleSeed ^= oracleSeed << 5;',
    '  return oracleSeed;',
    '}',
    '',
    '// %.17g so a float32 value round-trips through text without the printer',
    '// becoming part of what is being compared.',
    'static void emit(double v) { printf("\\t%.17g", v); }',
    '',
    'int main() {',
  ]
  const cppType = (t: string) =>
    t === 'bool'
      ? 'bool'
      : t === 'uint'
        ? 'unsigned int'
        : t === 'int'
          ? 'int'
          : 'float'

  for (const fn of fns) {
    for (const [i, type] of fn.paramTypes.entries()) {
      const values =
        type === 'bool'
          ? ['0', '1']
          : poolFor(type).map(v => cppLiteral(type, v))
      lines.push(
        `  static const ${type === 'bool' ? 'int' : cppType(type)} ` +
          `pool_${fn.name}_${i}[] = {${values.join(', ')}};`,
      )
    }
    lines.push(`  for (int d = 0; d < ${drawsFor(fn, draws)}; d++) {`)
    // Each argument is drawn ONCE into a local, then both printed and passed.
    // Drawing inline at each use would advance the generator between the two,
    // so every row would report arguments the call never saw.
    for (const [i, type] of fn.paramTypes.entries()) {
      const size = type === 'bool' ? 2 : poolFor(type).length
      const draw = `pool_${fn.name}_${i}[oracleNext() % ${size}u]`
      lines.push(
        `    ${cppType(type)} a${i} = ${type === 'bool' ? `${draw} != 0` : draw};`,
      )
    }
    lines.push(`    printf("${fn.name}");`)
    for (const [i, type] of fn.paramTypes.entries()) {
      lines.push(
        type === 'bool'
          ? `    emit(a${i} ? 1 : 0);`
          : `    emit(double(a${i}));`,
      )
    }
    const args = fn.paramTypes.map((_, i) => `a${i}`).join(', ')
    lines.push(
      `    ${CPP_PRINT[fn.returnType]!(`${cppNames.get(fn.name)!}(${args})`)}`,
    )
    lines.push('    printf("\\n");')
    lines.push('  }')
  }
  lines.push('  return 0;', '}', '')
  return lines.join('\n')
}

// float32 against float64 over the same exactly-representable inputs. Loose
// enough that a legitimately-narrower intermediate does not fail, tight enough
// that a wrong operator cannot pass: every mistranslation this is looking for
// (a float divide where WGSL truncates, a sign-extended shift, an unwrapped
// subtraction) is wrong by whole units, not by an ulp.
const REL_TOLERANCE = 1e-5

// A float32 significand is 24 bits, so a value of magnitude M carries up to
// M * 2^-24 of rounding the float64 twin does not — and that error is absolute,
// so it survives an operation that drops the magnitude. `hueRampLane(65536)`
// is the worked example: `(hueDeg / 360.0) * 6.0` is 1092.2667236328125 in
// float32 and 1092.2666666666667 in float64, under half an ulp apart at that
// magnitude and therefore correct, and then `% 2.0` carries the whole 5.7e-5
// down onto a result of 0.38. Scaling the slack by the RESULT calls that a
// mistranslation; scaling it by the widest magnitude the inputs carried in
// calls it what it is.
const F32_EPS = 2 ** -24

/**
 * Whether the twin's output matches the C++ oracle's.
 *
 * `floatArgs` is the call's float-typed arguments and nothing else. Integer
 * parameters are exact on both sides — `uint` is `uint32_t` in the C++ and a
 * whole float64 in the twin — so drawing 4294967295 from `UINT_POOL` says
 * nothing about how much rounding the computation can have accumulated, and
 * folding it in would put the slack at 256.
 */
export function agrees(
  a: number,
  b: number,
  floatArgs: readonly number[] = [],
) {
  if (Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b))) {
    return true
  }
  const outScale = Math.max(1, Math.abs(a), Math.abs(b))
  const inScale = Math.max(
    outScale,
    ...floatArgs.map(Math.abs).filter(v => Number.isFinite(v)),
  )
  return (
    Math.abs(a - b) <= Math.max(REL_TOLERANCE * outScale, F32_EPS * inScale)
  )
}

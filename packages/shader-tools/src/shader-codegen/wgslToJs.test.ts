import { emitJsTwins, parseWgsl } from './wgslToJs.ts'

// The emitter's contract is narrow on purpose (adr-051): transliterate the
// scalar subset exactly, and refuse everything else *loudly*. These tests weight
// the refusals as heavily as the translations — a silent mistranslation is worse
// than the hand-written twin this replaces, because the twin is reviewable.

const HEADER = ['// generated', '']

function emit(wgsl: string, exported: string[]) {
  return emitJsTwins('probe', wgsl, exported, HEADER)
}

/** Evaluate a generated module and hand back one of its exports. */
function evaluate(src: string, name: string) {
  const js = src
    .replaceAll(/^export function/gm, 'function')
    .replaceAll(/: (number|boolean)/g, '')
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`${js}\nreturn ${name}`)() as (
    ...args: number[]
  ) => number
}

test('translates a function with if/else and a call into runnable JS', () => {
  const out = emit(
    `fn double_0( x_0 : f32) -> f32 { return x_0 * 2.0f; }
     fn pick_0( a_0 : f32) -> f32 {
       var _S1 : f32;
       if((a_0 < 0.0f)) { _S1 = double_0(a_0); } else { _S1 = a_0; }
       return _S1;
     }`,
    ['pick'],
  )
  const pick = evaluate(out, 'pick')
  expect(pick(-3)).toBe(-6)
  expect(pick(4)).toBe(4)
})

test('strips slangc name mangling but keeps it when ambiguous', () => {
  const clean = emit(`fn f_0( x_0 : f32) -> f32 { return x_0; }`, ['f'])
  expect(clean).toContain('export function f(x: number)')

  // Two functions colliding on the same base name: nobody gets the short form,
  // rather than one silently shadowing the other.
  const ambiguous = parseWgsl(
    `fn f_0( x_0 : f32) -> f32 { return x_0; }
     fn f_1( x_0 : f32) -> f32 { return x_0 + 1.0f; }`,
  )
  expect(ambiguous.map(f => f.name)).toStrictEqual(['f_0', 'f_1'])
  expect(
    emit(
      `fn f_0( x_0 : f32) -> f32 { return x_0; }
     fn f_1( x_0 : f32) -> f32 { return x_0 + 1.0f; }`,
      ['f_0'],
    ),
  ).toContain('export function f_0(')
})

test('a local reusing another function’s parameter name is not a collision', () => {
  // Regression: a module-wide injectivity check saw `heightPx_0` in one function
  // and `heightPx_1` in another as ambiguous and gave up on the entire file.
  const out = emit(
    `fn a_0( heightPx_0 : f32) -> f32 { return heightPx_0; }
     fn b_0( heightPx_1 : f32) -> f32 { return a_0(heightPx_1) + 1.0f; }`,
    ['a', 'b'],
  )
  expect(out).toContain('export function a(heightPx: number)')
  expect(out).toContain('export function b(heightPx: number)')
  expect(evaluate(out, 'b')(2)).toBe(3)
})

test('only the named functions are exported; dependencies stay private', () => {
  const out = emit(
    `fn helper_0( x_0 : f32) -> f32 { return x_0 * 3.0f; }
     fn top_0( x_0 : f32) -> f32 { return helper_0(x_0); }`,
    ['top'],
  )
  expect(out).toContain('export function top(')
  expect(out).toContain('function helper(')
  expect(out).not.toContain('export function helper(')
})

test('drops literal type suffixes and emits helpers only when used', () => {
  const plain = emit(`fn f_0( x_0 : f32) -> f32 { return x_0 + 0.5f; }`, ['f'])
  expect(plain).toContain('0.5')
  expect(plain).not.toContain('0.5f')
  expect(plain).not.toContain('_clamp')

  const clamped = emit(
    `fn f_0( x_0 : f32) -> f32 { return clamp(x_0, 0.0f, 1.0f); }`,
    ['f'],
  )
  expect(clamped).toContain('function _clamp')
  expect(evaluate(clamped, 'f')(5)).toBe(1)
})

test('entry points are skipped, not parsed', () => {
  // Their stage builtins (`vec3<u32>`) are outside the scalar subset by
  // construction; parsing them would reject a module for a type nothing reads.
  const fns = parseWgsl(
    `fn keep_0( x_0 : f32) -> f32 { return x_0; }
     @compute @workgroup_size(1, 1, 1)
     fn probe(@builtin(global_invocation_id) tid_0 : vec3<u32>) { return; }`,
  )
  expect(fns.map(f => f.name)).toStrictEqual(['keep_0'])
})

test.each([
  ['vector types', `fn f_0( v_0 : vec2<f32>) -> f32 { return 1.0f; }`, 'vec2'],
  ['swizzles', `fn f_0( x_0 : f32) -> f32 { return x_0.y; }`, 'member access'],
  [
    'loops',
    `fn f_0( x_0 : f32) -> f32 { loop { break; } return x_0; }`,
    'loop',
  ],
  ['indexing', `fn f_0( x_0 : f32) -> f32 { return x_0[0]; }`, 'indexing'],
])('refuses %s rather than guessing', (_label, wgsl, needle) => {
  expect(() => emit(wgsl, ['f'])).toThrow(needle)
})

test('refuses an unimplemented builtin instead of emitting a dangling call', () => {
  // `dot` would otherwise look exactly like a call to a module function and be
  // emitted as `dot(...)`, resolving to nothing at runtime.
  expect(() =>
    emit(`fn f_0( x_0 : f32) -> f32 { return dot(x_0, x_0); }`, ['f']),
  ).toThrow(/dot/)
})

test('names the candidates when js-export asks for a missing function', () => {
  expect(() =>
    emit(`fn present_0( x_0 : f32) -> f32 { return x_0; }`, ['absent']),
  ).toThrow(/absent.*present/s)
})

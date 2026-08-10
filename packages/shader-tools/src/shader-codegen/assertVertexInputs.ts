// Build-time cross-check that the codegen's model of the per-instance vertex
// layout matches the shader code slangc actually emitted.
//
// The codegen derives `GL_ATTRIBUTES` / `INSTANCE_OFFSET_*` / the stride from the
// reflected struct's field order, packing tight — reflection does NOT give byte
// offsets for a vertex-input struct, so that packing is the codegen's own
// assumption about how slangc assigns `@location`s. If slangc ever reordered,
// merged, or padded them, every TS packer would write to the wrong attribute:
// a silent, per-backend rendering bug, the exact failure class ADR-005 exists to
// eliminate.
//
// The check is by NAME, not positional: slangc dead-code-eliminates a vertex
// input the shader body never reads (GLSL drops it entirely; WGSL keeps it), so
// a declared input may be missing. What must hold is that any input that IS
// declared sits at its declaration index and carries its declared type — which
// is what the packed offsets encode. Buffer-sharing passes lean on this: the
// canvas chevron pass reads line's buffer, and each side reads only some fields.
//
// `glAttributeSync.test.ts` (products/jbrowse-web) checks name+type on the GLSL
// side, but it lives three packages away, skips the alignments and
// multi-synteny plugins over jest resolution problems, and never looks at WGSL
// or at locations. Checking here fails `pnpm gen:shaders` at the moment the bad
// file would be written, for every shader and both targets.

import { demangle } from './slangcMangling.ts'

import type { InstanceAttr } from './codegen.ts'

function componentCount(a: InstanceAttr) {
  return a.type.kind === 'scalar' ? 1 : a.type.elementCount
}
function scalarType(a: InstanceAttr) {
  return a.type.kind === 'scalar'
    ? a.type.scalarType
    : a.type.elementType.scalarType
}

// `@location(N) name_0 : vec2<u32>` / `@location(N) name_0 : f32`
function wgslTypeOf(a: InstanceAttr) {
  const scalar = { float32: 'f32', uint32: 'u32', int32: 'i32' }[scalarType(a)]
  const n = componentCount(a)
  return n === 1 ? scalar : `vec${n}<${scalar}>`
}

// `in uvec2 a_name;` / `in float a_name;`
function glslTypeOf(a: InstanceAttr) {
  const n = componentCount(a)
  const s = scalarType(a)
  return n === 1
    ? { float32: 'float', uint32: 'uint', int32: 'int' }[s]
    : `${{ float32: '', uint32: 'u', int32: 'i' }[s]}vec${n}`
}

interface DeclaredInput {
  name: string
  location: number
  type: string
}

function parseWgslInputs(wgsl: string): DeclaredInput[] | undefined {
  const struct = /struct vertexInput\w*\s*\{([\s\S]*?)\}/.exec(wgsl)
  if (!struct) {
    return undefined
  }
  return [
    ...struct[1]!.matchAll(/@location\((\d+)\)\s*(\w+)\s*:\s*([^,\n]+)/g),
  ].map(m => ({
    location: Number(m[1]),
    name: demangle(m[2]!),
    type: m[3]!.trim(),
  }))
}

// `\s*` rather than `\n\s*` between the layout qualifier and the declaration:
// they land on separate lines in slangc's output today, and matching only that
// spelling made the whole check depend on the emitter's line breaks.
function parseGlslInputs(glsl: string): DeclaredInput[] {
  return [
    ...glsl.matchAll(/layout\(location\s*=\s*(\d+)\)\s*in\s+(\w+)\s+a_(\w+);/g),
  ].map(m => ({ location: Number(m[1]), type: m[2]!, name: m[3]! }))
}

function compare(
  what: string,
  attrs: InstanceAttr[],
  declared: DeclaredInput[],
  expectedType: (a: InstanceAttr) => string,
) {
  for (const got of declared) {
    const index = attrs.findIndex(a => a.name === got.name)
    if (index === -1) {
      throw new Error(
        `${what}: shader declares vertex input '${got.name}', which is not a ` +
          `field of the reflected instance struct ` +
          `(${attrs.map(a => a.name).join(', ')})`,
      )
    }
    const attr = attrs[index]!
    if (got.location !== index) {
      throw new Error(
        `${what}: field '${attr.name}' is index ${index} of the instance ` +
          `struct but slangc gave it @location(${got.location}); ` +
          `GL_ATTRIBUTES / INSTANCE_OFFSET_* assume declaration order`,
      )
    }
    if (got.type !== expectedType(attr)) {
      throw new Error(
        `${what}: field '${attr.name}' at location ${index} is '${got.type}' ` +
          `in the shader but the codegen packs it as '${expectedType(attr)}'`,
      )
    }
  }
}

// Every check here is over what the parse FOUND, so a parse that finds nothing
// passes. That is the right answer for a shader whose instances come from a
// storage buffer (and for a compute kernel, which gets here with no attrs at
// all): there are no vertex inputs to declare. It is the wrong answer — a guard
// that silently stopped guarding — for a shader whose instance struct IS the
// vertex entry point's parameter, which is what `expectDeclared` says. slangc
// can drop an input the shader body never reads, but not all of them: something
// has to be read for the struct to exist.
function assertParsedSomething(
  what: string,
  expectDeclared: boolean,
  declared: readonly DeclaredInput[] | undefined,
) {
  if (expectDeclared && !declared?.length) {
    throw new Error(
      `${what}: the reflected instance struct is this shader's vertex input, ` +
        `but no vertex input declarations were found in the emitted source. ` +
        `That means the parser stopped matching what slangc emits — the ` +
        `layout cross-check would silently pass from here on. Update the ` +
        `patterns in assertVertexInputs.ts against the new output.`,
    )
  }
}

// Throws if the emitted shaders disagree with `attrs`. `expectDeclared` is true
// when the instance struct is the vertex entry point's own parameter; false for
// storage-buffer instancing, where no vertex inputs are declared at all.
export function assertVertexInputsMatch(
  label: string,
  attrs: InstanceAttr[],
  shaders: { wgsl?: string; glslVertex?: string },
  expectDeclared: boolean,
) {
  if (shaders.wgsl !== undefined) {
    const declared = parseWgslInputs(shaders.wgsl)
    assertParsedSomething(`${label} (WGSL)`, expectDeclared, declared)
    if (declared) {
      compare(`${label} (WGSL)`, attrs, declared, wgslTypeOf)
    }
  }
  if (shaders.glslVertex !== undefined) {
    const declared = parseGlslInputs(shaders.glslVertex)
    assertParsedSomething(`${label} (GLSL)`, expectDeclared, declared)
    compare(`${label} (GLSL)`, attrs, declared, glslTypeOf)
  }
}

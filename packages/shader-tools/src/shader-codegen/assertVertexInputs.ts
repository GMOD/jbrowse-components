// Build-time cross-check that the codegen's model of the per-instance vertex
// layout matches the shader code slangc actually emitted.
//
// The codegen derives `GL_ATTRIBUTES` / `FIELD_OFFSET_F32` / the stride from the
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

// Slang suffixes the field name with a disambiguating index (`color` ->
// `color_1`), and the index isn't stable across shaders, so strip it.
function demangle(name: string) {
  return name.replace(/_\d+$/, '')
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

function parseGlslInputs(glsl: string): DeclaredInput[] {
  return [
    ...glsl.matchAll(
      /layout\(location\s*=\s*(\d+)\)\s*\n\s*in\s+(\w+)\s+a_(\w+);/g,
    ),
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
          `GL_ATTRIBUTES / FIELD_OFFSET_F32 assume declaration order`,
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

// Throws if the emitted shaders disagree with `attrs`. Shaders with no vertex
// input struct (compute kernels, storage-buffer instancing) are skipped.
export function assertVertexInputsMatch(
  label: string,
  attrs: InstanceAttr[],
  shaders: { wgsl?: string; glslVertex?: string },
) {
  if (shaders.wgsl !== undefined) {
    const declared = parseWgslInputs(shaders.wgsl)
    if (declared) {
      compare(`${label} (WGSL)`, attrs, declared, wgslTypeOf)
    }
  }
  if (shaders.glslVertex !== undefined) {
    compare(
      `${label} (GLSL)`,
      attrs,
      parseGlslInputs(shaders.glslVertex),
      glslTypeOf,
    )
  }
}

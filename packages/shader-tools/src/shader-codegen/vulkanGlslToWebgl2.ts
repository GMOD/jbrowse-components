// Slang emits "Vulkan GLSL" (#version 460, gl_VertexIndex, gl_BaseVertex,
// `layout(binding=N)` on UBOs, etc.) — WebGL2 needs GLSL ES 3.00. It also
// mangles identifiers: UBO blocks get `block_<Struct>_0`, vertex attributes
// from an input struct parameter `P` become `P_<field>_0`. This module
// normalises both.

function renameUniformBlock(
  source: string,
  mangled: string,
  target = 'Uniforms',
) {
  const re = new RegExp(
    String.raw`(layout\(std140\)\s*uniform\s+)${mangled}\b`,
    'g',
  )
  return source.replace(re, `$1${target}`)
}

/**
 * Rewrite every `<prefix>_<field>_<n>` identifier to `<target><field>`, and
 * refuse if any `<prefix>_…_<n>` survives.
 *
 * **The suffix is `_<n>`, not `_0`.** slangc's disambiguating index counts
 * declarations it has seen, so it is only usually zero — and a rename keyed on
 * `_0` that misses is silent in both directions at once. The GLSL keeps the
 * mangled name, so `getAttribLocation('a_color')` returns -1 and that attribute
 * reads a constant on WebGL2 only; and `assertVertexInputs` searches for
 * `a_(\w+)`, so the declaration it should have flagged simply drops out of the
 * comparison, which iterates over what it FOUND. The layout cross-check passes
 * while the shader and VERTEX_ATTRIBUTES disagree about a name.
 *
 * Field names are unique within the struct, so widening to `_\d+` cannot alias
 * two fields onto one target: `inst_color_0` and `inst_color2_0` differ before
 * the suffix. The leftover check stays as the backstop for a mangling shape
 * this pattern doesn't anticipate at all.
 */
function renameMangled(
  source: string,
  what: string,
  prefix: string,
  fieldNames: readonly string[],
  target: (field: string) => string,
) {
  let out = source
  for (const f of fieldNames) {
    out = out.replaceAll(
      new RegExp(String.raw`\b${prefix}_${f}_\d+\b`, 'g'),
      target(f),
    )
  }
  const leftover = new RegExp(String.raw`\b${prefix}_\w+_\d+\b`, 'g').exec(out)
  if (leftover) {
    throw new Error(
      `${what}: slangc emitted '${leftover[0]}', which is not any of the ` +
        `reflected names (${fieldNames.join(', ')}) under the prefix ` +
        `'${prefix}'. Renaming only what reflection knows about would leave ` +
        `that identifier mangled in the WebGL2 shader, where nothing looks it ` +
        `up — and the layout cross-check only compares what it can find, so ` +
        `it would pass. Update the patterns in vulkanGlslToWebgl2.ts.`,
    )
  }
  return out
}

export interface RenameOptions {
  uniformBlockName?: string
  attributes?: { prefix: string; fieldNames: readonly string[] }
  /** Vertex-stage varying output names, e.g. `entryPointParam_vsMain`. */
  varyings?: { prefix: string; fieldNames: readonly string[] }
  /** Combined-sampler names (Slang's `Sampler2D<T>` declarations). */
  samplers?: readonly string[]
}

// Slang emits `sampler2D <name>_<n>;` for combined samplers. Rename to
// `u_<name>` so the TS-side GL uniform lookup uses a predictable name. Each
// sampler is its own prefix, so there is no leftover form to check for.
function renameSamplers(source: string, names: readonly string[]) {
  let out = source
  for (const n of names) {
    out = out.replaceAll(new RegExp(String.raw`\b${n}_\d+\b`, 'g'), `u_${n}`)
  }
  return out
}

// GLSL 4.20+ / HLSL brace initializers aren't legal in GLSL ES 3.00 — rewrite
// `Struct_0 v = { a, b, c };` to `Struct_0 v = Struct_0(a, b, c);`. Slang emits
// these when a function takes a local struct by value.
//
// Scans for the matching close brace rather than `[^}]*?`, which stopped at the
// FIRST `}` and would have silently emitted truncated, invalid GLSL for a
// nested initializer. A nested one can't be rewritten anyway (the inner struct's
// type name isn't recoverable from the initializer), so it throws — a build
// failure naming the construct beats a shader that fails to link at runtime on
// WebGL2 only.
function rewriteBraceInitializers(source: string) {
  const declRe = /\b(\w+_\d+)\s+(\w+)\s*=\s*\{/g
  let out = ''
  let cursor = 0
  for (let m = declRe.exec(source); m; m = declRe.exec(source)) {
    const open = m.index + m[0].length - 1
    let depth = 1
    let i = open + 1
    for (; i < source.length && depth > 0; i++) {
      if (source[i] === '{') {
        depth++
      } else if (source[i] === '}') {
        depth--
      }
    }
    const body = source.slice(open + 1, i - 1)
    const rest = source.slice(i)
    // Only a `... } ;` declaration is an initializer; anything else (a
    // function body, a struct definition) is left alone.
    if (depth !== 0 || !/^\s*;/.test(rest)) {
      continue
    }
    if (body.includes('{')) {
      throw new Error(
        `nested brace initializer in slangc's GLSL output ` +
          `(${m[1]} ${m[2]}) — the GLSL ES 3.00 rewrite can't name the inner ` +
          `struct's constructor; teach vulkanGlslToWebgl2 to handle it`,
      )
    }
    const semi = i + rest.indexOf(';') + 1
    out += `${source.slice(cursor, m.index)}${m[1]} ${m[2]} = ${m[1]}(${body.trim()});`
    cursor = semi
    declRe.lastIndex = semi
  }
  return out + source.slice(cursor)
}

// Drop a `struct X { … };` whose name appears nowhere else in the shader.
//
// slangc emits the struct backing a `ConstantBuffer<T>` TWICE into GLSL: once as
// a plain declaration, and again as the `layout(std140) uniform` block that is
// the actual binding. Only the block is ever referenced — the plain one names no
// variable, no parameter and no return type — but it is emitted in full, member
// by member, into every stage that reads a uniform. It is the largest thing in
// the file for a shader whose block is large: 1.8 KB of the alignments read
// pass's 18 KB vertex source, 44 KB across that plugin's twenty passes, and all
// of it is shipped, since a generated module carries its shader as a string
// literal and both backends' sources are exported side by side.
//
// Stated as "unreferenced", not as "the one named like the uniform block",
// because the shape of slangc's duplicate is not something to pin: what makes it
// safe to drop is that nothing can read it, which is checkable here and stays
// true whatever the emitter renames. Anything this gets wrong is caught in the
// same build — `glslangValidator` compiles the processed output, so a struct
// that WAS reachable fails the shader rather than the browser.
//
// Runs after `rewriteBraceInitializers`, which turns `X v = { … }` into a
// `X( … )` constructor call: a struct reached only that way must be counted as
// referenced, and after the rewrite it textually is.
function dropUnreferencedStructs(source: string) {
  const declRe = /\bstruct\s+(\w+)\s*\{/g
  let out = ''
  let cursor = 0
  for (let m = declRe.exec(source); m; m = declRe.exec(source)) {
    const open = m.index + m[0].length - 1
    let depth = 1
    let i = open + 1
    for (; i < source.length && depth > 0; i++) {
      if (source[i] === '{') {
        depth++
      } else if (source[i] === '}') {
        depth--
      }
    }
    const rest = source.slice(i)
    const semi = /^\s*;/.exec(rest)
    if (depth !== 0 || !semi) {
      continue
    }
    const uses = new RegExp(String.raw`\b${m[1]!}\b`, 'g')
    if ((source.match(uses) ?? []).length > 1) {
      continue
    }
    const end = i + semi[0].length
    out += source.slice(cursor, m.index)
    cursor = end
    declRe.lastIndex = end
  }
  return out + source.slice(cursor)
}

export function vulkanGlslToWebgl2(
  source: string,
  stage: 'vertex' | 'fragment',
  renames: RenameOptions = {},
) {
  let out = source

  // `precision highp sampler2D` is not redundant with the two above it, and it
  // is the one WebGL2-only difference in this file that nothing would have
  // reported. GLSL ES 3.00 predeclares `precision lowp sampler2D` in BOTH
  // stages (§4.5.4) — unlike float, whose fragment-stage default is absent
  // rather than low — so a sampled value came back lowp: a minimum of 2^-8
  // relative precision, which is exactly the width of the 8-bit color it is
  // sampling and therefore the edge of banding it. WebGPU has no equivalent
  // notion, so the two backends were reading the same ramp texture at
  // different precisions. Desktop drivers generally ignore precision
  // qualifiers, which is what makes this the sort of thing that only shows up
  // on someone else's phone.
  //
  // Emitted only when the shader has a sampler, to keep it legible in the
  // three generated files it belongs in rather than the forty it doesn't.
  const samplerPrecision = renames.samplers?.length
    ? 'precision highp sampler2D;\n'
    : ''
  out = out.replace(
    /^#version\s+4\d\d\s*\n/,
    `#version 300 es\nprecision highp float;\nprecision highp int;\n${samplerPrecision}`,
  )
  out = out.replace(
    /^#extension\s+GL_ARB_shader_draw_parameters\s*:\s*require\s*\n/m,
    '',
  )
  out = out.replaceAll(/^layout\(row_major\)\s*(uniform|buffer);\s*\n/gm, '')
  out = out.replaceAll(/^layout\(binding\s*=\s*\d+\)\s*\n/gm, '')
  out = out.replaceAll(/gl_VertexIndex\s*-\s*gl_BaseVertex/g, 'gl_VertexID')
  out = out.replaceAll(
    /gl_InstanceIndex\s*-\s*gl_BaseInstance/g,
    'gl_InstanceID',
  )
  out = out.replaceAll(/\bgl_VertexIndex\b/g, 'gl_VertexID')
  out = out.replaceAll(/\bgl_InstanceIndex\b/g, 'gl_InstanceID')

  out =
    stage === 'vertex'
      ? out.replaceAll(/layout\(location\s*=\s*\d+\)\s*\nout\s/g, 'out ')
      : out.replaceAll(/layout\(location\s*=\s*\d+\)\s*\nin\s/g, 'in ')

  out = rewriteBraceInitializers(out)
  out = dropUnreferencedStructs(out)

  if (renames.uniformBlockName) {
    out = renameUniformBlock(out, renames.uniformBlockName)
  }
  if (renames.attributes) {
    out = renameMangled(
      out,
      'vertex attributes',
      renames.attributes.prefix,
      renames.attributes.fieldNames,
      f => `a_${f}`,
    )
  }
  // Varyings go to a shared `v_<field>` so vertex outputs and fragment inputs
  // link by name — GLSL ES 3.00 allows no `layout(location=N)` on either.
  if (renames.varyings) {
    out = renameMangled(
      out,
      'varyings',
      renames.varyings.prefix,
      renames.varyings.fieldNames,
      f => `v_${f}`,
    )
  }
  if (renames.samplers && renames.samplers.length > 0) {
    out = renameSamplers(out, renames.samplers)
  }

  return out
}

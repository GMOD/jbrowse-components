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

function renameAttributeIdentifiers(
  source: string,
  prefix: string,
  fieldNames: readonly string[],
) {
  let out = source
  for (const f of fieldNames) {
    const re = new RegExp(String.raw`\b${prefix}_${f}_0\b`, 'g')
    out = out.replace(re, `a_${f}`)
  }
  return out
}

// Rename mangled varying names to a shared `v_<field>` convention so that
// vertex outputs and fragment inputs link by name (WebGL2 GLSL ES does not
// allow `layout(location=N)` on vertex-out or fragment-in).
function renameVaryings(
  source: string,
  prefix: string,
  fieldNames: readonly string[],
) {
  let out = source
  for (const f of fieldNames) {
    const re = new RegExp(String.raw`\b${prefix}_${f}_0\b`, 'g')
    out = out.replace(re, `v_${f}`)
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

// Slang emits `sampler2D <name>_0;` for combined samplers. Rename to
// `u_<name>` so the TS-side GL uniform lookup uses a predictable name.
function renameSamplers(source: string, names: readonly string[]) {
  let out = source
  for (const n of names) {
    const re = new RegExp(String.raw`\b${n}_0\b`, 'g')
    out = out.replace(re, `u_${n}`)
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

export function vulkanGlslToWebgl2(
  source: string,
  stage: 'vertex' | 'fragment',
  renames: RenameOptions = {},
) {
  let out = source

  out = out.replace(
    /^#version\s+4\d\d\s*\n/,
    `#version 300 es\nprecision highp float;\nprecision highp int;\n`,
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

  if (renames.uniformBlockName) {
    out = renameUniformBlock(out, renames.uniformBlockName)
  }
  if (renames.attributes) {
    out = renameAttributeIdentifiers(
      out,
      renames.attributes.prefix,
      renames.attributes.fieldNames,
    )
  }
  if (renames.varyings) {
    out = renameVaryings(
      out,
      renames.varyings.prefix,
      renames.varyings.fieldNames,
    )
  }
  if (renames.samplers && renames.samplers.length > 0) {
    out = renameSamplers(out, renames.samplers)
  }

  return out
}

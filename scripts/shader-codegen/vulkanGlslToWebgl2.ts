// Slang emits "Vulkan GLSL" (#version 460, gl_VertexIndex, gl_BaseVertex,
// `layout(binding=N)` on UBOs, etc.) — WebGL2 needs GLSL ES 3.00. It also
// mangles identifiers: UBO blocks get `block_<Struct>_0`, vertex attributes
// from an input struct parameter `P` become `P_<field>_0`. This module
// normalises both.

import { readFileSync, writeFileSync } from 'node:fs'

function renameUniformBlock(source: string, mangled: string, target = 'Uniforms') {
  const re = new RegExp(`(layout\\(std140\\)\\s*uniform\\s+)${mangled}\\b`, 'g')
  return source.replace(re, `$1${target}`)
}

function renameAttributeIdentifiers(
  source: string,
  prefix: string,
  fieldNames: readonly string[],
) {
  let out = source
  for (const f of fieldNames) {
    const re = new RegExp(`\\b${prefix}_${f}_0\\b`, 'g')
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
    const re = new RegExp(`\\b${prefix}_${f}_0\\b`, 'g')
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
    const re = new RegExp(`\\b${n}_0\\b`, 'g')
    out = out.replace(re, `u_${n}`)
  }
  return out
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
  out = out.replace(/^#extension\s+GL_ARB_shader_draw_parameters\s*:\s*require\s*\n/m, '')
  out = out.replace(/^layout\(row_major\)\s*(uniform|buffer);\s*\n/gm, '')
  out = out.replace(/^layout\(binding\s*=\s*\d+\)\s*\n/gm, '')
  out = out.replace(/gl_VertexIndex\s*-\s*gl_BaseVertex/g, 'gl_VertexID')
  out = out.replace(/\bgl_VertexIndex\b/g, 'gl_VertexID')
  out = out.replace(/\bgl_InstanceIndex\b/g, 'gl_InstanceID')

  if (stage === 'vertex') {
    out = out.replace(/layout\(location\s*=\s*\d+\)\s*\nout\s/g, 'out ')
  } else {
    out = out.replace(/layout\(location\s*=\s*\d+\)\s*\nin\s/g, 'in ')
  }

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
    out = renameVaryings(out, renames.varyings.prefix, renames.varyings.fieldNames)
  }
  if (renames.samplers && renames.samplers.length > 0) {
    out = renameSamplers(out, renames.samplers)
  }

  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , input, output, stageArg, ...rest] = process.argv
  if (!input || !output || (stageArg !== 'vertex' && stageArg !== 'fragment')) {
    console.error(
      'usage: vulkanGlslToWebgl2.ts <in> <out> <vertex|fragment> [--block <name>] [--attr <prefix> <f1,f2,...>]',
    )
    process.exit(1)
  }
  const renames: RenameOptions = {}
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--block' && rest[i + 1]) {
      renames.uniformBlockName = rest[i + 1]
      i++
    } else if (rest[i] === '--attr' && rest[i + 1] && rest[i + 2]) {
      renames.attributes = {
        prefix: rest[i + 1]!,
        fieldNames: rest[i + 2]!.split(','),
      }
      i += 2
    }
  }
  const src = readFileSync(input, 'utf8')
  writeFileSync(output, vulkanGlslToWebgl2(src, stageArg, renames))
}

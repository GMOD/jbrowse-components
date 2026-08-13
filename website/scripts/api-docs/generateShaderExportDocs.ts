import fs from 'fs'

import { markdownTable, rewriteMarkerBlock } from './util.ts'

// What `gen:shaders` writes into a `*.generated.ts`, rendered into the GPU
// display guide from the emitter itself.
//
// The guide listed these by hand and was three short (`BINDINGS`,
// `VERTS_PER_INSTANCE`, `UNIFORM_OFFSET_U32`) while naming an `INSTANCE_OFFSET_I32`
// that only appears when a shader has int-typed instance fields. That list is
// the contract a plugin author codes against, so being short is the one thing it
// must not be.
//
// The manifest is the emitter's own `export const` / `export function` lines: a
// site with no `#shaderExport <name> | <description>` tag directly above it is
// fatal, so adding an emit and forgetting the docs cannot happen quietly.
const EMITTER = 'packages/shader-tools/src/shader-codegen/codegen.ts'

// A line that pushes an `export …` into the generated module, in either quoting
// style the emitter uses.
//
// `class` and `interface` are in the list because leaving a kind out is silent
// in the direction that matters: an untagged emit is fatal, but an emit this
// pattern does not recognize is not an emit at all, so `InstanceWriter` was
// tagged, skipped, and absent from the guide with nothing said — and `Uniforms`
// / `InstanceArrays` were absent for the same reason, while the two functions
// that take them as arguments were listed. Any new `export <kind>` the emitter
// learns has to be added here in the same commit.
const EMIT_SITE = /['"`]export (?:const|function|class|interface) /

interface ShaderExport {
  name: string
  description: string
}

export function collectShaderExports(): ShaderExport[] {
  const lines = fs.readFileSync(EMITTER, 'utf8').split('\n')
  const exports: ShaderExport[] = []
  const untagged: number[] = []
  for (const [i, line] of lines.entries()) {
    if (!EMIT_SITE.test(line)) {
      continue
    }
    // a few sites wrap the pushed string onto its own line, so the tag sits two
    // or three lines above rather than immediately over it
    // Walk up from the emit site and stop at the NEAREST tag, not the first one
    // in a window: a few sites wrap the pushed string onto its own line, so the
    // tag can be two or three lines up, and scanning a joined window forwards
    // attributes consecutive emits (INSTANCE_STRIDE_BYTES then _WORDS) to the
    // same tag — the second then dedupes away and vanishes from the table.
    let tag: RegExpExecArray | null = null
    for (let j = i - 1; j >= Math.max(0, i - 3) && !tag; j--) {
      tag = /#shaderExport\s+(.+?)\s*\|\s*(.+?)\s*$/.exec(lines[j] ?? '')
    }
    if (tag) {
      // one tag covers a templated site that emits a family (INSTANCE_OFFSET_*)
      if (!exports.some(e => e.name === tag[1])) {
        exports.push({ name: tag[1]!, description: tag[2]! })
      }
    } else {
      untagged.push(i + 1)
    }
  }
  if (untagged.length > 0) {
    throw new Error(
      `these ${EMITTER} lines emit an export with no \`// #shaderExport <name> | <description>\` tag above them, so the GPU guide's list of what gen:shaders writes would be short: ${untagged.join(', ')}`,
    )
  }
  return exports
}

export function writeShaderExportDocs({ check = false } = {}) {
  return rewriteMarkerBlock(
    'SHADER_EXPORTS',
    markdownTable(
      ['Export', 'What it is'],
      collectShaderExports().map(e => `| \`${e.name}\` | ${e.description} |`),
    ),
    { check },
  )
}

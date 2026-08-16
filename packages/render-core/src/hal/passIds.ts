import type { PipelineDescriptor } from './types.ts'

/**
 * Throw if two passes in one display's registry share an `id`.
 *
 * A pass id is two keys at once — the pipeline (`pipelines.set(desc.id, …)` in
 * both HALs) and the instance buffer (`uploadBuffer(regionKey, passId, …)`).
 * A duplicate therefore collides both: the second registration replaces the
 * first's pipeline, both passes upload to one buffer so the last write wins,
 * and whichever shader has the larger stride reads off the end of it. No
 * validation error, no throw, no failing test — just wrong pixels on the GPU
 * backends while Canvas2D keeps drawing correctly.
 *
 * Nothing structural stops it. A display's pass list is concatenated from
 * several registries (`ALIGNMENTS_PASSES` merges three plus a standalone
 * overlay pass), each `slangPass({ id })` sits in its own feature directory,
 * and a new directory copied from a neighbour is exactly how the id would come
 * along with the rest of the file.
 *
 * The id is reported rather than just counted, because the duplicate is a
 * string the author typed and the fix is renaming one of the two.
 */
export function assertUniquePassIds(passes: readonly PipelineDescriptor[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const { id } of passes) {
    if (seen.has(id)) {
      duplicates.add(id)
    }
    seen.add(id)
  }
  if (duplicates.size > 0) {
    throw new Error(
      `duplicate pass id(s) ${[...duplicates].map(id => `'${id}'`).join(', ')}` +
        ` — a pass id keys both the pipeline and the instance buffer, so two` +
        ` passes sharing one draw each other's instances through their own` +
        ` shader. Rename one.`,
    )
  }
}

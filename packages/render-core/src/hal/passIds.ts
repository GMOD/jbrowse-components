import type { PipelineDescriptor } from './types.ts'

/**
 * Throw if two passes in one display's registry share an `id`.
 *
 * A pass id names a slot: the descriptor a draw of that id uses, its instance
 * buffer per region, and its texture. Compiled pipelines and programs are keyed
 * by content instead, so a second id over one shader costs no compile. A
 * duplicate id collides the slot: the later descriptor answers every draw of
 * it, both passes upload to one buffer so the last write wins, and whichever
 * shader has the larger stride reads off the end of it. No validation error, no
 * throw, no failing test — just wrong pixels on the GPU backends while Canvas2D
 * keeps drawing correctly.
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
        ` — a pass id keys the descriptor, the instance buffer and the` +
        ` texture, so two passes sharing one draw each other's instances` +
        ` through one shader. Rename one.`,
    )
  }
}

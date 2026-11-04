import type { PeptideData } from '../types.ts'

// Pan steps refetch the same transcripts over and over, and a hit skips both
// the sequence read and the translation: TTN's 22 isoforms are 670k residues.
// Its own module so the eagerly loaded RPC method can own one without pulling
// in the translation code it lazy-loads.
export type PeptideCache = ReturnType<typeof createPeptideCache>

// Bounded by residues rather than entries, since one titin isoform weighs as
// much as seventy typical proteins. A Map iterates in insertion order, so
// re-inserting on a hit keeps the least recently used entry first to go.
export function createPeptideCache(maxResidues = 5_000_000) {
  const entries = new Map<string, PeptideData>()
  let residues = 0
  return {
    get(key: string) {
      const hit = entries.get(key)
      if (hit) {
        entries.delete(key)
        entries.set(key, hit)
      }
      return hit
    },
    set(key: string, value: PeptideData) {
      const previous = entries.get(key)
      if (previous) {
        entries.delete(key)
        residues -= previous.protein.length
      }
      entries.set(key, value)
      residues += value.protein.length
      for (const [oldest, { protein }] of entries) {
        if (residues <= maxResidues) {
          break
        }
        entries.delete(oldest)
        residues -= protein.length
      }
    },
  }
}

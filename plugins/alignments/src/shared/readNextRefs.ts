import type { Feature } from '@jbrowse/core/util'

/**
 * The mate's reference name per read, as a slot into a table of the distinct
 * names rather than a string per read.
 *
 * `readNextRefs: string[]` was 153,677 strings holding, on the deepest
 * short-read window, **one** distinct value — every mate on the same contig. It
 * measured 16.5ms to build and 8.0ms to structured-clone; the table is 8.8ms all
 * in — 2.8x, measured through this function rather than a stand-in
 * (`benches/readNextRefs.bench.ts`).
 *
 * Both halves come from the same fact and neither needed the array. The build
 * was `refIdToName` per read, manufacturing a string from a number the record
 * already holds; the clone was priced by object COUNT, as ever. So the worker
 * reads the number, resolves a name once per distinct contig, and ships a
 * transferable of slots plus a table with a handful of entries in it.
 *
 * The consumers were never bulk: `buildReadInterchrom` reduces the whole array
 * to one bit per read INSIDE the worker, the tooltip reads one on hover, and
 * arcs read one per drawn arc. `nextRefAt` serves the last two.
 */
export interface ReadNextRefs {
  // Slot into `nextRefNames`, or -1 for a read with no mate. Int32 because a
  // BAM's reference count is a signed 32-bit field, and -1 is already its own
  // "no reference" sentinel.
  readNextRefIds: Int32Array
  // The distinct mate reference names, in first-seen order. A handful of
  // entries — one on the fixture above, a few dozen on a whole-genome BAM.
  nextRefNames: string[]
}

/** The mate's reference name for read `i`, or `''` when it has no mate. */
export function nextRefAt(d: ReadNextRefs, i: number) {
  const slot = d.readNextRefIds[i]
  return slot === undefined || slot < 0 ? '' : (d.nextRefNames[slot] ?? '')
}

/**
 * The table for mate references already in hand — the shape a test fixture
 * builds with, and the one the no-refId path below produces. `''` is "no mate",
 * which is the -1 slot rather than an entry in the table.
 */
export function nextRefsToTable(mateRefs: string[]): ReadNextRefs {
  const readNextRefIds = new Int32Array(mateRefs.length)
  const nextRefNames: string[] = []
  const slots = new Map<string, number>()
  for (let i = 0; i < mateRefs.length; i++) {
    const name = mateRefs[i]!
    if (!name) {
      readNextRefIds[i] = -1
      continue
    }
    let slot = slots.get(name)
    if (slot === undefined) {
      slot = nextRefNames.length
      nextRefNames.push(name)
      slots.set(name, slot)
    }
    readNextRefIds[i] = slot
  }
  return { readNextRefIds, nextRefNames }
}

/**
 * A feature that can report its mate's reference as the number the file stores,
 * so the name never has to be built per read. `BamSlightlyLazyFeature`
 * implements it; -1 is BAM's own "no reference" value and is passed through.
 */
interface HasNextRefId {
  nextRefId?: number
}

/**
 * Build the slots and the name table for one fetch's features.
 *
 * The BAM path indexes by the file's own reference id, so recognising a repeat
 * is an array read with no hashing and the name is resolved once per contig.
 * Anything else (CRAM, SAM, the synteny blocks) has only the string, so it
 * interns through a Map — still one entry per distinct name, and it was already
 * paying for the string.
 */
export function buildReadNextRefs(features: Feature[]): ReadNextRefs {
  const n = features.length
  const readNextRefIds = new Int32Array(n)
  const nextRefNames: string[] = []
  // One cast for the array rather than one per element, which in a hot loop is
  // the same assertion n times.
  const mated = features as (Feature & HasNextRefId)[]

  if (mated[0]?.nextRefId === undefined) {
    return nextRefsToTable(
      features.map(f => (f.get('next_ref') as string | undefined) ?? ''),
    )
  }

  // Sparse by reference id, so the repeat check is one array read. A BAM's ids
  // are dense from 0 and there are thousands at most, so the table is small
  // whichever contigs the mates land on.
  const slotByRefId: number[] = []
  for (let i = 0; i < n; i++) {
    const refId = mated[i]!.nextRefId ?? -1
    if (refId < 0) {
      readNextRefIds[i] = -1
      continue
    }
    let slot = slotByRefId[refId]
    if (slot === undefined) {
      // The one place a name is built, and only for a contig not yet seen.
      const name = (features[i]!.get('next_ref') as string | undefined) ?? ''
      slot = nextRefNames.length
      nextRefNames.push(name)
      slotByRefId[refId] = slot
    }
    readNextRefIds[i] = slot
  }
  return { readNextRefIds, nextRefNames }
}

/**
 * Per-read flag: 1 when the mate maps to a different chromosome than the region
 * being rendered, else 0. The read pass uses it to fade out the strand arrow for
 * these reads, since mate direction is meaningless across chromosomes (see
 * read.slang `dirMoot`). A read with no mate is never interchromosomal.
 *
 * Resolved per SLOT, not per read — the comparison is against a handful of
 * names however deep the pileup is.
 */
export function buildReadInterchrom(
  d: ReadNextRefs,
  refName: string,
  numReads: number,
): Uint8Array {
  const out = new Uint8Array(numReads)
  const elsewhere = d.nextRefNames.map(name =>
    name && name !== refName ? 1 : 0,
  )
  const ids = d.readNextRefIds
  for (let i = 0; i < numReads; i++) {
    const slot = ids[i]!
    out[i] = slot < 0 ? 0 : elsewhere[slot]!
  }
  return out
}

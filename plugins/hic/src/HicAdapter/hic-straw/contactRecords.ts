// Vendored and converted to TypeScript from hic-straw (igvteam, MIT license)
// https://github.com/igvteam/hic-straw

/**
 * A run of contact records, held struct-of-arrays.
 *
 * hic-straw modelled a contact as an object, and the whole read path inherited
 * that shape: a block held `ContactRecord[]`, the window filter rebuilt the
 * array, the adapter rebuilt it again to attach region indices, and only
 * `executeRenderHicData` finally unpacked it into the typed arrays the vertex
 * buffer wanted. Three object allocations per contact, and a matrix is
 * routinely millions of contacts.
 *
 * The per-contact allocation is the obvious cost, but the block cache is the
 * expensive one: cached blocks are long-lived, so as objects they left millions
 * of live pointers for every GC to trace for the rest of the session. Twelve
 * bytes a contact here against ~50 for an object, and nothing for the collector
 * to walk.
 *
 * The three arrays are always exactly the same length — `bin1.length` is the
 * record count. Counts are float32 because that is both what the file stores
 * (`getFloat`/`getShort`) and what the shader takes, so carrying them as
 * doubles only ever widened a value on its way back down to float32.
 */
export interface ContactRecords {
  bin1: Int32Array
  bin2: Int32Array
  counts: Float32Array
}

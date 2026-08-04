// Re-exported rather than reimplemented. This used to be its own
// `feature.get('tags')?.[tag]` one-liner, which is the exact fallback path
// modifications-utils' getTag() only takes for features that have no targeted
// tag accessor: on a BAM feature it decodes EVERY tag on the read (a Record
// allocation plus NM/AS/ms/de/… — often ~10 per read) to answer one. The only
// caller reads `SA` off a BAM/CRAM feature, so it paid that on every read-vs-ref
// launch. Keeping the export here (rather than pointing the caller at
// modifications-utils) preserves `@jbrowse/alignments-core`'s public surface.
export { getTag } from '@jbrowse/modifications-utils'

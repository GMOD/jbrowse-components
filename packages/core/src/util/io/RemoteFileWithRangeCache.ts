/**
 * The chunk cache now lives in `@gmod/range-cache-filehandle`, extracted from
 * this file so the @gmod parsers can use it without depending on
 * `@jbrowse/core`, react and mobx-state-tree.
 *
 * Kept as a re-export rather than deleted: `products/jbrowse-web/src/tests`
 * imports `clearCache` from this path directly, and `@jbrowse/core/util/io`
 * re-exports the two classes from here.
 */
export {
  CachedFilehandle,
  RemoteFileWithRangeCache,
  clearCache,
  sweepIdleCache,
} from '@gmod/range-cache-filehandle'

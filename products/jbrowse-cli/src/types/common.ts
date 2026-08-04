// the indexer package owns both of these: which adapter types text-index can
// handle, and the URL test its stream opener uses to pick fetch vs fs
export {
  isURL,
  isSupportedIndexingAdapter as supported,
} from '@jbrowse/text-indexing-core'

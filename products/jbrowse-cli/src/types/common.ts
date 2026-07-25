import fetch from '../cliFetch.ts'

export async function createRemoteStream(urlIn: string) {
  const res = await fetch(urlIn)
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${urlIn} status ${res.status} ${await res.text()}`,
    )
  }
  return res
}

// the indexer package owns both of these: which adapter types text-index can
// handle, and the URL test its stream opener uses to pick fetch vs fs
export {
  isURL,
  isSupportedIndexingAdapter as supported,
} from '@jbrowse/text-indexing-core'

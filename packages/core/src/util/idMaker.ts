// generates a short "id fingerprint" from the config passed to the base
// feature adapter. hashes incrementally during traversal so no large
// intermediate string is ever allocated, and stops after a 5000 char budget:
// the worker hashes on every call, and hashing all of a 10k-feature
// FromConfigAdapter costs ~160ms against ~2ms. Code that builds a large inline
// config hashes it whole once, via `withAdapterId`.
export default function idMaker(args: Record<string, unknown>, budget = 5000) {
  let hash = 0
  let count = 0
  const stack = [args]

  outer: while (stack.length) {
    const obj = stack.pop()!
    for (const key in obj) {
      if (count > budget) {
        break outer
      }
      const val = obj[key]
      let s: string
      if (typeof val === 'object' && val !== null) {
        stack.push(val as Record<string, unknown>)
        if (!Array.isArray(val)) {
          continue
        }
        // the budget can stop partway into a long array, so its length tells
        // apart two arrays that differ only past that point
        s = `${key}#${val.length}`
      } else if (key === 'locationType' && val === 'FileHandleLocation') {
        // normalize FileHandleLocation for consistent hashing across
        // rpcSessionId and adapter cache key
        s = `${key}-BlobLocation`
      } else if (key === 'handleId') {
        s = `blobId-fh-blob-${val}`
      } else {
        s = `${key}-${val}`
      }
      for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i)
        hash |= 0
      }
      count += s.length
    }
  }

  return `adp-${hash}`
}

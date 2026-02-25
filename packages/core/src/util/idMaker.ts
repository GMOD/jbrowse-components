let callCount = 0
const threadLabel = typeof WorkerGlobalScope !== 'undefined' ? 'worker' : 'main'

// generates a short "id fingerprint" from the config passed to the base
// feature adapter. hashes incrementally during traversal so no large
// intermediate string is ever allocated — important for FromConfigAdapter
// which can contain thousands of inline features. exits early once enough
// data has been hashed (equivalent to the old 5000 char budget)
export default function idMaker(args: Record<string, unknown>) {
  console.log(
    `[idMaker] [${threadLabel}] call #`,
    ++callCount,
    new Error().stack?.split('\n')[2]?.trim(),
  )
  let hash = 0
  let count = 0
  const stack = [args]

  outer: while (stack.length) {
    const obj = stack.pop()!
    for (const key in obj) {
      if (count > 5000) {
        break outer
      }
      const val = obj[key]
      if (typeof val === 'object' && val !== null) {
        stack.push(val as Record<string, unknown>)
      } else {
        // normalize FileHandleLocation for consistent hashing across
        // rpcSessionId and adapter cache key
        let s: string
        if (key === 'locationType' && val === 'FileHandleLocation') {
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
  }

  return `adp-${hash}`
}

import { hashCode } from './index.ts'

// generates a short "id fingerprint" from the config passed to the base
// feature adapter by recursively enumerating props, but if config is too big
// does not process entire config (FromConfigAdapter for example can be large)
export default function idMaker(
  args: Record<string, unknown>,
  id = '',
  len = 5000,
) {
  const stack = [args]

  // while not empty
  while (stack.length) {
    const obj = stack.pop()!
    for (const [key, val] of Object.entries(obj)) {
      if (id.length > len) {
        return hashCode(id)
      } else {
        if (typeof val === 'object' && val !== null) {
          stack.push(val as Record<string, unknown>)
        } else {
          id += `${key}-${val}`
        }
      }
    }
  }

  return `adp-${hashCode(id)}`
}

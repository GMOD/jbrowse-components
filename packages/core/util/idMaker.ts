import { hashCode } from './'

// generates a short "id fingerprint" from the config passed to the base
// feature adapter by recursively enumerating props, but if config is too big
// does not process entire config (FromConfigAdapter for example can be large)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function idMaker(args: any, id = '') {
  const keys = Object.keys(args)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (id.length > 5000) {
      break
    }
    if (typeof args[key] === 'object' && args[key]) {
      id += idMaker(args[key], id)
    } else {
      id += `${key}-${args[key]};`
    }
  }
  return hashCode(id)
}

import { hashCode } from './'

// generates a short "id fingerprint" from the config passed to the base
// feature adapter by recursively enumerating props, but if config is too big
// does not process entire config (FromConfigAdapter for example can be large)

export default function idMaker(args: any, id = '') {
  const keys = Object.keys(args)
  for (const key of keys) {
    if (id.length > 5000) {
      break
    }
    id +=
      typeof args[key] === 'object' && args[key]
        ? idMaker(args[key], id)
        : `${key}-${args[key]};`
  }
  return hashCode(id)
}

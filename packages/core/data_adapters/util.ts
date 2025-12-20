import idMaker from '../util/idMaker'

export function adapterConfigCacheKey(conf: Record<string, unknown> = {}) {
  return `${idMaker(conf)}`
}

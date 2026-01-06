import idMaker from '../util/idMaker.ts'

export function adapterConfigCacheKey(conf: Record<string, unknown> = {}) {
  return `${idMaker(conf)}`
}

import idMaker from '../util/idMaker.ts'

export function adapterConfigCacheKey(conf: Record<string, unknown> = {}) {
  return conf.type && conf.adapterId
    ? `${conf.type}-${conf.adapterId}`
    : `${idMaker(conf)}`
}

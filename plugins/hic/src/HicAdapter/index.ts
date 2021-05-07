import configSchema from './configSchema'

export default (/* pluginManager: PluginManager */) => {
  return {
    configSchema,
    getAdapterClass: () => import('./HicAdapter').then(res => res.default),
  }
}

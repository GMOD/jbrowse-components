// the URLs in the config file itself are relative to some directory, they are
// not properly relative to the directory of the react app here, so we add
// relative paths using a helper function here

export function addRelativeUris(config: any, baseUri: string) {
  if (typeof config === 'object' && config !== null) {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === 'object') {
        addRelativeUris(config[key], baseUri)
      } else if (key === 'uri') {
        if (!('baseUri' in config) || !config.baseUri) {
          config.baseUri = baseUri
        }
      }
    }
  }
}

// the URLs in the config file itself are relative to some directory, they are
// not properly relative to the directory of the react app here, so we add
// relative paths using a helper function here

export function addRelativeUris(config: unknown, baseUri: string) {
  if (typeof config === 'object' && config !== null) {
    const obj = config as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      const val = obj[key]
      if (typeof val === 'object' && val !== null) {
        addRelativeUris(val, baseUri)
      } else if (key === 'uri' && !obj.baseUri) {
        obj.baseUri = baseUri
      }
    }
  }
}

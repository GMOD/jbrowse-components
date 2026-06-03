// the URLs in the config file itself are relative to some directory, they are
// not properly relative to the directory of the react app here, so we add
// relative paths using a helper function here

export function addRelativeUris(config: unknown, baseUri: string) {
  if (config !== null && typeof config === 'object') {
    const obj = config as Record<string, unknown>
    if (typeof obj.uri === 'string' && obj.baseUri === undefined) {
      obj.baseUri = baseUri
    }
    for (const value of Object.values(obj)) {
      addRelativeUris(value, baseUri)
    }
  }
}

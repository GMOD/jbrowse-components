export function addRelativeUris(
  config: Record<string, unknown> | null,
  base: URL,
) {
  if (typeof config === 'object' && config !== null) {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === 'object' && config[key] !== null) {
        addRelativeUris(config[key] as Record<string, unknown>, base)
      } else if (key === 'uri') {
        config.baseUri = base.href
      }
    }
  }
}

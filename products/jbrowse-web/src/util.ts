export { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
export { b64PadSuffix, fromUrlSafeB64, toUrlSafeB64 } from '@jbrowse/core/util'
export { checkPlugins } from '@jbrowse/core/checkPlugins'

// raw readConf alternative for before conf is initialized
export function readConf(
  root: Record<string, unknown> | undefined,
  attr: string,
  def: string,
) {
  const configuration = root?.configuration as
    | Record<string, unknown>
    | undefined
  return configuration?.[attr] ?? def
}

export const reloadPage = () => {
  window.location.reload()
}

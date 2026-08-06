export { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
export {
  b64PadSuffix,
  fromUrlSafeB64,
  readSessionFromDynamo,
  shareEndpoint,
  toUrlSafeB64,
} from '@jbrowse/core/util'
export { checkPlugins } from '@jbrowse/core/checkPlugins'

// raw readConf alternative for before conf is initialized. String slots only —
// the config snapshot is unvalidated JSON at this point, so a non-string falls
// back rather than propagating into a template literal. An explicit empty
// string is honored as-is (`shareURL: ""` means "resolve against this page").
export function readConf(
  root: Record<string, unknown> | undefined,
  attr: string,
  def: string,
) {
  const configuration = root?.configuration as
    | Record<string, unknown>
    | undefined
  const value = configuration?.[attr]
  return typeof value === 'string' ? value : def
}

export const reloadPage = () => {
  window.location.reload()
}

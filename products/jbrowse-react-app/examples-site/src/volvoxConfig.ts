import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'

import volvoxConfigJson from './volvox-config.json' with { type: 'json' }

const VOLVOX_CONFIG_URL =
  'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json'

// The volvox test config uses relative URIs (e.g. `volvox.2bit`). addRelativeUris
// tags every object that has a `uri` with a `baseUri` so JBrowse resolves them
// against the jbrowse.org test_data directory the config was downloaded from.
export const volvoxConfig = structuredClone(volvoxConfigJson)
addRelativeUris(volvoxConfig, new URL(VOLVOX_CONFIG_URL))

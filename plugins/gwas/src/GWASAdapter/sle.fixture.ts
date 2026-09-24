import { readFileSync } from 'node:fs'

import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import { parsePlinkLDLine, resolvePlinkLDHeader } from '@jbrowse/ld-core'

import GWASAdapterF from './index.ts'

import type { PlinkLDRecord } from '@jbrowse/ld-core'

const dir = require
  .resolve('../../../../test_data/gwas/SLE.ld')
  .split('/')
  .slice(0, -1)
  .join('/')

const [head = '', ...rest] = readFileSync(`${dir}/SLE.ld`, 'utf8')
  .split('\n')
  .filter(line => line.trim())
const { header } = resolvePlinkLDHeader(head)
const records = rest.flatMap(line => parsePlinkLDLine(line, header) ?? [])

// test_data/gwas/SLE.ld read whole, in the part PlinkLDAdapter plays, which
// lives in plugins/variants out of this plugin's reach
class SleLDAdapter extends BaseAdapter {
  async getLDRecords(query: { refName: string; start: number; end: number }) {
    return records.filter(
      (r: PlinkLDRecord) =>
        r.chrA === query.refName && r.bpA >= query.start && r.bpA <= query.end,
    )
  }

  async getLDRecordsInRegion() {
    return []
  }

  async getHeader() {
    return header
  }
}

export function slePluginManager() {
  const pluginManager = new PluginManager()
  GWASAdapterF(pluginManager)
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'SleLDAdapter',
        configSchema: ConfigurationSchema(
          'SleLDAdapter',
          {},
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(SleLDAdapter),
      }),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

const local = (path: string) => ({
  localPath: `${dir}/${path}`,
  locationType: 'LocalPathLocation',
})

/** `test_data/gwas`'s SLE summary statistics, with its `.ld` as the ldAdapter. */
export const SLE_ADAPTER = {
  type: 'GWASAdapter',
  bedGzLocation: local('SLE_gwas.bed.gz'),
  index: { location: local('SLE_gwas.bed.gz.tbi') },
  ldAdapter: { type: 'SleLDAdapter' },
}

/** rs4274624, the index every row of SLE.ld names, as a 0-based start. */
export const SLE_INDEX_START = 191_958_655

export const SLE_REGION = {
  refName: '2',
  start: 191_700_000,
  end: 192_400_000,
  assemblyName: 'hg19',
}

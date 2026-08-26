import { HtsgetFile } from '@gmod/bam'
import { readConfObject } from '@jbrowse/core/configuration'
import { getFetcher } from '@jbrowse/core/util/io'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import BamSlightlyLazyFeature from '../BamAdapter/BamSlightlyLazyFeature.ts'

import type { HtsgetBamAdapterConfig } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Fetcher } from 'generic-filehandle2'

function originOf(url: string) {
  try {
    return new URL(url).origin
  } catch {
    return undefined
  }
}

/**
 * One fetcher serves both halves of an htsget read, and the two are not equally
 * trusted. The ticket request goes to the configured endpoint; the data-block
 * urls it comes back with can name any host. An internet account's fetcher adds
 * its Authorization header to whatever url it is handed — the location it was
 * built from only decides which token to mint — so passing it straight to
 * HtsgetFile would send the endpoint's credential to a third-party block server.
 *
 * Credential the endpoint's own origin and plain-fetch the rest. A block that
 * needs authorization of its own carries it in the ticket's `headers` field,
 * which @gmod/bam applies either way, and a url that fails to parse is treated
 * as foreign rather than trusted.
 */
export function htsgetFetcher(
  base: string,
  pluginManager?: PluginManager,
): Fetcher {
  const authorized = getFetcher(
    { uri: base, locationType: 'UriLocation' },
    pluginManager,
  )
  const trusted = originOf(base)
  return (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    return trusted !== undefined && originOf(url) === trusted
      ? authorized(input, init)
      : fetch(input, init)
  }
}

export default class HtsgetBamAdapter extends BamAdapter {
  protected configure() {
    if (!this.configureResult) {
      // this.config is BamAdapterConfig at the type level (from the parent),
      // but at runtime it is always HtsgetBamAdapterConfig for this class
      const conf = this.config as unknown as HtsgetBamAdapterConfig
      const htsgetBase = readConfObject(conf, 'htsgetBase')
      this.configureResult = {
        bam: new HtsgetFile<BamSlightlyLazyFeature>({
          baseUrl: htsgetBase,
          trackId: readConfObject(conf, 'htsgetTrackId'),
          recordClass: BamSlightlyLazyFeature,
          fetch: htsgetFetcher(htsgetBase, this.pluginManager),
        }),
      }
    }
    return this.configureResult
  }
}

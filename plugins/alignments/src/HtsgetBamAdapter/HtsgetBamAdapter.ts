import { HtsgetFile } from '@gmod/bam'
import { readConfObject } from '@jbrowse/core/configuration'
import { isUriLocation } from '@jbrowse/core/util'
import { getFetcher, resolveUriLocation } from '@jbrowse/core/util/io'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import BamSlightlyLazyFeature from '../BamAdapter/BamSlightlyLazyFeature.ts'

import type { HtsgetBamAdapterConfig } from './configSchema.ts'

export default class HtsgetBamAdapter extends BamAdapter {
  protected configure() {
    if (!this.configureResult) {
      // this.config is BamAdapterConfig at the type level (from the parent),
      // but at runtime it is always HtsgetBamAdapterConfig for this class
      const conf = this.config as unknown as HtsgetBamAdapterConfig
      const htsgetBase = readConfObject(conf, 'htsgetBase')
      // isUriLocation rather than a truthy check: it rejects both the schema's
      // empty default and a localPath, which htsget has no way to request
      if (!isUriLocation(htsgetBase)) {
        throw new Error('HtsgetBamAdapter requires an htsgetBase url')
      }
      this.configureResult = {
        bam: new HtsgetFile<BamSlightlyLazyFeature>({
          // resolved, because @gmod/bam builds the ticket url by concatenation
          // and has no baseUri of its own to resolve against
          baseUrl: resolveUriLocation(htsgetBase).uri,
          trackId: readConfObject(conf, 'htsgetTrackId'),
          recordClass: BamSlightlyLazyFeature,
          // The ticket request only. The data-block urls a ticket answers with
          // can name any host, and the spec forbids sending the endpoint's
          // credential to them ("HTTPS data block URLs" rule 6) — @gmod/bam 9
          // fetches those itself, applying whatever the ticket's `headers` says
          // that block needs. getFetcher is scoped to the matched account's
          // `domains` besides, so this stays right against a bam-js that hands
          // it a block url anyway.
          fetch: getFetcher(htsgetBase, this.pluginManager),
        }),
      }
    }
    return this.configureResult
  }
}

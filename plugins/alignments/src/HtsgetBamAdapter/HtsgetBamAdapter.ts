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
          // One fetcher serves both halves of an htsget read, and the two are
          // not equally trusted: the ticket request goes to the configured
          // endpoint, and the data-block urls it answers with can name any
          // host. getFetcher scopes the credential to the matched account's own
          // `domains` for exactly this — a block outside them, on this origin or
          // another, is fetched plain. A block needing authorization of its own
          // carries it in the ticket's `headers`, which @gmod/bam applies on the
          // plain path.
          fetch: getFetcher(htsgetBase, this.pluginManager),
        }),
      }
    }
    return this.configureResult
  }
}

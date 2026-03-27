import { openLocation } from '@jbrowse/core/util/io'

import { getSegmentsForOrdinalsFromShard } from '../GfaTabixAdapter/gfaBinaryIO.ts'
import { BaseGfaTabixAdapter } from '../GfaTabixAdapter/gfaTabixUtils.ts'

import type { IndexedBinaryShard } from '../GfaTabixAdapter/gfaBinaryIO.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { FileLocation } from '@jbrowse/core/util/types'

interface SegmentsManifest {
  genomes: string[]
  files: Record<string, string>
}

export default class ShardedGfaTabixAdapter extends BaseGfaTabixAdapter {
  private manifestPromise?: Promise<SegmentsManifest>
  private genomeShardsCache = new Map<string, IndexedBinaryShard>()

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
  }

  private async getManifest() {
    if (!this.manifestPromise) {
      this.manifestPromise = (async () => {
        const manifestLoc = this.getConf(
          'segmentsManifestLocation',
        ) as FileLocation
        const fh = openLocation(manifestLoc, this.pluginManager)
        const buf = await fh.readFile()
        const text = new TextDecoder().decode(buf)
        return JSON.parse(text) as SegmentsManifest
      })()
    }
    return this.manifestPromise
  }

  private getGenomeShard(genome: string, shardPrefix: string) {
    if (!this.genomeShardsCache.has(genome)) {
      const pm = this.pluginManager
      const manifestLoc = this.getConf(
        'segmentsManifestLocation',
      ) as FileLocation

      let baseDir = ''
      if ('localPath' in manifestLoc) {
        baseDir = manifestLoc.localPath.replace(/[^/]*$/, '')
      } else if ('uri' in manifestLoc) {
        baseDir = manifestLoc.uri.replace(/[^/]*$/, '')
      }
      const shardBase = baseDir + shardPrefix

      const makeLocation = (path: string): FileLocation =>
        'localPath' in manifestLoc
          ? { localPath: path, locationType: 'LocalPathLocation' }
          : { uri: path, locationType: 'UriLocation' }

      const shard: IndexedBinaryShard = {
        filehandle: openLocation(makeLocation(`${shardBase}.bin`), pm),
        idxFile: openLocation(makeLocation(`${shardBase}.idx`), pm),
      }
      this.genomeShardsCache.set(genome, shard)
    }
    return this.genomeShardsCache.get(genome)!
  }

  protected async getSegsForOrdinals(ordinalRanges: [number, number][]) {
    const manifest = await this.getManifest()
    const promises = manifest.genomes.map(async genome => {
      const prefix = manifest.files[genome]
      if (prefix) {
        const shard = this.getGenomeShard(genome, prefix)
        return getSegmentsForOrdinalsFromShard(shard, ordinalRanges)
      }
      return []
    })
    const results = await Promise.all(promises)
    return results.flat()
  }
}

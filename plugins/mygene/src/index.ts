/* eslint-disable @typescript-eslint/camelcase */
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

const configSchema = ConfigurationSchema(
  'MyGeneV3Adapter',
  {
    baseUrl: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gff.gz' },
    },
  },
  { explicitlyTyped: true },
)

class AdapterClass extends BaseFeatureDataAdapter {
  private featureCache = new AbortablePromiseCache({
    cache: new QuickLRU({ maxSize: 100 }),
    fill: async args => {
      // @ts-ignore
      return this.readChunk(args)
    },
  })

  public async getRefNames(_: BaseOptions = {}) {
    return []
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const chunkSize = 100000
      const s = query.start - (query.start % chunkSize)
      const e = query.end + (chunkSize - (query.end % chunkSize))
      const chunks = []
      for (let start = s; start < e; start += chunkSize) {
        chunks.push({
          refName: query.refName,
          start,
          end: start + chunkSize,
          assemblyName: query.assemblyName,
        })
      }
      await Promise.all(
        // @ts-ignore
        chunks.map(chunk => {
          return this.featureCache
            .get(
              `${chunk.assemblyName},${chunk.refName},${chunk.start},${chunk.end}`,
              chunk,
              opts.signal,
            )
            .then(features => {
              // @ts-ignore
              features.forEach(feature => {
                if (
                  !(feature.get('start') > query.end) &&
                  feature.get('end') >= query.start
                ) {
                  observer.next(feature)
                }
              })
            })
        }),
      )

      observer.complete()
    }, opts.signal)
  }

  private async readChunk(query: {
    start: number
    end: number
    refName: string
  }) {
    const { start, end, refName } = query
    const ref = refName.startsWith('chr') ? refName : `chr${refName}`
    const url = `https://mygene.info/v3/query?q=hg19.${ref}:${start}-${end}&fields=all&size=1000&email=colin.diesh@gmail.com`

    const hg19 = 1 /// might be config+(this.config.hg19 || 0)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(response.statusText)
    }
    const featureData = await response.json()
    // @ts-ignore
    return featureData.hits.map(feature => {
      const {
        genomic_pos,
        genomic_pos_hg19,
        exons,
        exons_hg19,
        _id,
        _score,
        _license,
        ...rest
      } = feature

      let genomicPos = [genomic_pos, genomic_pos_hg19][hg19]
      if (Array.isArray(genomicPos)) {
        genomicPos = genomicPos.find(pos => {
          return refName.replace('chr', '') === pos.chr
        })
      }

      let transcriptData = [exons, exons_hg19][hg19]
      if (transcriptData) {
        // @ts-ignore
        transcriptData = transcriptData.filter(transcript => {
          return transcript.chr === refName.replace('chr', '')
        })
      }

      return transcriptData
        ? new SimpleFeature({
            id: _id,
            data: {
              ...rest,
              refName: genomicPos.chr,
              start: genomicPos.start,
              end: genomicPos.end,
              strand: genomicPos.strand,
              name: feature.symbol,
              description: feature.name,
              type: 'gene',
              // @ts-ignore
              subfeatures: transcriptData.map(transcript => {
                return {
                  start: transcript.txstart,
                  end: transcript.txend,
                  name: transcript.transcript,
                  strand: transcript.strand,
                  type: 'mRNA',
                  // @ts-ignore
                  subfeatures: transcript.position.map(pos => ({
                    start: pos[0],
                    end: pos[1],
                    strand: transcript.strand,
                    type: 'exon',
                  })),
                }
              }),
            },
          })
        : new SimpleFeature({
            id: _id,
            data: {
              ...rest,
              refName: genomicPos.chr,
              start: genomicPos.start,
              end: genomicPos.end,
              strand: genomicPos.strand,
              name: feature.symbol,
              description: feature.name,
              type: 'gene',
              subfeatures: [
                {
                  type: 'mRNA',
                  start: genomicPos.start,
                  end: genomicPos.end,
                  strand: genomicPos.strand,
                },
              ],
            },
          })
    })
  }

  public freeResources(/* { region } */) {}
}

export default class extends Plugin {
  name = 'MyGeneAdapter'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'MyGeneV3Adapter',
          configSchema,
          AdapterClass,
        }),
    )
  }
}

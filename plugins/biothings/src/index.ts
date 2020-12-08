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
import {
  readConfObject,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

const configSchema = ConfigurationSchema(
  'MyGeneV3Adapter',
  {
    baseUrl: {
      type: 'string',
      defaultValue:
        // eslint-disable-next-line no-template-curly-in-string
        'https://mygene.info/v3/query?q=${ref}:${start}-${end}&size=1000&fields=all&size=1000&species=human',
    },
  },
  { explicitlyTyped: true },
)

// translate thickStart/thickEnd to utr's
// adapted from BigBedAdapter for ucsc thickStart/thickEnd
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cdsStartEndProcessor(feature: any) {
  // split the blocks into UTR, CDS, and exons
  const { thickStart, thickEnd, strand, subfeatures: children } = feature

  if (!thickStart && !thickEnd) {
    return feature
  }

  const blocks = children
    ? children.sort(
        (a: { start: number }, b: { start: number }) => a.start - b.start,
      )
    : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newChildren: Record<string, any> = []
  blocks.forEach((block: { start: number; end: number }) => {
    const { start, end } = block
    if (thickStart >= end) {
      // left-side UTR
      const prime = strand > 0 ? 'five' : 'three'
      newChildren.push({
        type: `${prime}_prime_UTR`,
        start,
        end,
      })
    } else if (thickStart > start && thickStart < end && thickEnd >= end) {
      // UTR | CDS
      const prime = strand > 0 ? 'five' : 'three'
      newChildren.push(
        {
          type: `${prime}_prime_UTR`,
          start,
          end: thickStart,
        },
        {
          type: 'CDS',
          start: thickStart,
          end,
        },
      )
    } else if (thickStart <= start && thickEnd >= end) {
      // CDS
      newChildren.push({
        type: 'CDS',
        start,
        end,
      })
    } else if (thickStart > start && thickStart < end && thickEnd < end) {
      // UTR | CDS | UTR
      const leftPrime = strand > 0 ? 'five' : 'three'
      const rightPrime = strand > 0 ? 'three' : 'five'
      newChildren.push(
        {
          type: `${leftPrime}_prime_UTR`,
          start,
          end: thickStart,
        },
        {
          type: `CDS`,
          start: thickStart,
          end: thickEnd,
        },
        {
          type: `${rightPrime}_prime_UTR`,
          start: thickEnd,
          end,
        },
      )
    } else if (thickStart <= start && thickEnd > start && thickEnd < end) {
      // CDS | UTR
      const prime = strand > 0 ? 'three' : 'five'
      newChildren.push(
        {
          type: `CDS`,
          start,
          end: thickEnd,
        },
        {
          type: `${prime}_prime_UTR`,
          start: thickEnd,
          end,
        },
      )
    } else if (thickEnd <= start) {
      // right-side UTR
      const prime = strand > 0 ? 'three' : 'five'
      newChildren.push({
        type: `${prime}_prime_UTR`,
        start,
        end,
      })
    }
  })
  return { ...feature, subfeatures: newChildren, type: 'mRNA' }
}

// random notes for possible email to team: cdk11a/cdk11b return pretty bad data
// for their transcripts, so they are filtered out
class AdapterClass extends BaseFeatureDataAdapter {
  private featureCache = new AbortablePromiseCache({
    cache: new QuickLRU({ maxSize: 100 }),
    fill: async args => {
      // @ts-ignore
      return this.readChunk(args)
    },
  })

  private config: AnyConfigurationModel

  constructor(config: AnyConfigurationModel) {
    super(config)
    this.config = config
  }

  public async getRefNames(_: BaseOptions = {}) {
    return []
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    const baseUrl = readConfObject(this.config, 'baseUrl')
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
          baseUrl,
        })
      }
      await Promise.all(
        // @ts-ignore
        chunks.map(async chunk => {
          const features = await this.featureCache.get(
            `${chunk.assemblyName},${chunk.refName},${chunk.start},${chunk.end}`,
            chunk,
            opts.signal,
          )
          // @ts-ignore
          features.forEach(feature => {
            if (
              feature &&
              !(feature.get('start') > query.end) &&
              feature.get('end') >= query.start
            ) {
              observer.next(feature)
            }
          })
        }),
      )

      observer.complete()
    }, opts.signal)
  }

  private interpolate(str: string, params: Record<string, string | number>) {
    const names = Object.keys(params)
    const vals = Object.values(params)
    // eslint-disable-next-line @typescript-eslint/no-implied-eval,no-new-func
    return new Function(...names, `return \`${str}\`;`)(...vals)
  }

  private async readChunk(chunk: {
    start: number
    end: number
    refName: string
    baseUrl: string
  }) {
    const { start, end, refName, baseUrl } = chunk
    const ref = refName.startsWith('chr') ? refName : `chr${refName}`
    const url = this.interpolate(baseUrl, { ref, start, end })

    const hg19 = Number(baseUrl.includes('hg19'))
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

      if (!transcriptData) {
        return new SimpleFeature({
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
          },
        })
      }

      // this is a weird hack because mygene.info returns features on other
      // chromosomes that are close homologues, and the homologues aren't even
      // clear on whether they are located on the chromosome you are querying
      // on because it returns a set of locations of all the other homologues,
      // so this tries to filter those out
      if (
        feature.map_location &&
        !feature.map_location.match(`^${genomicPos.chr}(p|q)`)
      ) {
        return null
      }

      if (transcriptData) {
        // @ts-ignore
        transcriptData = transcriptData.filter(transcript => {
          return feature.map_location?.startsWith(transcript.chr)
        })
      }

      if (transcriptData && transcriptData.length) {
        const transcripts = transcriptData
          // @ts-ignore
          .map((transcript, index) => {
            return {
              start: transcript.txstart,
              end: transcript.txend,
              name: transcript.transcript,
              strand: transcript.strand,
              thickStart: transcript.cdsstart,
              thickEnd: transcript.cdsend,
              // @ts-ignore
              subfeatures: transcript.position.map(pos => ({
                start: pos[0],
                end: pos[1],
                strand: transcript.strand,
                type: 'exon',
              })),
            }
          })
          // @ts-ignore
          .filter(t => {
            // another weird filter to avoid transcripts that are outside the
            // range of the genomic pos. the +/-1000 added for ATAD3C, SKI2, MEGF6
            return (
              t.start >= genomicPos.start - 2000 &&
              t.end <= genomicPos.end + 2000
            )
          })
          // @ts-ignore
          .map(feat => {
            return feature.type_of_gene === 'protein-coding'
              ? cdsStartEndProcessor(feat)
              : feat
          })

        // maybe worth reviewing but SvgFeatureRenderer has very bad behavior
        // if subfeatures go outside of the bounds of the parent feature so
        // this is needed
        const [min, max] = [
          // @ts-ignore
          Math.min(...[genomicPos.start, ...transcripts.map(t => t.start)]),
          // @ts-ignore
          Math.max(...[genomicPos.end, ...transcripts.map(t => t.end)]),
        ]

        return new SimpleFeature({
          id: _id,
          data: {
            ...rest,
            refName: genomicPos.chr,
            start: min,
            end: max,
            strand: genomicPos.strand,
            name: feature.symbol,
            description: feature.name,
            type: 'gene',
            subfeatures: transcripts,
          },
        })
      }
      return null
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

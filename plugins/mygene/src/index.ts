import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from '@jbrowse/core/util/QuickLRU'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

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
    fill: async args => this.readChunk(key),
  })

  public async getRefNames(opts: BaseOptions = {}) {
    return []
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = query

      query.toString = () => `${refName},${start},${end}`
      const chunkSize = 100000
      const s = query.start - (query.start % chunkSize)
      const e = query.end + (chunkSize - (query.end % chunkSize))
      const chunks = []
      let chunksProcessed = 0
      let haveError = false
      for (let start = s; start < e; start += chunkSize) {
        const chunk = { ref: query.ref, start, end: start + chunkSize }
        chunk.toString = () => `${refName},${start},${end}`
        chunks.push(chunk)
      }
      chunks.forEach(c => {
        this.featureCache.get(c, (f, err) => {
          if (err && !haveError) {
            observer.error(err)
          }
          haveError = haveError || err
          if (haveError) {
            return
          }
          f.forEach(feature => {
            if (feature.get('start') > query.end) {
            } else if (feature.get('end') >= query.start) {
              observer.next(feature)
            }
          })
          if (++chunksProcessed == chunks.length) {
            observer.complete()
          }
        })
      })
    }, opts.signal)
  }

  private async readChunk(query) {
    const { start, end, refName } = query
    const url = `https://mygene.info/v3/query?q=hg19.${refName}:${start}-${end}&fields=all&size=1000&email=colin.diesh@gmail.com`

    const hg19 = 1 /// might be config+(this.config.hg19 || 0)
    const feats = []
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(response.statusText)
    }
    const featuredata = await response.json()

    featuredata.hits.forEach(f => {
      let genomic_pos = [f.genomic_pos, f.genomic_pos_hg19][hg19]
      const exons = [f.exons, f.exons_hg19][hg19]
      if (Array.isArray(genomic_pos)) {
        genomic_pos = genomic_pos[0]
      }
      // if (f.exac) {
      //   f.exac_nontcga = f.exac.nontcga
      //   f.exac_nonpsych = f.exac.nonpsych
      //   f.exac_all = f.exac.all
      //   delete f.exac
      // }
      // if (f.reagent) {
      //   Object.keys(f.reagent).forEach(key => {
      //     f[`reagent_${key}`] = f.reagent[key]
      //   })
      //   delete f.reagent
      // }
      // if (f.reporter) {
      //   Object.keys(f.reporter).forEach(key => {
      //     f[`reporter_${key}`] = f.reporter[key]
      //   })
      //   delete f.reporter
      // }

      const { exons: trash, exons_hg19, ...rest } = f
      const superfeat = new SimpleFeature({
        id: f._id,
        data: {
          ...rest,
          start: genomic_pos.start,
          end: genomic_pos.end,
          strand: genomic_pos.strand,
          name: f.symbol,
          description: f.name,
          type: 'gene',
          subfeatures: [],
        },
      })
      // if (!exons) {
      //   const feature = new SimpleFeature({
      //     id: `${f._id}-transcript`,
      //     data: {
      //       start: genomic_pos.start,
      //       end: genomic_pos.end,
      //       strand: genomic_pos.strand,
      //       type: 'mRNA',
      //       name: `${f.name}-transcript`,
      //       subfeatures: [],
      //     },
      //     parent: superfeat,
      //   })
      //   superfeat.data.subfeatures.push(feature)
      // }
      // const transcripts = {}
      // if (exons) {
      //   const transcripts = exons.map(exon => {
      //     const tname = exon.transcript
      //     const ts = {
      //       start: exon.txstart,
      //       end: exon.txend,
      //       strand: exon.strand,
      //       type: 'mRNA',
      //       name: tname,
      //       subfeatures: [],
      //     }
      //     const exons = exon.position.map(pos => {
      //       return {
      //         data: {
      //           ...exon,
      //           start: pos[0],
      //           end: pos[1],
      //           strand: genomic_pos.strand,
      //           position: null,
      //           txstart: null,
      //           txend: null,
      //           transcript: null,
      //           type: 'exon',
      //         },
      //         parent: ts,
      //       }
      //     })
      //   })
      // }
      feats.push(superfeat)
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

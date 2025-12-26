import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { MismatchParser } from '@jbrowse/plugin-alignments'

import SyntenyFeature from '../SyntenyFeature'
import { flipCigar, parsePAFLine, swapIndelCigar } from '../util'

const { parseCigar } = MismatchParser

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { FileLocation, Region } from '@jbrowse/core/util/types'

interface PAFOptions extends BaseOptions {
  config?: AnyConfigurationModel
}

export default class PAFAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected pif: TabixIndexedFile

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pifGzLoc = this.getConf('pifGzLocation') as FileLocation
    const type = this.getConf(['index', 'indexType'])
    const loc = this.getConf(['index', 'location'])
    const pm = this.pluginManager

    this.pif = new TabixIndexedFile({
      filehandle: openLocation(pifGzLoc, pm),
      csiFilehandle: type === 'CSI' ? openLocation(loc, pm) : undefined,
      tbiFilehandle: type !== 'CSI' ? openLocation(loc, pm) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })
  }
  async getHeader(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    return updateStatus('Downloading header', statusCallback, () =>
      this.pif.getHeader(),
    )
  }

  getAssemblyNames(): string[] {
    const assemblyNames = this.getConf('assemblyNames') as string[]
    return assemblyNames.length === 0
      ? [
          this.getConf('queryAssembly') as string,
          this.getConf('targetAssembly') as string,
        ]
      : assemblyNames
  }

  public async hasDataForRefName() {
    return true
  }

  async getRefNames(opts: BaseOptions & { regions?: Region[] } = {}) {
    const r1 = opts.regions?.[0]?.assemblyName
    if (!r1) {
      throw new Error('no assembly name provided')
    }

    const idx = this.getAssemblyNames().indexOf(r1)
    const names = await this.pif.getReferenceSequenceNames(opts)
    if (idx === 0) {
      return names.filter(n => n.startsWith('q')).map(n => n.slice(1))
    } else if (idx === 1) {
      return names.filter(n => n.startsWith('t')).map(n => n.slice(1))
    } else {
      return []
    }
  }

  getFeatures(query: Region, opts: PAFOptions = {}) {
    const { statusCallback = () => {} } = opts
    return ObservableCreate<Feature>(async observer => {
      const { assemblyName } = query

      const assemblyNames = this.getAssemblyNames()
      const index = assemblyNames.indexOf(assemblyName)
      const flip = index === 0
      const letter = flip ? 'q' : 't'

      await updateStatus('Downloading features', statusCallback, () =>
        this.pif.getLines(letter + query.refName, query.start, query.end, {
          lineCallback: (line, fileOffset) => {
            const r = parsePAFLine(line)
            const { extra, strand } = r
            const { numMatches = 0, blockLen = 1, cg, ...rest } = extra

            // Strip 'q'/'t' prefix from names in the indexed format
            const qname = r.qname.slice(1)
            const tname = r.tname.slice(1)

            let start: number
            let end: number
            let refName: string
            let mateName: string
            let mateStart: number
            let mateEnd: number

            if (flip) {
              start = r.qstart
              end = r.qend
              refName = qname
              mateName = tname
              mateStart = r.tstart
              mateEnd = r.tend
            } else {
              start = r.tstart
              end = r.tend
              refName = tname
              mateName = qname
              mateStart = r.qstart
              mateEnd = r.qend
            }

            let CIGAR = extra.cg
            if (extra.cg) {
              if (flip && strand === -1) {
                CIGAR = flipCigar(parseCigar(extra.cg)).join('')
              } else if (flip) {
                CIGAR = swapIndelCigar(extra.cg)
              }
            }

            observer.next(
              new SyntenyFeature({
                uniqueId: fileOffset + assemblyName,
                assemblyName,
                start,
                end,
                type: 'match',
                refName,
                strand,
                ...rest,
                CIGAR,
                syntenyId: fileOffset,
                identity: numMatches / blockLen,
                numMatches,
                blockLen,
                mate: {
                  start: mateStart,
                  end: mateEnd,
                  refName: mateName,
                  assemblyName: assemblyNames[+flip],
                },
              }),
            )
          },
          stopToken: opts.stopToken,
        }),
      )

      observer.complete()
    })
  }
}

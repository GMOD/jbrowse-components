import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { FileLocation, Region } from '@jbrowse/core/util/types'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { Feature } from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import PluginManager from '@jbrowse/core/PluginManager'
import { openLocation } from '@jbrowse/core/util/io'
import { TabixIndexedFile } from '@gmod/tabix'

// locals
import { parsePAFLine } from '../util'
import SyntenyFeature from '../SyntenyFeature'

interface PAFOptions extends BaseOptions {
  config?: AnyConfigurationModel
}

export default class PAFAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected ppaf: TabixIndexedFile

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const ppafGzLoc = this.getConf('ppafGzLocation') as FileLocation
    const type = this.getConf(['index', 'indexType'])
    const loc = this.getConf(['index', 'location'])
    const pm = this.pluginManager

    this.ppaf = new TabixIndexedFile({
      filehandle: openLocation(ppafGzLoc, pm),
      csiFilehandle: type === 'CSI' ? openLocation(loc, pm) : undefined,
      tbiFilehandle: type !== 'CSI' ? openLocation(loc, pm) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })
  }
  async getHeader() {
    return this.ppaf.getHeader()
  }

  getAssemblyNames(): string[] {
    const assemblyNames = this.getConf('assemblyNames') as string[]
    if (assemblyNames.length === 0) {
      return [
        this.getConf('queryAssembly') as string,
        this.getConf('targetAssembly') as string,
      ]
    }
    return assemblyNames
  }

  public async hasDataForRefName() {
    return true
  }

  async getRefNames(opts: BaseOptions & { regions?: Region[] } = {}) {
    const r1 = opts.regions?.[0].assemblyName
    if (!r1) {
      throw new Error('no assembly name provided')
    }

    const idx = this.getAssemblyNames().indexOf(r1)
    const names = await this.ppaf.getReferenceSequenceNames(opts)
    if (idx === 0) {
      return names.filter(n => n.startsWith('q')).map(n => n.slice(1))
    } else if (idx === 1) {
      return names.filter(n => n.startsWith('t')).map(n => n.slice(1))
    }
    return []
  }

  getFeatures(query: Region, opts: PAFOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { assemblyName } = query

      const assemblyNames = this.getAssemblyNames()
      const index = assemblyNames.indexOf(assemblyName)
      const flip = index === 0
      const letter = flip ? 'q' : 't'

      await this.ppaf.getLines(letter + query.refName, query.start, query.end, {
        lineCallback: (line, fileOffset) => {
          const r = parsePAFLine(line)
          const refName = r.qname.slice(1)
          const start = r.qstart
          const end = r.qend
          const mateName = r.tname
          const mateStart = r.tstart
          const mateEnd = r.tend

          const { extra, strand } = r
          const { numMatches = 0, blockLen = 1, cg, ...rest } = extra

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
              CIGAR: extra.cg,
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
        signal: opts.signal,
      })

      observer.complete()
    })
  }

  freeResources(/* { query } */): void {}
}

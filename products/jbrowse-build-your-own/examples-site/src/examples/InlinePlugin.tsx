import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import {
  EmbedProvider,
  Legend,
  LocationBox,
  Toolbar,
  TrackStack,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

interface Gene {
  id: string
  start: number
  end: number
  strand: number
  name: string
  biotype: string
}

type GenesByRefName = Record<string, Gene[]>

async function getJson<T>(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`)
  }
  return (await response.json()) as T
}

const configSchema = ConfigurationSchema(
  'GeneListAdapter',
  {
    uri: {
      type: 'string',
      defaultValue: 'https://jbrowse.org/demos/inline_plugin/genes.json',
    },
  },
  { explicitlyTyped: true },
)

class GeneListAdapter extends BaseFeatureDataAdapter {
  private genes?: Promise<GenesByRefName>

  private loadGenes() {
    this.genes ??= getJson<GenesByRefName>(this.getConf('uri')).catch(
      (error: unknown) => {
        this.genes = undefined
        throw error
      },
    )
    return this.genes
  }

  async getRefNames() {
    return Object.keys(await this.loadGenes())
  }

  getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = region
      const genes = (await this.loadGenes())[refName] ?? []
      for (const gene of genes) {
        if (gene.start < end && gene.end > start) {
          observer.next(
            new SimpleFeature({
              uniqueId: `${this.id}-${gene.id}`,
              refName,
              start: gene.start,
              end: gene.end,
              strand: gene.strand,
              type: 'gene',
              name: gene.name,
              biotype: gene.biotype,
            }),
          )
        }
      }
      observer.complete()
    }, opts?.signal)
  }
}

class GeneListPlugin extends Plugin {
  name = 'GeneListPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'GeneListAdapter',
          configSchema,
          AdapterClass: GeneListAdapter,
        }),
    )
  }
}

const InlinePlugin = observer(function InlinePlugin() {
  const state = useCreateViewState({
    plugins: [GeneListPlugin],
    assembly: {
      name: 'hg38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
    },
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'gencode_genes',
        name: 'GENCODE genes',
        assemblyNames: ['hg38'],
        adapter: {
          type: 'GeneListAdapter',
          uri: 'https://jbrowse.org/demos/inline_plugin/genes.json',
        },
        displays: [
          {
            type: 'LinearBasicDisplay',
            displayId: 'gencode_genes-LinearBasicDisplay',
            height: 160,
            encoding: { color: 'biotype' },
            legend: { show: false },
          },
        ],
      },
    ],
    view: {
      loc: 'chr17:42,950,000..43,250,000',
      tracks: ['gencode_genes'],
    },
  })
  if (!state) {
    return null
  }
  const { view } = state.session
  return (
    <EmbedProvider session={state.session}>
      <Toolbar>
        <LocationBox view={view} />
        <Legend view={view} trackId="gencode_genes" />
      </Toolbar>
      <TrackStack view={view} />
    </EmbedProvider>
  )
})

export default InlinePlugin

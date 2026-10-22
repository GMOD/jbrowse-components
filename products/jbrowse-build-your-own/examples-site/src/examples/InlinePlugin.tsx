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

const ensembl = 'https://rest.ensembl.org'
const MAX_SPAN = 5_000_000

interface EnsemblGene {
  id: string
  start: number
  end: number
  strand: number
  biotype: string
  external_name?: string
  description?: string
}

async function getJson<T>(path: string, signal?: AbortSignal) {
  const url = new URL(path, ensembl)
  url.searchParams.set('content-type', 'application/json')
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Ensembl answered ${response.status} for ${url}`)
  }
  return (await response.json()) as T
}

const configSchema = ConfigurationSchema(
  'EnsemblGenesAdapter',
  { species: { type: 'string', defaultValue: 'homo_sapiens' } },
  { explicitlyTyped: true },
)

class EnsemblGenesAdapter extends BaseFeatureDataAdapter {
  async getRefNames(opts?: BaseOptions) {
    const species = this.getConf('species') as string
    const { karyotype } = await getJson<{ karyotype: string[] }>(
      `/info/assembly/${species}`,
      opts?.signal,
    )
    return karyotype
  }

  getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = region
      if (end - start > MAX_SPAN) {
        throw Object.assign(
          new Error('Ensembl serves 5 Mb at a time; zoom in to see genes'),
          { regionTooLarge: true },
        )
      }
      const species = this.getConf('species') as string
      const genes = await getJson<EnsemblGene[]>(
        `/overlap/region/${species}/${refName}:${start + 1}-${end}?feature=gene`,
        opts?.signal,
      )
      for (const gene of genes) {
        observer.next(
          new SimpleFeature({
            uniqueId: `${this.id}-${gene.id}`,
            refName,
            start: gene.start - 1,
            end: gene.end,
            strand: gene.strand,
            type: 'gene',
            name: gene.external_name ?? gene.id,
            biotype: gene.biotype,
            description: gene.description,
          }),
        )
      }
      observer.complete()
    }, opts?.signal)
  }
}

class EnsemblPlugin extends Plugin {
  name = 'EnsemblPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'EnsemblGenesAdapter',
          configSchema,
          AdapterClass: EnsemblGenesAdapter,
        }),
    )
  }
}

const InlinePlugin = observer(function InlinePlugin() {
  const state = useCreateViewState({
    plugins: [EnsemblPlugin],
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
        trackId: 'ensembl_genes',
        name: 'Ensembl genes',
        assemblyNames: ['hg38'],
        adapter: { type: 'EnsemblGenesAdapter' },
        displays: [
          {
            type: 'LinearBasicDisplay',
            displayId: 'ensembl_genes-LinearBasicDisplay',
            height: 160,
            // skips the density probe, which samples the server window by window
            forceLoad: true,
            encoding: { color: 'biotype' },
            legend: { show: false },
          },
        ],
      },
    ],
    view: {
      loc: 'chr17:42,950,000..43,250,000',
      tracks: ['ensembl_genes'],
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
        <Legend view={view} trackId="ensembl_genes" />
      </Toolbar>
      <TrackStack view={view} />
    </EmbedProvider>
  )
})

export default InlinePlugin

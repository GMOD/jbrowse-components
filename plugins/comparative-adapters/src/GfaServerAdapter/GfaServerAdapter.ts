import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import SyntenyFeature from '../SyntenyFeature/index.ts'

import type { MultiPairFeature } from '../MultiPairFeature.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Region } from '@jbrowse/core/util/types'

interface ServerSetup {
  id: string
  paths: {
    name: string
    length: number
    genome: string
    refName: string
    subwalkStart: number
    subwalkEnd: number
  }[]
  assemblies: string[]
  chromSizes: { genome: string; refName: string; length: number }[]
}

interface ServerSyntenyResponse {
  features: {
    queryGenome: string
    origRefName: string
    start: number
    end: number
    mateStart: number
    mateEnd: number
    mateRefName: string
    strand: 1 | -1
    identity: number
    featureId: string
    cs?: string
  }[]
}

interface SubgraphOpts {
  context?: number
}

export default class GfaServerAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  private readonly assemblyNameMap: Record<string, string>
  private readonly reverseAssemblyNameMap: Map<string, string>
  private setupP?: Promise<ServerSetup>

  public constructor(
    ...args: ConstructorParameters<typeof BaseFeatureDataAdapter>
  ) {
    super(...args)
    this.assemblyNameMap = (this.getConf('assemblyNameMap') ?? {}) as Record<
      string,
      string
    >
    this.reverseAssemblyNameMap = new Map(
      Object.entries(this.assemblyNameMap).map(([file, display]) => [
        display,
        file,
      ]),
    )
  }

  private get baseUrl(): string {
    const url = this.getConf('serverUrl') as string
    return url.replace(/\/+$/, '')
  }

  private get datasetId(): string {
    return this.getConf('datasetId') as string
  }

  private get apiBase(): string {
    return `${this.baseUrl}/api/v0/datasets/${this.datasetId}`
  }

  private async setup(): Promise<ServerSetup> {
    this.setupP ??= fetch(`${this.apiBase}/setup`)
      .then(async r => {
        if (!r.ok) {
          throw new Error(
            `[GfaServerAdapter] /setup ${r.status} ${await r.text()}`,
          )
        }
        return r.json() as Promise<ServerSetup>
      })
      .catch((err: unknown) => {
        this.setupP = undefined
        throw err
      })
    return this.setupP
  }

  private remapGenome(genome: string) {
    return this.assemblyNameMap[genome] ?? genome
  }

  private toServerGenome(assemblyName: string): string {
    return this.reverseAssemblyNameMap.get(assemblyName) ?? assemblyName
  }

  getAssemblyNames() {
    return [] as string[]
  }

  async getAssemblyNamesFromHeader() {
    const { assemblies } = await this.setup()
    return assemblies.map(g => this.remapGenome(g))
  }

  async getChromSizes() {
    const { chromSizes } = await this.setup()
    const out = new Map<string, { refName: string; length: number }[]>()
    for (const { genome, refName, length } of chromSizes) {
      const display = this.remapGenome(genome)
      let arr = out.get(display)
      if (!arr) {
        arr = []
        out.set(display, arr)
      }
      arr.push({ refName, length })
    }
    return out
  }

  async hasDataForRefName() {
    return true
  }

  async getRefNames() {
    return []
  }

  async getSources() {
    const { assemblies } = await this.setup()
    return assemblies.map(g => ({ name: this.remapGenome(g) }))
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const result = await this.getMultiPairFeatures(query, opts)
      const { assemblyName } = query
      for (const [queryGenome, features] of result.genomeRows) {
        for (const feat of features) {
          observer.next(
            new SyntenyFeature({
              uniqueId: `${feat.featureId}-${assemblyName}`,
              assemblyName,
              start: feat.start,
              end: feat.end,
              type: 'match',
              refName: query.refName,
              strand: feat.strand,
              syntenyId: +feat.featureId,
              identity: feat.identity,
              numMatches: 0,
              blockLen: 0,
              mate: {
                start: feat.mateStart,
                end: feat.mateEnd,
                refName: feat.mateRefName,
                assemblyName: queryGenome,
              },
            }),
          )
        }
      }
      observer.complete()
    })
  }

  async getMultiPairFeatures(
    query: Region,
    opts: { bpPerPx?: number; stopToken?: StopToken } = {},
  ) {
    checkStopToken(opts.stopToken)
    const body = JSON.stringify({
      refName: query.refName,
      start: Math.floor(query.start),
      end: Math.ceil(query.end),
      genome: this.toServerGenome(query.assemblyName),
    })
    const r = await fetch(`${this.apiBase}/synteny`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
    if (!r.ok) {
      throw new Error(
        `[GfaServerAdapter] /synteny ${r.status} ${await r.text()}`,
      )
    }
    checkStopToken(opts.stopToken)
    const { features } = (await r.json()) as ServerSyntenyResponse

    const genomeRows = new Map<string, MultiPairFeature[]>()
    for (const f of features) {
      const queryGenome = this.remapGenome(f.queryGenome)
      const feat: MultiPairFeature = {
        queryGenome,
        origRefName: query.refName,
        start: f.start,
        end: f.end,
        mateStart: f.mateStart,
        mateEnd: f.mateEnd,
        mateRefName: f.mateRefName,
        strand: f.strand,
        syriType: undefined,
        identity: f.identity,
        featureId: f.featureId,
        segmentId: undefined,
        cigar: undefined,
        cs: f.cs,
      }
      let arr = genomeRows.get(queryGenome)
      if (!arr) {
        arr = []
        genomeRows.set(queryGenome, arr)
      }
      arr.push(feat)
    }

    return { genomeRows }
  }

  async getSubgraph(region: Region, opts: SubgraphOpts = {}) {
    const body = JSON.stringify({
      refName: region.refName,
      start: Math.floor(region.start),
      end: Math.ceil(region.end),
      genome: this.toServerGenome(region.assemblyName),
      context: opts.context,
    })
    const r = await fetch(`${this.apiBase}/subgraph`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
    if (!r.ok) {
      throw new Error(
        `[GfaServerAdapter] /subgraph ${r.status} ${await r.text()}`,
      )
    }
    return r.text()
  }
}

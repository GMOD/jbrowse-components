import { BigBed } from '@gmod/bbi'
import Trix from '@gmod/trix'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { openLocation } from '@jbrowse/core/util/io'

import type { BigBedTextSearchAdapterConfig } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { FileLocation } from '@jbrowse/core/util/types'

// each name a query resolves costs a walk of the BigBed's B+ tree, so a query
// resolves every name its exact word carries up to the first cap, and one name
// for each of the first few words it only prefixes
const MAX_EXACT_NAMES = 50
const MAX_PREFIX_WORDS = 10
const MAX_TRIX_HITS = 500

interface Hit {
  label: string
  refName: string
  start: number
  end: number
}

function isSet(location: FileLocation) {
  return 'uri' in location
    ? !!location.uri
    : 'localPath' in location
      ? !!location.localPath
      : true
}

// the column that matched is the name the hit goes by: a gene symbol for a
// search by symbol, the accession for a search by accession
function hitFor(
  {
    refName,
    start,
    end,
    rest = '',
  }: Awaited<ReturnType<BigBed['searchExtraIndex']>>[number],
  word: string,
): Hit | undefined {
  const fields = rest.split('\t')
  const label = fields.find(f => f.toLowerCase() === word) ?? fields[0]
  return refName && label ? { label, refName, start, end } : undefined
}

// Transcripts sharing the name that matched and overlapping on one sequence
// are one gene, the rule BigBedAdapter draws them by, so a search for a gene
// lands on the gene rather than asking which of its transcripts
export function mergeTranscripts(hits: Hit[]) {
  const merged: Hit[] = []
  const sorted = hits.toSorted(
    (a, b) =>
      a.label.localeCompare(b.label) ||
      a.refName.localeCompare(b.refName) ||
      a.start - b.start,
  )
  for (const hit of sorted) {
    const last = merged.at(-1)
    if (
      last?.label === hit.label &&
      last.refName === hit.refName &&
      hit.start <= last.end
    ) {
      last.end = Math.max(last.end, hit.end)
    } else {
      merged.push({ ...hit })
    }
  }
  return merged
}

export default class BigBedTextSearchAdapter
  extends BaseAdapter<BigBedTextSearchAdapterConfig>
  implements BaseTextSearchAdapter
{
  bigbed: BigBed

  trix?: Trix

  constructor(
    config: BigBedTextSearchAdapterConfig,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    this.bigbed = new BigBed({
      filehandle: openLocation(this.getConf('bigBedLocation'), pluginManager),
    })
    const ix = this.getConf('ixFilePath')
    const ixx = this.getConf('ixxFilePath')
    if (isSet(ix) && isSet(ixx)) {
      this.trix = new Trix(
        openLocation(ixx, pluginManager),
        openLocation(ix, pluginManager),
        MAX_TRIX_HITS,
      )
    }
  }

  // The names to look up: the query as spelled, which the extra index answers
  // however the trix split it into words (GenArk's drops an accession's
  // version), then the names the trix finds for its word
  async names(query: string, exactOnly: boolean, signal?: AbortSignal) {
    const word = query.toLowerCase()
    if (!this.trix) {
      return { exact: [query], prefixed: [] }
    }
    const byWord = new Map<string, string[]>()
    for (const [term, name] of await this.trix.search(word, { signal })) {
      const names = byWord.get(term)
      if (names) {
        names.push(name)
      } else {
        byWord.set(term, [name])
      }
    }
    return {
      exact: [...new Set([query, ...(byWord.get(word) ?? [])])].slice(
        0,
        MAX_EXACT_NAMES,
      ),
      prefixed: exactOnly
        ? []
        : [...byWord]
            .filter(([term]) => term !== word)
            .slice(0, MAX_PREFIX_WORDS)
            .map(([term, names]) => [term, names[0]!] as const),
    }
  }

  async lookUp(name: string, word: string, signal?: AbortSignal) {
    return (await this.bigbed.searchExtraIndex(name, { signal }))
      .map(f => hitFor(f, word))
      .filter(h => h !== undefined)
  }

  async searchIndex({ queryString, searchType, signal }: BaseTextSearchArgs) {
    const query = queryString.trim()
    const word = query.toLowerCase()
    const { exact, prefixed } = await this.names(
      query,
      searchType === 'exact',
      signal,
    )
    const [exactHits, prefixHits] = await Promise.all([
      Promise.all(exact.map(name => this.lookUp(name, word, signal))),
      Promise.all(
        prefixed.map(([term, name]) => this.lookUp(name, term, signal)),
      ),
    ])
    checkAbortSignal(signal)
    const located = mergeTranscripts(exactHits.flat()).map(
      ({ label, refName, start, end }) =>
        new BaseResult({
          label,
          locString: `${refName}:${start + 1}..${end}`,
          exact: true,
        }),
    )
    // a word the query only prefixes is offered by name alone: picking it
    // searches that name exactly, which resolves every one of its transcripts
    const named = [...new Set(prefixHits.flat().map(h => h.label))].map(
      label => new BaseResult({ label }),
    )
    return [...located, ...named]
  }
}

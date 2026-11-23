import { HOSTED_HINT, fetchJson, genomeConfigUrl } from '@jbrowse/launch-args'

import { isRecord } from '../../utils.ts'

import type { Assembly } from '../../base.ts'

function isAssembly(value: unknown): value is Assembly {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    isRecord(value.sequence)
  )
}

function resolveRelativeUris(node: unknown, base: string) {
  if (Array.isArray(node)) {
    for (const item of node) {
      resolveRelativeUris(item, base)
    }
  } else if (isRecord(node)) {
    for (const [key, value] of Object.entries(node)) {
      if (
        (key === 'uri' || key === 'chromSizes') &&
        typeof value === 'string'
      ) {
        node[key] = new URL(value, base).href
      } else if (key !== 'metadata') {
        resolveRelativeUris(value, base)
      }
    }
  }
}

const sequenceFileFlags = [
  'load',
  'type',
  'faiLocation',
  'gziLocation',
] as const

export function validateHostedFlags({
  genome,
  sequence,
  flags,
}: {
  genome: string
  sequence?: string
  flags: Partial<Record<(typeof sequenceFileFlags)[number], unknown>>
}) {
  const fileFlags = sequenceFileFlags.filter(f => flags[f] !== undefined)
  if (sequence !== undefined) {
    throw new Error(
      `--genome ${genome} takes no sequence argument, but got "${sequence}"`,
    )
  } else if (fileFlags.length > 0) {
    throw new Error(
      `${fileFlags.map(f => `--${f}`).join(', ')} does not apply to --genome: the hosted assembly has no sequence file to place or index`,
    )
  }
}

export async function getHostedAssembly(genome: string) {
  const url = genomeConfigUrl(genome)
  const hub = await fetchJson(url, `genome "${genome}"`, HOSTED_HINT)
  const assemblies =
    isRecord(hub) && Array.isArray(hub.assemblies) ? hub.assemblies : []
  const assembly = assemblies.find(a => isRecord(a) && a.name === genome)
  resolveRelativeUris(assembly, url)
  if (!isAssembly(assembly)) {
    throw new Error(`${url} has no assembly named "${genome}". ${HOSTED_HINT}`)
  }
  return assembly
}

export function renameHostedAssembly(assembly: Assembly, name: string) {
  return {
    ...assembly,
    name,
    sequence: {
      ...assembly.sequence,
      trackId: `${name}-ReferenceSequenceTrack`,
    },
  }
}

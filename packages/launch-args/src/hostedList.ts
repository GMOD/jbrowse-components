import { trackMatches, trackName, trackType } from './trackIds.ts'

import type { Track } from './fileInput.ts'

export const HOSTED_LIST_URL = 'https://jbrowse.org/ucsc/list.json'

export interface HostedGenome {
  organism?: string
  description?: string
}

export interface ListingCommand {
  command: string
  out: string
}

export function formatHostedGenomes(
  genomes: Record<string, HostedGenome>,
  { command, out }: ListingCommand,
) {
  const names = Object.keys(genomes).sort()
  const pad = Math.max(0, ...names.map(n => n.length))
  return [
    `UCSC assemblies on genomes.jbrowse.org (${names.length}); a GenArk accession (GCA_/GCF_...) works as --genome too:`,
    ...names.map(name => {
      const { organism, description } = genomes[name]!
      const about = [organism, description].filter(Boolean).join(' — ')
      return `  ${name.padEnd(pad)}  ${about}`
    }),
    '',
    `Show one:        ${command} --genome <name> --loc <region> --out ${out}`,
    `List its tracks: ${command} list <name> [filter]`,
  ].join('\n')
}

export function formatHostedTracks(
  genome: string,
  tracks: Track[],
  filter: string | undefined,
  { command, out }: ListingCommand,
) {
  const needle = filter?.toLowerCase()
  const matched = needle ? tracks.filter(t => trackMatches(t, needle)) : tracks
  const pad = Math.min(60, Math.max(0, ...matched.map(t => t.trackId.length)))
  const count = filter
    ? `${matched.length} of ${tracks.length} matching "${filter}"`
    : `${matched.length}`
  return {
    matched: matched.length,
    text: [
      `Tracks in ${genome} (${count}):`,
      ...matched.map(
        t =>
          `  ${t.trackId.padEnd(pad)}  ${trackType(t).padEnd(18)}  ${trackName(t)}`,
      ),
      '',
      `Show one: ${command} --genome ${genome} --track <trackId> --loc <region> --out ${out}`,
    ].join('\n'),
  }
}

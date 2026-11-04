import { dedupe, notEmpty } from '@jbrowse/core/util'
import { deepMerge } from '@jbrowse/core/util/deepMerge'

import type { JBrowseConfig, JBrowseConfigInput } from './types.ts'

// No built-in cloud accounts: the Google Drive and Dropbox desktop apps sync
// files to a local folder, which desktop opens directly. Google Drive's
// drive.file scope also needs the Google Picker, which runs only on a web
// origin, and Google caps an unverified app's restricted drive.readonly scope
// at 100 users.

/**
 * Turn a config as it arrived into one the root model can be created from: the
 * list fields an input need not carry are supplied, and each list is deduped
 * by its identity field.
 */
export function completeConfig(input: JBrowseConfigInput): JBrowseConfig {
  return {
    ...input,
    assemblies: dedupe(input.assemblies ?? [], asm => asm.name),
    tracks: dedupe(input.tracks ?? [], track => track.trackId),
    internetAccounts: dedupe(
      input.internetAccounts ?? [],
      account => account.internetAccountId,
    ),
    connections: dedupe(
      input.connections ?? [],
      connection => connection.connectionId,
    ),
  }
}

/**
 * Open several configs as one session. The first entry is the base, so one
 * config opens exactly as it arrived. Each catalog unions across every entry,
 * `configuration` deep-merges, and every other field, `defaultSession`
 * included, stays the first entry's: merging sessions splices unrelated view
 * lists into one.
 *
 * Several entries leave no single hosted config for "export to web" to reuse,
 * so `sourceConfigUrl` is blanked, which every reader treats as absent.
 */
export function mergeConfigInputs(
  entries: JBrowseConfigInput[],
): JBrowseConfigInput {
  const configurations = entries
    .map(entry => entry.configuration)
    .filter(notEmpty)
  const configuration = configurations.length
    ? configurations.reduce<Record<string, unknown>>(
        (acc, entry) => deepMerge(acc, entry),
        {},
      )
    : undefined
  return {
    ...entries[0],
    assemblies: entries.flatMap(entry => entry.assemblies ?? []),
    tracks: entries.flatMap(entry => entry.tracks ?? []),
    internetAccounts: entries.flatMap(entry => entry.internetAccounts ?? []),
    connections: entries.flatMap(entry => entry.connections ?? []),
    aggregateTextSearchAdapters: entries.flatMap(
      entry => entry.aggregateTextSearchAdapters ?? [],
    ),
    plugins: entries.flatMap(entry => entry.plugins ?? []),
    configuration:
      entries.length > 1 && configuration
        ? { ...configuration, sourceConfigUrl: '' }
        : configuration,
  }
}

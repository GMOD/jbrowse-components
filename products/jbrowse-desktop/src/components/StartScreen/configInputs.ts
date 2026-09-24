import { dedupe, notEmpty } from '@jbrowse/core/util'
import { deepMerge } from '@jbrowse/core/util/deepMerge'

import type {
  InternetAccount,
  JBrowseConfig,
  JBrowseConfigInput,
} from './types.ts'

// Offered in every desktop session, so they belong to what completes a config
// rather than to what a config has to declare. Last in the list on purpose: a
// config naming its own account with one of these ids wins, because `dedupe`
// keeps the first occurrence.
const builtinInternetAccounts: InternetAccount[] = [
  {
    type: 'DropboxOAuthInternetAccount',
    internetAccountId: 'dropboxOAuth',
    name: 'Dropbox',
    description: 'Account to access Dropbox files',
    clientId: 'ykjqg1kr23pl1i7',
  },
  {
    type: 'GoogleDriveOAuthInternetAccount',
    internetAccountId: 'googleOAuth',
    name: 'Google Drive',
    description: 'Account to access Google Drive files',
    clientId:
      '109518325434-m86s8a5og8ijc5m6n7n8dk7e9586bg9i.apps.googleusercontent.com',
  },
]

/**
 * Turn a config as it arrived into one the root model can be created from: the
 * list fields an input need not carry are supplied, the built-in internet
 * accounts are added, and each list is deduped by its identity field.
 */
export function completeConfig(input: JBrowseConfigInput): JBrowseConfig {
  return {
    ...input,
    assemblies: dedupe(input.assemblies ?? [], asm => asm.name),
    tracks: dedupe(input.tracks ?? [], track => track.trackId),
    internetAccounts: dedupe(
      [...(input.internetAccounts ?? []), ...builtinInternetAccounts],
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

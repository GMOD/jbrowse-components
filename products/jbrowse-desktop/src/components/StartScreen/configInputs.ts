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
 * three list fields an input need not carry are supplied, the built-in internet
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
  }
}

/**
 * Open several configs as one session. The catalogs union — opening two hub
 * configs together means every assembly and track from both, with
 * {@link completeConfig} deduping by id afterwards — while the two fields that
 * are not catalogs are picked rather than merged.
 *
 * `defaultSession` is the FIRST entry's, never a merge: merging splices
 * unrelated view lists into one. createPluginManager names it, and the
 * recent-sessions row is written from the named session at the first autosave
 * rather than from this snapshot.
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
    assemblies: entries.flatMap(entry => entry.assemblies ?? []),
    tracks: entries.flatMap(entry => entry.tracks ?? []),
    internetAccounts: entries.flatMap(entry => entry.internetAccounts ?? []),
    plugins: entries.flatMap(entry => entry.plugins ?? []),
    defaultSession: entries[0]?.defaultSession,
    // A single hub config can be reused as the export base; merging several
    // leaves no single source config, so drop the marker the entries carry.
    // `''` reads the same as absent everywhere it is consumed (`!sourceConfigUrl`
    // in sessionUtils, buildWebExport), and says the blanking was deliberate.
    configuration:
      entries.length > 1 && configuration
        ? { ...configuration, sourceConfigUrl: '' }
        : configuration,
  }
}

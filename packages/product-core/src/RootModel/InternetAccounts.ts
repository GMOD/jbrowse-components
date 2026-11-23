import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { asRoot } from '../siblingCast.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseInternetAccountConfigModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { UriLocation } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * The ephemeral account ids RpcManager mints are `<TypeName>-<rest>` — the
 * leading segment names the account type and the remainder is its display name.
 * Read in one place so the two callers cannot disagree about which is which.
 */
function parseEphemeralId(internetAccountId: string) {
  const [type = '', ...rest] = internetAccountId.split('-')
  return { type, name: rest.join('-') }
}

/**
 * Whether the fetch this location describes would go to the origin serving
 * JBrowse itself.
 *
 * `domains` cannot name that host. A config shipped with relative data paths
 * (`volvox_microarray.bw`) resolves against wherever the app is deployed, which
 * whoever wrote the config does not know — so an account for it has nothing to
 * put in `domains`, and naming the account on the location is the only way to
 * reach it. So it applies only to an account whose `domains` are empty: one
 * that lists hosts is scoped to them, and the app's origin is not among them.
 *
 * Resolved the way the request will be, against `baseUri` when there is one, so
 * a spec cannot pass a relative uri under an off-origin base and read as local.
 */
function resolvesToAppOrigin(location: UriLocation) {
  const here = pageLocation()
  const appOrigin = here ? webOrigin(here.href) : undefined
  return !!appOrigin && resolvedOrigin(location) === appOrigin
}

function pageLocation() {
  // typed as always present, and absent in node and in some embedded hosts
  return globalThis.location as Location | undefined
}

// Only an http(s) URL has an origin a request goes to: `file:` and `data:`
// stringify theirs as `null`, and a `blob:` URL borrows its creator's.
function webOrigin(uri: string, base?: string) {
  try {
    const url = new URL(uri, base)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.origin
      : undefined
  } catch {
    return undefined
  }
}

function resolvedOrigin(location: UriLocation) {
  return webOrigin(location.uri, location.baseUri ?? pageLocation()?.href)
}

/**
 * Whether the id is the `<TypeName>-<origin>` an origin account carries, for
 * the origin this location resolves to. Its stored credential is keyed by the
 * id, so an origin account answers for its own origin and nowhere else.
 */
function namesOwnOrigin(internetAccountId: string, location: UriLocation) {
  const origin = resolvedOrigin(location)
  return !!origin && parseEphemeralId(internetAccountId).name === origin
}

// An account named by a location it is not scoped for reads as a dead track,
// so say which half to fix. Once per pair: the check runs on every RPC
// serialization, and a track issues one per block.
const warnedScopeMismatches = new Set<string>()
function warnScopeMismatch(internetAccountId: string, uri: string) {
  const key = `${internetAccountId}|${uri}`
  if (!warnedScopeMismatches.has(key)) {
    warnedScopeMismatches.add(key)
    console.warn(
      `Internet account "${internetAccountId}" is not used for ${uri}: the URL is outside its "domains". Add the host to that account's domains if this is your data.`,
    )
  }
}

/**
 * #stateModel InternetAccountsMixin
 * #category root
 * Adds internet accounts to the root model, and finds the account that signs
 * the request for a given file location.
 */
export function InternetAccountsRootModelMixin(pluginManager: PluginManager) {
  return types
    .model({
      /**
       * #property
       */
      internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      ),
    })
    .actions(self => ({
      /**
       * #action
       */
      initializeInternetAccount(
        internetAccountConfig: BaseInternetAccountConfigModel,
        initialSnapshot: object = {},
      ) {
        self.internetAccounts.push({
          ...initialSnapshot,
          type: internetAccountConfig.type,
          configuration: internetAccountConfig,
        })
        return self.internetAccounts.at(-1)
      },

      /**
       * #action
       * An account for the whole origin `url` is on, which is what its
       * `<TypeName>-<origin>` id names. Its one `domains` entry is the origin
       * and a `/`, the URL-prefix spelling that matches only that scheme, host
       * and port.
       */
      createEphemeralInternetAccount(
        internetAccountId: string,
        initialSnapshot: Record<string, unknown>,
        url: string,
      ) {
        const origin = webOrigin(url)
        const { type, name } = parseEphemeralId(internetAccountId)
        const configuration = {
          type,
          internetAccountId,
          name,
          description: '',
          domains: origin ? [`${origin}/`] : [],
        }
        const length = self.internetAccounts.push({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        return self.internetAccounts[length - 1]!
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      findAppropriateInternetAccount(location: UriLocation) {
        // find the existing account selected from menu
        const selectedId = location.internetAccountId
        const selectedAccount = selectedId
          ? self.internetAccounts.find(
              account => account.internetAccountId === selectedId,
            )
          : undefined
        if (selectedId) {
          // The account still has to be scoped for the URL. Naming one used to
          // be enough on its own, which made the field a way to redirect
          // someone else's credential: jbrowse-web builds tracks out of
          // `sessionTracks` in the URL, and a location there carrying
          // `internetAccountId` sent that account's token to whatever host the
          // link chose — first as validateToken's probe from the main thread,
          // then as the worker's read. An OAuth account with a refresh token in
          // localStorage needs no interaction at all to mint a fresh one for it.
          if (selectedAccount) {
            if (
              selectedAccount.handlesLocation(location) ||
              (selectedAccount.domains.length === 0 &&
                resolvesToAppOrigin(location))
            ) {
              return selectedAccount
            }
            warnScopeMismatch(selectedId, location.uri)
          }
        }

        // if no existing account or not found, try to find working account
        for (const account of self.internetAccounts) {
          const handleResult = account.handlesLocation(location)
          if (handleResult) {
            return account
          }
        }

        // if still no account, create the one the location names — only when
        // no account holds that id, only for a file on the origin the id names
        // or, for an id naming no origin, on the app's own, and only for an id
        // whose leading segment names an account type this session actually
        // has. Anything else is a location pointing at an account that is simply
        // gone (a track from a shared session whose config defined one, a
        // config it was removed from, a host that never loaded the
        // authentication plugin), and pushing an unknown type into the array
        // threw a bare MST union error out of whatever was opening the file. No
        // account instead lets the read go out unauthenticated and report the
        // 401 it gets, which is the failure the user can act on.
        if (
          selectedId &&
          !selectedAccount &&
          (namesOwnOrigin(selectedId, location) ||
            (resolvesToAppOrigin(location) &&
              !webOrigin(parseEphemeralId(selectedId).name))) &&
          pluginManager
            .getElementTypesInGroup('internet account')
            .some(t => t.name === parseEphemeralId(selectedId).type)
        ) {
          return self.createEphemeralInternetAccount(
            selectedId,
            {},
            parseEphemeralId(selectedId).name,
          )
        }
        return undefined
      },
    }))
    .actions(self => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(
            function internetAccountsAutorun() {
              const { jbrowse } = asRoot(self)
              for (const internetAccount of jbrowse.internetAccounts) {
                if (
                  !self.internetAccounts.some(
                    a =>
                      a.internetAccountId === internetAccount.internetAccountId,
                  )
                ) {
                  self.initializeInternetAccount(internetAccount)
                }
              }
            },
            { name: 'InternetAccounts' },
          ),
        )
      },
    }))
}

export type RootModelWithInternetAccountsType = ReturnType<
  typeof InternetAccountsRootModelMixin
>
export type RootModelWithInternetAccounts =
  Instance<RootModelWithInternetAccountsType>

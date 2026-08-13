import { InternetAccount } from './InternetAccountModel.ts'

// The members of the internet account model that plugins outside this repo
// reach for, pinned the way `pluginFacingSessionApi.test.ts` pins the session
// and `ReExports/abi.test.ts` pins the module exports.
//
// Neither of those guards this surface. `abi.test.ts` is name-level over module
// exports, so it notices if `InternetAccount` itself stops being exported and
// nothing else; a plugin that extends the model reaches its MEMBERS at runtime,
// through MST composition, and no test looked at that at all.
//
// The failure is the quiet kind. A plugin composes over this model with
// `.actions(self => ...)`, so a member we delete does not error at import — it
// just stops being there, and whichever of the plugin's own actions called it
// throws somewhere unrelated, or silently does less. `getValidatedToken` was
// removed from this model on the reasoning that nothing in this repo called it,
// which was true and was still a guess about everyone else.
//
// The list is evidence, not a wish. It is what `jbrowse-plugin-apollo`
// (~/src/Apollo3, `src/ApolloInternetAccount/model.ts`, 593 lines) actually
// overrides or calls — the largest internet account implementation outside this
// repo, and one that pins `@jbrowse/core: ^4.3.0`, so a caret bump carries our
// removals straight into it. None of the 16 entries in `website/plugins.json`
// registers an internet account type, which is why this went unnoticed.
//
// Removals fail here, additions don't — same doctrine as the ABI baseline. To
// drop one deliberately, delete it in the same commit as the change and say in
// the message which downstream implementations you read.
//
// Absence is deliberately not pinned, for the same reason: an assertion that
// `SelectorComponent` is gone would fail on a legitimate re-add, and what a
// re-add would cost is a design argument, not a compatibility one. That removal
// is recorded in `agent-docs/ideas/internet-accounts.md` with the bundles read.
const PLUGIN_FACING = {
  // --- overridden wholesale, so the name and the call signature both matter
  getToken: 'apollo overrides it',
  getTokenFromUser: 'apollo implements it — the intended extension point',
  removeToken: 'apollo overrides it',
  // --- called directly
  getFetcher: 'apollo, ~20 call sites; it is their whole API client',
  retrieveToken: 'apollo, 5 call sites',
  storeToken: 'apollo, 2 call sites',
  tokenKey: 'apollo, in its own removeToken',
  // --- read off the model by the UI
  id: 'apollo LogOut.tsx, as a React key',
  internetAccountId: 'apollo LogOut.tsx',
  name: 'apollo LogOut.tsx',
  type: 'apollo LogOut.tsx, to filter its own accounts out of the list',
  // --- config slots read through the model's getters
  domains: 'apollo, generated server-side as [urlObj.host]',
  tokenType: 'apollo config schema overrides the default',
}

// Members this repo relies on across the RPC boundary or in the file selector.
// Nothing outside is known to touch them, but they are the contract between
// core, the authentication plugin and the workers, so a removal should still be
// a deliberate edit here rather than a silent one.
const INTERNAL = [
  'addAuthHeaderToInit',
  'fetchWithToken',
  'getPreAuthorizationInformation',
  'handlesLocation',
  'openLocation',
  'showInFileSelector',
  'validateToken',
]

function makeAccount() {
  return InternetAccount.create({
    type: 'InternetAccount',
    // a snapshot, not BaseInternetAccountConfig.create: ConfigurationReference
    // stores an instance by identifier, which nothing in this bare tree resolves
    configuration: {
      type: 'InternetAccount',
      internetAccountId: 'testAccount',
    },
  })
}

test('the model keeps every member a downstream internet account reaches for', () => {
  const account = makeAccount()
  const missing = Object.entries(PLUGIN_FACING)
    .filter(([name]) => !(name in account))
    .map(([name, who]) => `${name} (${who})`)

  expect(missing).toEqual([])
})

test('the model keeps the members core and the workers depend on', () => {
  const account = makeAccount()

  expect(INTERNAL.filter(name => !(name in account))).toEqual([])
})

// Apollo composes over `getFetcher` by capturing it at composition time
// (`const superGetFetcher = self.getFetcher`), which is the supported MST super
// pattern only while it stays an action. As a view it would be evaluated once
// and frozen, handing them a stale fetcher with nothing thrown — the same trap
// `packages/core/src/ui/CLAUDE.md` records for extension seams generally.
test('getFetcher is an action, so a subclass can super-capture it', () => {
  const account = makeAccount()

  expect(typeof account.getFetcher).toBe('function')
  expect(
    Object.getOwnPropertyDescriptor(account, 'getFetcher')?.get,
  ).toBeUndefined()
})

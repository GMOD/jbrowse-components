---
name: internet-accounts
description: The internet account model does six jobs across an RPC boundary that needs only three, and Apollo3 decides what can break. Read before proposing the split, a sign-out menu, or a cache over the token probe.
---

# Internet accounts: the split the RPC boundary already draws

~3,300 lines across the auth plugin (1,851), core plus the root-model mixin
(665) and the FileSelector (786). Reviewed end to end in 2026-08, re-read
2026-08-19; this is what came out that is not already landed.

**None of this is release-blocking, and an earlier draft of this doc was wrong
to sequence it against v5.** The one breaking-shaped move is move 1, it wants
coordination with Apollo, and it rewrites the RPC hot path — which is not
something to land against a release that is nearly out the door. It can be
additive whenever, with the slot removal deferred to whichever major comes
next. What *did* have to ship with the behaviour change is the config guide,
which described the old `domains` matching and now describes the new.

## The diagnosis

An internet account does six jobs, and they part cleanly along a line the code
already has and does not respect:

| job | needs a main thread? |
| --- | --- |
| match a URL (`domains`) | no |
| acquire a credential (OAuth dance, dialog) | **yes** |
| cache it (session/localStorage + promise) | **yes** |
| apply it to a request (`addAuthHeaderToInit`) | no |
| present a toggle in the file picker | **yes** |
| *speak a different protocol* (Dropbox, Drive) | no |

The whole model goes to both sides. `util/io/index.ts` reconstructs a **full
account model in the worker** from the pre-auth payload, then uses three things
from it: `authHeader`, `tokenType`, and the URL rewriting. The rest is not
merely unused but unusable — `getTokenFromUser` wants `root.session`,
`getTokenViaAuthFlow` wants `window.open`, `storeToken` wants `sessionStorage`.
That is what the `isWebWorker()` and guarded-storage calls threaded through the
model are: **the shape of the wrong half being present.** And `corePlugins.ts`
is the worker's plugin list too, so the RPC worker bundle carries the OAuth
popup driver, PKCE crypto and the `window.require('electron')` branch — 661 of
the plugin's 1,851 lines it can never reach (`OAuthModel/model.tsx` plus its
`util.ts`, neither of which a worker can enter).

## The three moves

### 1. A credential crosses the RPC boundary, not an account

Replace `internetAccountPreAuthorization`'s
`{internetAccountType, authInfo: {token, configuration}}` with a plain
credential, and move it **off the location** onto the RPC envelope, riding the
way `blobMap` already does. The worker's `openLocation` becomes a
`RemoteFileWithRangeCache` whose fetch merges headers — no plugin lookup, no MST
model, no auth plugin in the worker at all.

**Key it on `internetAccountId`**, which is already on the location and already
persisted — the envelope then carries id → headers and the location keeps only a
name, which is what makes the slot removal a simplification rather than a
relocation. And read what `blobMap` is before copying it: a module-level global
the worker *replaces wholesale* per call (`setBlobMap` in `util/tracks.ts`). That shape
is right for blobs and wrong for credentials, which should not outlive the call
that needed them.

Worth doing beyond the deletion: the slot is a `types.maybe` on the **MST
`UriLocation` type**, so the persisted location type says "may carry a bearer
token", and session sharing serialises locations. Nothing leaks today only
because `ownArgs` clones before `serializeNewAuthArguments` mutates. Verified
that **MST silently drops unknown snapshot properties**, so removing the slot
cannot fail an old session or config load.

**Blocked on move 2** for the headers-only version: Dropbox and Drive need more
than headers, so until they stop being accounts the envelope would have to carry
the type and configuration anyway — a relocation, not a simplification.

### 2. Dropbox and Google Drive are location handlers, not accounts

Dropbox turns a GET into a `POST .../get_shared_link_file` with the URL in a
header; Drive rewrites `/d/<id>` into a different API URL and needs its own
filehandle for `stat()`. Neither is authentication. Split out, each becomes a
**config preset** over `OAuthInternetAccount` — already 80% true, since their
schemas are 83 and 74 lines of pure defaults. Deletes both `model.tsx` (233
lines).

**The config type names must survive.** All five are written into user configs
and documented in `website/docs/config_guides/authentication.md`; keep them
registered with the same names and schemas and only the bodies empty out.
Telling users to write `OAuthInternetAccount` with explicit endpoints instead is
a wide breaking change and not worth the lines.

Partial win only: their `validateToken` probes are genuinely cheaper than a HEAD
(Drive's `files/<id>` without `alt=media`; Dropbox has no HEAD at all), so
`validateTokenWithProbe` shrinks but does not vanish.

### 3. The HTTP Basic 401 retry stops being an "account"

`createEphemeralInternetAccount` backs `RpcManager`'s 401 retry, and could be
one non-pluggable path: on `AuthNeededError`, prompt, store under the origin,
retry.

**Two claims an earlier draft made here are wrong**, and the move is smaller
than they made it look:

- It is not the only caller. `findAppropriateInternetAccount` calls it too
  (`packages/product-core/src/RootModel/InternetAccounts.ts`) for a location
  naming an id whose leading segment is a registered type — the shared-session
  path, which is not the HTTP Basic 401 retry and which depends on the same
  `<TypeName>-<rest>` encoding.
- The URL-prefix branch of `uriMatchesDomains` does **not** die with it. That
  shape is a documented user-facing feature for scoping an account to part of a
  server (`config_guides/authentication.md`, the `data.mylab.org/public` vs
  `/private` example), independent of ephemeral accounts.

## Apollo3 decides what can break, and when

Rechecked 2026-11-18 against Apollo3 `main` and its `v2` branch.

`jbrowse-plugin-apollo` (`~/src/Apollo3`) carries a ~980-line
`ApolloInternetAccount`, the largest implementation outside this repo. Its
`main` is the 1.x line on `@jbrowse/core: ^4.3.0`; its v5 port is the `v2`
branch (PR #863, which took #846), on `^5.0.0-beta.22`. Both are caret ranges,
so every later beta and 5.0.0 itself reach it at the next install. None of the
16 entries in `website/plugins.json` registers an account type, which is how
this went unnoticed for so long.

It **overrides** `getToken`, `removeToken`, `getTokenFromUser` and
super-captures `getFetcher`; **calls** `retrieveToken`, `storeToken`,
`tokenKey`; reads `domains` (its server emits `[urlObj.host]`, in
`apollo-collaboration-server/src/jbrowse/jbrowse.service.ts`) and `tokenType`;
and uses jbrowse-desktop's `openAuthWindow` IPC directly, through
`globalThis.require('electron')`, including its resolves-`undefined`-on-close
contract. It touches **none** of `handlesLocation`, `addAuthHeaderToInit`,
`validateToken`, `getPreAuthorizationInformation`, `authHeader`, or any
FileSelector getter, so moves 2 and 3 are invisible to it. Still all zero on
2026-11-18, on both branches.

**Move 1 is the one it constrains.** Its `getToken` reads
`location?.internetAccountPreAuthorization?.authInfo?.token`, and in a worker,
with that missing, throws `Did not get internet account pre-authorization info
in worker`; there is no fallback. So move 1 has three shapes:

| what we do | Apollo |
| --- | --- |
| fill the slot as today, and add the envelope credential beside it | unaffected |
| keep the slot in the type but stop filling it | compiles, then its worker-side fetches throw |
| remove the slot from the type | fails to compile at that read, and the same at runtime |

The middle one is the trap, because no typecheck catches it. #846 left the fork
in place on `v2`.

**Decided 2026-11-18: the slot stays, filled as today, through 5.x.** Move 1 is
additive at most until Apollo drops its fork, and the slot removal waits for the
next major. Also frozen for 5.x, because Apollo reaches them without going
through core: the `openAuthWindow` channel, its params and its
resolve-`undefined`-on-close, and the main window's `nodeIntegration` and
`contextIsolation: false`, which its `globalThis.require('electron')` needs.

**`internetAccountApi.test.ts` does not pin the read that matters.** It pins
model members only. Add a case that a worker-side location still carries
`internetAccountPreAuthorization.authInfo.token` after serialization, which is
the middle shape above. Its header's counts (593 lines, 5 `retrieveToken`
sites) are from August.

### The constraint dissolves, and Apollo should want it to

Their `getToken` and `removeToken` are our v4 implementations, forked and
drifted. `tokenPromise` is read **only** inside those two, and `setRole()` is
called from places independent of both, so deleting all three is a bugfix for
them: `isWebWorker()` in place of a `typeof sessionStorage` probe that is also
true where storage is merely *blocked*, and guarded storage in place of raw
`sessionStorage`. The third bug an August read listed, a throwing
`getTokenFromUser` wedging the account, they fixed themselves with a try/catch
inside it.

It is no longer a pure delete. Their `getToken` wraps failures in a
`LoginFailedError` that their session branches on to offer a login, so that
wrapping moves into `getTokenFromUser`'s reject calls first.

So the sequence, whenever it is picked up:

- **Apollo moves the `LoginFailedError` wrapping and deletes the two overrides
  and `tokenPromise`.** Needs nothing from us; nobody has proposed it upstream
  (searched 2026-11-18).
- **Move 1 lands clean** in the next major: no deprecated read path, no shim.
- **Moves 2 and 3** land whenever, being invisible to Apollo either way.

### Worth telling Apollo regardless

Their bugs, independent of any move here:

- `finishOAuthWindow` takes popup `message` events without checking
  `event.origin`, and the flow sends no `state`, so another page could hand the
  account a token for a login the user never made. `state` needs their server to
  echo it back.
- On desktop, closing the login window resolves the IPC call with `undefined`,
  which `finishOAuthWindow` then calls `replace` on. The TypeError surfaces as a
  login failure rather than a cancel. Map `undefined` to `LoginCancelledError`,
  or call through `invokeElectronMain` from `@jbrowse/core/util/electron`.
- Already fixed on their side: a popup closed by the user now rejects
  (`watchForPopupClosed`, #840).

## Two things wrong with the current code that no move here fixes

**The pre-flight the base model says it avoids.** `fetchWithToken` carries a
comment refusing a `validateToken` pre-flight per request, because "a range-read
track issues hundreds of requests". But `getPreAuthorizationInformation` calls
`validateToken` unconditionally and `serializeNewAuthArguments` calls that on
every RPC serialization — the guard it checks,
`loc.internetAccountPreAuthorization`, is never set on the args `ownArgs` has
just cloned. Measured at 20 probes for 20 serializations, one extra round trip
ahead of the real work, per *location*, so a BAM and its index are two.
`OAuthInternetAccount` has no `validateWithHEAD` slot to turn it off either, and
adding one would not be the fix: for an OAuth account `validateToken` *is* the
refresh path, where for the two token-entry accounts that do have the slot it is
only a check. The optimization was made at the wrong layer and the comment
explaining why it should not exist lives in the other function.

`rpcTokenProbe.test.ts` now pins it — 10 serializations of a BAM and its index,
20 HEADs — and says in its header that it is a ratchet and what to lower the
numbers to.

**Size it before rushing it.** The multiplier is RPC calls, and this tree makes
one *per region per fetch*, not one per block: `RenderAlignmentData` takes
`regions: [region]`. So a BAM track costs two probes a navigation, and the
"hundreds of requests" `fetchWithToken`'s comment guards against does not
reappear here. Real, bounded, and not a reason to touch the auth hot path
against a release.

Not a one-liner either, because the probe is also how an expired token gets
caught and refreshed on the main thread — the worker cannot refresh. A cache over
it needs a TTL short enough to keep that.

**A TTL is not the only shape, and probably not the right one.** What the probe
is standing in for is an expiry the provider already tells us: OAuth token
responses carry `expires_in` (RFC 6749 §5.1), and the implicit flow returns it in
the redirect fragment. `postTokenGrant` reads only `access_token` and
`refresh_token` and drops it on the floor; `finishOAuthRedirect` does the same.
Capture it, and "is this token still good" becomes a local comparison — no round
trip, no TTL guessed against a lifetime the server knows exactly. Two things to
carry into that: a provider may omit `expires_in`, so the probe has to stay as
the fallback for accounts with no known expiry; and the probe today also catches
*revocation*, which an expiry check cannot — that case would degrade from a
silent refresh to the worker's read returning a 401, which is a behaviour change
to state rather than to slip past.

Either way this remains the strongest argument for move 1 that move 1 does not
make: a credential on the envelope is a per-call decision that can be cached,
where a credential on the location forces re-validation of every location on
every call.

**Nothing in this repo revokes a credential.** Every `removeToken()` call site
here is an error path, and `removeRefreshToken()` fires only on an
`invalid_grant`. So a session token lives until the tab closes and an OAuth
refresh token lives in localStorage indefinitely, silently minting access tokens
on every later visit, with no UI that clears either. Declining a global menu item
(below) is a fine call on its own; the entry reads as though the alternative were
"no menu item", when the state is "no revocation in any form". The storage split
is also inverted: the short-lived access token gets `sessionStorage` and the
long-lived, higher-privilege refresh token that can regenerate it gets
`localStorage`.

"Nothing anywhere" would be too strong: Apollo3 has an "Apollo → Log out" menu
item that opens a dialog and calls `removeToken()` on the account picked
(`menus/topLevelMenu.ts`, `components/LogOut.tsx`). agent-docs/architecture-decision-records/ already
weighed that and ruled it evidence about Apollo rather than demand here, so this
is not a reason to reopen the menu item. Two mechanics from it are still worth
having in hand: their handler follows the call with `globalThis.location.reload()`,
because dropping the credential does not unwind whatever was opened with it; and
they **override** `removeToken`, so a core revocation routed through a *new*
method instead of through `removeToken` does nothing for the one consumer that
already revokes.

## Declined: a global sign-out menu item

Built and backed out (2026-08), keeping the
`signOut()` refresh-token detail that is worth keeping if it ever returns.

## Already landed, so don't re-derive it

`uriMatchesDomains` (host on a dot boundary, or a `/`-bearing entry as a URL
prefix to a path-segment boundary; query and fragment never consulted) replaced
a plain `uri.includes(domain)` that let a session spec aim a user's Drive token
at any server. `fetchWithToken` moved to the base and its retry is conditional
on `validateToken` returning a *different* token. Accounts are matched against
the **resolved** location. An `internetAccountId` naming an unregistered type no
longer throws raw MST. The token-entry accounts drop a credential the server
rejected. `SelectorComponent` is gone. See PR #5619 and the commits around it.

Landed 2026-08-19, both found re-reading the code rather than the doc:

- **A location's `internetAccountId` no longer overrides `domains`.** It
  resolved by id alone, so `handlesLocation` — and with it the whole
  `uriMatchesDomains` hardening above — was skipped whenever a location named
  its account, which `sessionTracks` in a jbrowse-web URL can do. Same-origin
  locations are the exception, because `domains` cannot express them: a config
  with relative data paths resolves against wherever the app is deployed.
  jbrowse-web's ExternalToken test is that shape and is what caught the
  overreach.
- **The PKCE verifier rotates per authorization request.** It was one lazily
  created value shared by every flow the account ever ran, twelve lines under a
  `state` that already minted a nonce per flow for the same reason.

`SelectorComponent`'s removal is the one that had to be *verified* rather than
argued, since it is an MST member and the ABI removals table is name-level over
module exports. What was read, 2026-08-15:

- every published bundle behind `website/plugins.json`, all 16 at `latest`, from
  the deploy mirror in `jbrowse-plugin-list/dist` (6962 files) — **no `.js` hit
  at all**. Plugins take `@jbrowse/core` as an external UMD global, so core's own
  copy is not inlined and an override or read would have to appear in the
  plugin's own code.
- the only hits anywhere are `.d.ts`, in Apollo and GDC, and they are the
  *inherited* `readonly SelectorComponent: AnyReactComponentType | undefined`
  sitting in the same emitted intersection as `toggleContents` and
  `selectorLabel` — tsc echoing core's `.views()` block, not an override.
- `jbrowse-plugin-apollo` source (`~/src/Apollo3`): none. Its custom auth UI
  (`AuthTypeSelector`) goes through `session.queueDialog` inside
  `getTokenFromUser`, which is the extension point that does get used.
- `~/src/apollino` registers no internet account; the `~/src/jb2plugins/*` and
  `react-msaview` hits are dev bundles that inline core, i.e. core's own
  `LocationInput`.

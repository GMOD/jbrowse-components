---
name: internet-accounts
description: The internet account model does six jobs across a boundary that only needs three, and Apollo3 is the downstream consumer that decides what can be broken and when. None of it is release-blocking; read before proposing the split or a sign-out menu.
---

# Internet accounts: the split the RPC boundary already draws

~3,200 lines across the auth plugin (1,839), core plus the root-model mixin
(665) and the FileSelector (669). Reviewed end to end in 2026-08; this is what
came out that is not already landed.

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
popup driver, PKCE crypto and the `window.require('electron')` branch — 659 of
the plugin's 1,839 lines it can never reach.

## The three moves

### 1. A credential crosses the RPC boundary, not an account

Replace `internetAccountPreAuthorization`'s
`{internetAccountType, authInfo: {token, configuration}}` with a plain
credential, and move it **off the location** onto the RPC envelope, riding the
way `blobMap` already does. The worker's `openLocation` becomes a
`RemoteFileWithRangeCache` whose fetch merges headers — no plugin lookup, no MST
model, no auth plugin in the worker at all.

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

`createEphemeralInternetAccount` exists only so `RpcManager` can retry a 401,
and drags along the `<TypeName>-<rest>` id encoding and the URL-prefix branch in
`uriMatchesDomains`. It could be one non-pluggable path: on `AuthNeededError`,
prompt, store under the origin, retry. The prefix branch dies with it, leaving a
pure host matcher.

## Apollo3 decides what can break, and when

`jbrowse-plugin-apollo` (`~/src/Apollo3`) is a 593-line `ApolloInternetAccount`
— the largest implementation outside this repo, and it pins
`@jbrowse/core: ^4.3.0`, a **caret range**, so anything landing in 4.x reaches
it at the next install. None of the 16 entries in `website/plugins.json`
registers an account type, which is how this went unnoticed for so long;
`internetAccountApi.test.ts` now pins the members it reaches for.

It **overrides** `getToken`, `removeToken`, `getTokenFromUser` and
super-captures `getFetcher`; **calls** `retrieveToken`, `storeToken`,
`tokenKey`; reads `domains` (its server emits `[urlObj.host]`) and `tokenType`;
and uses jbrowse-desktop's `openAuthWindow` IPC directly, including its
resolves-`undefined`-on-close contract. It touches **none** of
`handlesLocation`, `addAuthHeaderToInit`, `validateToken`,
`getPreAuthorizationInformation`, `authHeader`, or any FileSelector getter — so
moves 2 and 3 are invisible to it.

**Move 1 is the one it constrains**, because its `getToken` override reads
`location?.internetAccountPreAuthorization?.authInfo?.token` verbatim.

### The constraint dissolves, and Apollo should want it to

Their `getToken` and `removeToken` are our v4 implementations, forked and
drifted. `tokenPromise` is read **only** inside those two, and `setRole()` is
called from three places independent of both — so deleting all three is a no-op
for the rest of their code, and a strict bugfix, since ours has since gained:
`isWebWorker()` in place of a `typeof sessionStorage` probe that is also true
where storage is merely *blocked*; a `.catch` that clears the cache when
`getTokenFromUser` throws on the way in (theirs wedges the account for the
session, and their async `getTokenFromUser` reaching `getRoot(self).session`
makes it reachable); and guarded storage.

So the sequence, whenever it is picked up:

1. **Apollo deletes the two overrides.** Ships against 4.x, needs nothing from
   us. This is the gate, and it is a bugfix for them regardless.
2. **Move 1 lands clean** — no deprecated read path, no shim.
3. **Moves 2 and 3** land alongside, being invisible to Apollo either way.

If step 1 does not happen first, move 1 needs the slot kept as a deprecated read
path and the whole saving is the ordering. Confirm with whoever owns the Apollo
bump before committing to the unphased version.

Their OAuth popup is separately a fork of ours carrying the bugs we fixed —
notably **no `event.origin` check**, so any page holding a handle to the window
can post a `redirectUri` and have its `access_token` stored as the user's. Their
flow is an ordinary implicit grant with a custom endpoint and could be
`OAuthInternetAccount` with an overridden `authEndpoint`, `responseType:
'token'` and `authFlowParams` — which needs their server to echo `state` back.

## Declined: a global sign-out menu item

Built and backed out (2026-08). A `Tools → Sign out...` row opening a dialog
listing every account holding a credential, with `signOut()`/`hasCredential()`
seams on the base model and a `signOut()` override on the OAuth account to drop
the refresh token too (dropping only the access token silently signs the user
back in on the next read — that part is real and worth keeping if this ever
returns).

**Rejected as overfitting.** Authentication is rare; a permanent top-level row
in every install to serve it is disproportionate, and Apollo — whose product
*is* authenticated — already has its own `LogOut.tsx`. Their having built one is
evidence about Apollo, not demand for it here; reading it as demand is the
mistake to avoid repeating. Without a caller the `signOut()` seam is also just
another unused extension point, which is what `SelectorComponent` and
`getValidatedToken` were deleted for.

If it ever does earn its place, the contextual spot is the FileSelector beside
the account toggle you just picked — where the user is already thinking about
that account — not a global menu.

## Already landed, so don't re-derive it

`uriMatchesDomains` (host on a dot boundary, or a `/`-bearing entry as a URL
prefix to a path-segment boundary; query and fragment never consulted) replaced
a plain `uri.includes(domain)` that let a session spec aim a user's Drive token
at any server. `fetchWithToken` moved to the base and its retry is conditional
on `validateToken` returning a *different* token. Accounts are matched against
the **resolved** location. An `internetAccountId` naming an unregistered type no
longer throws raw MST. The token-entry accounts drop a credential the server
rejected. `SelectorComponent` is gone. See PR #5619 and the commits around it.

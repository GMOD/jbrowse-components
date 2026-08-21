---
name: web-share-link-in-desktop
description: Measured: the snapshot applies but drops `sessionTracks` in silence, so this is a translation problem and not a decode problem.
---

# Opening a web share link in Desktop

Desktop reads `session=spec-`, the `&assembly=`/`&loc=` shorthand and `&hubURL=`.
It does not read the three encodings jbrowse-web's own share button produces —
`share-<id>` (uploaded, encrypted), `encoded-<b64>` (compressed inline) and
`json-<json>` — so the round trip is one-way: Desktop exports to web, web cannot
hand anything back. It is also why the ShareDialog has no "Open in Desktop"
button: none of the three is a format Desktop could accept.

**The transport is not the obstacle.** `fromUrlSafeB64` and
`readSessionFromDynamo` are both in `@jbrowse/core/util/sessionSharing`, Desktop
already imports that module for export-to-web, and it already runs `aesEncrypt`
there — so WebCrypto works in that renderer and `share-` decryption would too.
`launchFromLink` already fetches the link's `config=` through the plugin-trust
funnel (ADR-038). Wiring a decoder is an afternoon.

**The obstacle is the shape, and it fails silently.** Measured 2026-08-11 by
building a real jbrowse-web session, snapshotting it, and calling
`setSession(snap)` on a desktop root model:

- It does **not** throw. MST drops snapshot keys the target model does not
  declare, so the import reports success and the session opens.
- `views`, `widgets`, `activeWidgets`, `name`, `id`, `focusedViewId` all survive.
- **`sessionTracks` is dropped**, along with `trackConfigDeltas` and
  `sessionPlugins`.

Losing `sessionTracks` in silence is the finding. It is frequently the whole
point of a shared session — the tracks the sender added — and the views that
reference those track ids survive, so the result is a session whose views name
tracks that no longer exist. Desktop has no `sessionTracks`: its session puts
tracks in the config, which is where its `addSessionTrackConf` lands them — a
desktop config.json is the one user's own file, so the two scopes coincide.

So this is the inverse of `planWebExport`, not a decode, and it needs three
translations before the snapshot is applied:

1. `sessionTracks` hoisted into the desktop config under the same trackIds, so
   the views' references resolve.
2. `trackConfigDeltas` merged onto the tracks they customize — they are how a
   hosted-base export carries per-track edits, and web merges them on receipt.
3. `sessionPlugins` put through `assertPluginsTrusted` before any of it, for the
   reason every other remote-config route is (ADR-038). Not merely dropped: a
   session that needed a plugin should say so rather than open half-working.

`loadSessionSpec` already does all three for a *spec*, which is the reuse to
reach for — but a snapshot carries view state a spec cannot express (scroll
offsets, display state, filters), so the shape is "hoist the tracks and vet the
plugins, then apply the snapshot", not "convert to a spec".

Start with `encoded-`/`json-`: self-contained, no network, no key, no third-party
store in the test matrix. `share-` is that plus a fetch and a decrypt.

Whatever ships must **fail loudly on a key it cannot translate** rather than
inheriting MST's silent drop — that is the actual bug hiding behind this feature.

Half of that loudness has since landed, at the link level rather than the
snapshot level: `parseSessionSpecUrl` matches `share|encoded|local|json` and
throws naming the kind ("only the JBrowse Web instance that created it can open
it"), so a user pasting one now gets a sentence instead of nothing. That is the
diagnostic, not the feature — the three translations above are still the work,
and the silent `sessionTracks` drop is still what happens the moment a snapshot
does get applied.

---
name: web-share-link-in-desktop
description: Desktop cannot open the share-, encoded- and json- links web's share button makes. Since Desktop's session took sessionTracks and trackConfigDeltas (2026-09-23), a web snapshot applies whole except `sessionPlugins` and `sessionConnections`, so the work is a decoder, vetting those plugins, a home for the connections, and a loud failure on any other key.
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

**The shape is now one key off.** Measured 2026-08-11, a web snapshot applied to
a desktop root model dropped `sessionTracks`, `trackConfigDeltas` and
`sessionPlugins` in silence, because MST drops snapshot keys the target does not
declare. Since `130e41de08` (2026-09-23) Desktop's session composes the same
`SessionTracksManagerSessionMixin`, so the first two carry across as they are.
`sessionPlugins` and `sessionConnections` (web-core's `SessionConnections`) are
still undeclared on Desktop. Dropping the plugins opens a session half-working,
so put them through `assertPluginsTrusted` (ADR-038) and load them before
applying the snapshot, the way `loadSessionSpec` vets a spec's plugins; the
connections need a home in Desktop's session or a translation.

Whatever ships must **fail loudly on a key it cannot translate** rather than
inheriting MST's silent drop — that check is what finds the next key a web
session grows.

Start with `encoded-`/`json-`: self-contained, no network, no key, no third-party
store in the test matrix. `share-` is that plus a fetch and a decrypt.

`parseSessionSpecUrl` already matches `share|encoded|local|json` and throws
naming the kind ("only the JBrowse Web instance that created it can open it"),
so a pasted link gets a sentence rather than nothing. That is the diagnostic,
not the feature.

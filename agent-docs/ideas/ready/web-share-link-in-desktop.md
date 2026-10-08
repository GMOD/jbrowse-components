---
name: web-share-link-in-desktop
description: Desktop opens encoded- and json- links since 2026-10-08 but not the short share- links web's share button makes by default, and it refuses a session carrying its own connections. The work left is a fetch and a decrypt for share-, and a home for sessionConnections.
---

# Opening a web share link in Desktop

Desktop reads `session=spec-`, the `&assembly=`/`&loc=` shorthand, `&hubURL=`,
and a link that carries its whole session: `encoded-<b64>` (compressed inline)
and `json-<json>`. `launchInlineSession`
(`products/jbrowse-desktop/src/components/StartScreen/launchFromLink.ts`) decodes
the snapshot and hands it to the config as its `defaultSession`. Two things are
still out.

**`share-<id>`**, the uploaded and encrypted form the share button makes by
default. The transport is not the obstacle: `readSessionFromDynamo` is in
`@jbrowse/core/util/sessionSharing`, Desktop already imports that module for
export-to-web, and it already runs `aesEncrypt` there, so WebCrypto works in that
renderer. A `share-` link needs the fetch, the decrypt with the link's
`password=`, and then the same `launchInlineSession`. Until it lands the
ShareDialog has no "Open in Desktop" button, and `parseSessionSpecUrl` answers a
pasted `share-` link with a sentence naming the kind.

**`sessionConnections`** (web-core's `SessionConnections`) has no slot in
Desktop's session, so a link whose session carries any stops with an error
naming the count. They need a home in Desktop's session or a translation.

`sessionPlugins` is the other key Desktop's session does not declare; those join
the config's plugins once `trustPlugins` (ADR-038) has passed them. Any further
key Desktop's session does not take is reported on the opened session by name,
because MST drops an undeclared snapshot key in silence. That report is what
finds the next key a web session grows.

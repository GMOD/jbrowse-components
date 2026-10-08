---
name: web-share-link-in-desktop
description: Desktop opens every link web's share button makes (share-, encoded-, json-) since 2026-10-08, except a session carrying its own connections, which it refuses. What is left is a home for sessionConnections.
---

# Opening a web share link in Desktop

Desktop reads `session=spec-`, the `&assembly=`/`&loc=` shorthand, `&hubURL=`,
and a link that hands over a whole session: `share-<id>` (uploaded, encrypted),
`encoded-<b64>` (compressed inline) and `json-<json>`. `launchSessionSnapshot`
(`products/jbrowse-desktop/src/components/StartScreen/launchFromLink.ts`) fetches
the link's config, gets the snapshot, and hands it to the config as its
`defaultSession`. A `share-` snapshot comes from the share service that config
names (`shareURL`, relative to the page the link points at), decrypted with the
link's `password=`.

One thing is still out.

**`sessionConnections`** (web-core's `SessionConnections`) has no slot in
Desktop's session, so a link whose session carries any stops with an error
naming the count. They need a home in Desktop's session or a translation.

`sessionPlugins` is the other key Desktop's session does not declare; those join
the config's plugins once `trustPlugins` (ADR-038) has passed them. Any further
key Desktop's session does not take is reported on the opened session by name,
because MST drops an undeclared snapshot key in silence. That report is what
finds the next key a web session grows.

Not exercised against the live share service or in a packaged app as of
2026-10-08: the tests stub the service's response.

---
status: Accepted
summary: "A display given a config key it does not declare draws without it and names the key on the console, once per message (`closed: 'warn'`), and `DisplayType` registers a display whatever its schema says. Supersedes ADR-214's refusal: a refused key cost the whole track in a config written for another version, and the registration check stopped the app on any plugin display that had not opted in. `closed: true` still refuses, on the channel objects ADR-133 closed"
---

# ADR-217: A display names a key it does not declare, and draws

## Status

Accepted (2026-10-07). Supersedes the refusal and the registration check of
[ADR-214](adr-214-a-display-refuses-a-key-it-does-not-declare.md).
[ADR-133](adr-133-a-channel-objects-slots-are-each-valid-alone.md)'s closed
channel objects are unchanged.

## Context

ADR-214 closed every display's config schema, so a key a display did not
declare failed the track's load, and made `DisplayType` throw on a schema that
was not closed. A review the same day found the rule cost more than the typo it
caught:

- **One plugin display stopped the app.** `createPluggableElements` does not
  isolate a plugin, so the hosted graph plugin's `LinearGraphDisplay`, built
  before the rule, failed every session that loaded it. Fifteen figure captures
  failed for that reason, and the ARG plugin and Apollo's three displays would
  have failed alike.
- **A config written for another version lost its track.** A v4 wiggle display
  entry carrying `minScore` has no slot and no retired lift, so the track was
  dropped where it had drawn autoscaled. After 5.0, any display key a 5.x minor
  adds would drop that track on every 5.0 desktop, pinned embed and old share
  link, and jb2hubs writes display keys into configs several versions read.
- **The rule covered one door of five.** A settings bag (session spec, share
  link, agent) already kept the track and named the key in a notice;
  `displayDefaults` already warned on the console; tracks, adapters and session
  display state stayed open.
- **The notice did not name the key.** "Removed N tracks that could not be
  loaded" names the track, and the key reached only the console.

## Decision

- **`closed` takes `'warn'` beside `true`.** `true` refuses the snapshot, as the
  channel objects do. `'warn'` writes `X does not declare d: loading without
  it` to the console once per message and lets the key drop.
- **Every display's schema is `closed: 'warn'`**, inherited from
  `baseLinearDisplayConfigSchema` or declared on the standalone ones.
- **`DisplayType` registers any schema.** A plugin display that declares
  nothing drops an undeclared key in silence, as it did before v5.

## Consequences

- A misspelt display key draws the track without the setting and names the key
  on the console; `jbrowse validate` reports it offline, as before.
- A 5.0 app draws a track whose display entry carries a key a later minor adds.
- The validator's schema marks a def `x-closed` only where the schema refuses.

## Rejected alternatives

- **Refuse in-tree, warn for plugins.** It fixes the outage and keeps the
  version problem.
- **A notice on screen for every door.** The check runs while a snapshot is
  preprocessed, before a session exists to notify, and the `displayDefaults`
  door already answers on the console.

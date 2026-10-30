---
name: site-wide-track-type-defaults-from-config
description: An admin cannot set a default for every track of a type (every FeatureTrack purple, height 150) in config.json; only per-track `displayDefaults` exists. A static `configuration.trackTypeDefaults` keyed by track type, compiled once at startup into track-scoped display variant schemas (ADR-172's mechanism made general), is feasible and avoids everything that sank ADR-111. A `Core-preProcessTrackConfig` plugin seeding `displayDefaults` is the tempting version and is declined. Waits on whether the need is real, mostly tracks the admin cannot edit (hubs, connections, user-added tracks).
---

# Site-wide track-type defaults from config

Not committed work. Today a default reaches a track only through that track's
own `displayDefaults` or `displays`, or through code: ADR-172's
`MultiQuantitativeTrack/displaySchema.ts` swaps in a `LinearWiggleDisplay`
schema with different slot defaults. Nothing in `config.json` sets a default
for every track of a type.

## What ADR-111 does and does not cover

ADR-111 backed out a user-editable layer: the pin, the localStorage preference
keyed by display type, bakes at three serialization boundaries,
`ignorePromotedDefaults`, apply-to-open-tracks. An admin tier was sketched once
(629e4583b0, a frozen `preferences.displayTypeDefaults` read in
`getDisplayTypeDefault`) and deleted with the subsystem, unjudged. A static
admin tier needs none of the backed-out machinery: a share link opens on the
same site with the same `config.json`, so nothing has to be baked.

Two lessons still bind it:

- At-default and unset are the same bytes once stripped (ADR-063). A default
  that is not the schema's own default cannot survive a round trip.
- No read-time cascade in `getConf` (ADR-046 measured ~60% on every read).

## Declined: a `Core-preProcessTrackConfig` plugin

Merging `{ ...siteDefaults[snap.type], ...snap.displayDefaults }` in a runtime
plugin is ADR-172's deleted seed, shipped as advice. Traced from code, not run:

- A session track or Copy track whose user sets the stock default gets the site
  default back on hydration (ADR-172's BEFORE/AFTER).
- A config.json track edit to the stock default is stored as a `null` in the
  delta (`trackConfigDelta.ts`), and re-creation re-seeds the site value.
- An admin's per-track opt-out (`height: 100` on one track) holds only while
  the track has no delta; editing any other setting merges over a hydrated,
  stripped base (`SessionTracks.ts`) and the height jumps to the site value.
- A site key no display takes fails every track of the type
  (`expandTrackConfigShorthand.ts` refusal), and every track pays the router
  probe ADR-134 confined to tracks writing `displayDefaults`.

## The shape that works

- `configuration.trackTypeDefaults: { [TrackType]: <displayDefaults object> }`,
  read once when the PluginManager is constructed; changes take a reload.
- Keyed by track type, in the per-track `displayDefaults` vocabulary, routed by
  the ADR-134 router once at startup. Not by display type: `LinearWiggleDisplay`
  serves both quantitative track types, and display keys collide with ADR-172.
- Compiled into track-scoped display variant schemas by a core helper that
  generalizes `multiQuantitativeDisplaySchemas`; a track type's in-code
  defaults and the admin's merge into the same variant, admin on top.
  Precedence is then the schema's: track value, admin default, code default.
  Stripping, the delta base, reset and the Edited badge all agree.
- A key no display takes warns once at startup and is dropped.
- No UI, no session or localStorage state, no read-time lookup, no bakes.

Costs:

- A slot's default is baked into its MST type (`configurationSlot.ts`), so it
  must be variant schemas. `createBaseTrackConfig` has no track-type name; the
  12 in-tree track schemas would build `displays` through the helper, and an
  external track type that does not gets nothing (warn on load).
- Nested sub-schemas need generic derivation (ADR-172 built `Rows` by hand),
  and an object a display writes whole (ADR-236) takes its whole object as the
  default.
- The value is threaded through each product's PluginManager construction
  (web, desktop, react-app, react-LGV, react-CGV, react-app2).
  `jbrowse-img`'s `renderRegion.ts` drops unknown `configuration` keys and
  needs a pass-through.
- `DisplayConfigurationReference` already resolves by displayId then type, so
  display models need no change; union probing dispatches on `type` and
  same-named schemas already exist under ADR-172.

Tests to pin it: ADR-172's round trip, a session track, the config.json
delta-reset path, and the per-track opt-out after an unrelated edit. Lands as
an ADR amending ADR-172, not a revival of ADR-111.

Unverified, inferred from code: whether the config.json delta snaps back
immediately or only on reload, and whether any worker path re-creates a display
schema from a stripped snapshot.

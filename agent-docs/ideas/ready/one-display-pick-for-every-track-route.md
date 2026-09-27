---
name: one-display-pick-for-every-track-route
description: A view picks a track's display off a hand-built candidate list (declared entries, then the track type's filtered list) beside the one the track config node already builds. Colin's calls of 2026-09-27 - a declared display is settings, never a cross-view pick; every route opens a track the same way. Half a day - pick from the node's own list, collapse the ladder, make the track selector capability-aware. Open behind it - one setting for several display types, where a chord display refuses a field-mapped colour.
---

# One display pick for every track route

## Where it stands

A track config's `displays` list does two jobs: each entry carries settings
for one display type, and its order is the default a view opens the track with.
Until 2026-09-27 a `LinearMarkDisplay` entry written to style a BEDPE track's
links also made the circular view open it as a ring instead of chords.
`71dccb94c2` fixed that by trying the view's own display types before a
declared display the view only inherits (only the circular view inherits,
through `extendedName`), the rule ADR-119 already stated. `2de13c0bdd` then
filtered the fallback by adapter capabilities, since the reorder had sent the
graph plugin's `GraphTrack` on an `RgfaTabixAdapter`
(`test_data/graphgenomeview/pangenome_nonhuman.json`) to a chord ribbon its
adapter cannot feed.

Both routes now pick the same display. What differs is the snapshot's form: an
unhydrated one (config.json's frozen entries, a session spec's loose inline
conf) carries only what it declared, and a hydrated one (a Web session track, a
connection track, a catalog track after its first edit through `withDelta`)
lists every display the adapter feeds. Every entry point (`jb` open and
launchTrack, `jb.addTrack`, jbrowse-img, the embedded products) goes through
`resolveTrackDisplayChoice` (`packages/core/src/util/tracks.ts`), so there is
one picker reading two list shapes, with a four-rung ladder reconciling them.

## Colin's calls (2026-09-27)

- **A declared display is settings.** Writing settings for one display type
  never changes which display another view opens. Within one view the listed
  order still chooses between two displays that view draws natively
  (alignments vs marks on the linear view).
- **Every route opens a track the same way.**
- **SNPs need nothing on the circle.** A VariantTrack opens as chords; a record
  with one locus draws none, and breakends, DEL, INV, DUP, CNV and TRA draw
  between their two loci (`svKinds.test.ts`).

## The work, about half a day

1. Pick from the list the track config node builds. `resolveTrackDisplayChoice`
   already calls `trackType.configSchema.create(conf)` on every unhydrated conf
   and throws the node away; `getSnapshot(node).displays` is the declared
   entries, then every display the adapter feeds, with the retired-name
   migration and dedupe a loose inline conf skips today. The separate
   `Core-preProcessTrackConfig` call goes, since `create` runs it.
2. Collapse `pickDisplayForView` to `candidates.find(own) ?? candidates.find(supported)`,
   and check a requested type against the candidates. Declared entries lead the
   list, so within one view the listed order still decides.
3. Make `viewCanDisplayTrack` and `filterTracks` read the adapter's
   capabilities too, or the selector offers a track whose every drawable display
   the adapter cannot feed, and opening it errors. Their docstring's "the two
   agree" is the claim to fix.

Tests that move: `tracks.test.ts`'s `pickDisplayForView` cases (its signature
loses `trackDisplayTypes`), `ringTypes.test.ts`, and
`displayAdapterCapabilities.test.ts`. The website recipe builder
(`website/src/lib/spec-recipe/recipe.ts`, "a sole declared display settles it")
encodes the old rule and changes with it. No jbrowse-web suite asserts this
pick.

## Open behind it

Colin, 2026-09-27: "we may want to brainstorm a generalizable way to help
express changes across display types. the displaydefaults is one option...kind
of a hazy one because it sort of assumes that you are just trying to customize
the linear primarily". `displayDefaults` already routes each key to every
display of the track type whose slot takes the value, chord displays included
(`expandTrackConfigShorthand.ts`). What reads linear-first is the value
vocabulary: `ChordVariantDisplay`'s `color` is a plain `color` slot, so
`displayDefaults: { color: { field: 'type' } }` reaches the linear displays and
silently skips the chords. Two directions to bring him, neither decided:

- **Converge the vocabulary.** Give the chord displays' colour the same
  `{ field, domain, range }` colour object the linear displays take, so one
  setting reaches every display that draws the channel. Start from a table of
  which shorthand keys reach which displays per track type
  (`collectDisplayOverrides` computes each display's verdict).
- **Report a partial reach.** When some displays take a key and others refuse
  it, say which. Today a refusal is reported only when every display refuses.

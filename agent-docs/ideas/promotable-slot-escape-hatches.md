---
name: promotable-slot-escape-hatches
description: Three seams left after v5 moved the synteny ribbon settings onto the display config — a view-level control that badges a track edited, a promotable checkbox with no in-place reset across 22 slots, and one menu writing two persistence axes. Read before adding another promotable checkbox.
---

# Promotable slots: the ways back out

`9539cd3d14` removed the `LinearSyntenyView` override tier and made
`drawCurves`/`drawLocationMarkers` ordinary promotable config slots, so the
cascade is the only mechanism and its whole toolkit reaches them. That closed
the defect it set out to close: the settings checkbox could previously only
write `true`/`false` to a view property, and its first click detached the view
from every pinned default for good.

Three seams are left. They interlock through one question — what a user does to
get back out of a value they set — so weigh them together. The master doc is
[reference/DISPLAY_TYPE_DEFAULTS.md](../reference/DISPLAY_TYPE_DEFAULTS.md);
the sibling proposal on generated UI and an admin tier is
[promotable-slot-ui.md](promotable-slot-ui.md), and §2 below is the part of it
that is now measured rather than estimated.

## 1. A view-level control badges a track as edited

Ticking **Curved lines** in the synteny view's settings menu writes a config
slot on every synteny display the view shows, which is a session track-config
delta, which lights the "Edited — click to view the changed settings" pencil in
the track selector (`OverrideBadge.tsx:94`). For every other promotable setting
that badge is honest: the user opened *that track's* menu and changed *that
track*. Here they opened a **view** menu and a **track** picked up a pencil.

Nothing is wrong mechanically, and the alternative that avoids it — keeping
view-local state — is what v5 deleted for good reasons. The open question is
whether a fan-out write from a view-level control should count as a per-track
edit for badge purposes, or whether the badge should describe the settings a
user changed *on a track's own surface*. Answering it needs a decision about
what the badge is FOR, not new machinery.

A related asymmetry worth resolving in the same pass: the badge's "clear session
default" action deliberately scopes itself to the slots the dialog listed, and a
slot the track customized over appears in no row while still governing sibling
tracks.

## 2. A promotable checkbox cannot un-customize itself

Measured across the tree: **22 distinct promotable slot names over 31
declarations**. Which of them a user can return to the inherit state, and where:

| Row kind | Reset in place? |
| --- | --- |
| Slider (`makePromotableSizeMenu`) | Yes — the row carries one, derived from `isSlotCustomized` |
| Checkbox (`promotableToggleItem`) | **No** — `SettingRowOptions` has no `onReset` |
| Radio group (`promotableRadioItems`) | **No** — picking the base value still customizes |

So a user customizes a boolean from a track menu and can only un-customize it
from the Configuration editor, a different and more technical surface, whose
reset button is the general escape hatch (`SlotEditor.tsx:206`: "a promotable
slot's default is its inherit sentinel, so resetting it here doubles as un-pin /
follow the session-wide default"). `colorBy` is the one slot with a bespoke
unset, in the SV-channels preset's exit path.

**The subtle half**, and the reason "click it back to how it was" does not
work: `resolveSlot` sets `customized = isUsableValue(def, own)`
(`promotableResolve.ts:197`), so holding *any* usable value counts — including
one equal to `promotedBase`. Unticking a box back to its base leaves the track
customized and pinned against every future promoted default. That is invisible
at the moment it happens, because the picture does not change.

`promotableToggleItem` is the single site that would give all three row kinds a
way home at once, which is what makes this worth doing as one change rather than
per menu.

## 3. One menu, two persistence axes

The synteny settings menu now has two rows writing track configuration
(`drawCurves`, `drawLocationMarkers`) and roughly seven writing view state
(identity fade, thin fade, opacity, colorBy, cigar mode, offscreen mates, …).
A reader cannot tell them apart, and they persist differently: a config delta
survives into the track's authored shape and the share bake, while view state
lives in the session snapshot.

This is the cost v5 accepted knowingly. It is recorded here because the next
person adding a row to that menu has to pick an axis, and there is currently
nothing at the call site that says which one the row wants.

## 4. Five generated demo configs badge on load

`hpylori`, `primate_selection`, `grape_peach`, `sv_multihop` and the ecoli
graph/synteny scripts pass `drawCurves: true` as an init key. The init command
writes the slot on the tracks the launcher opens — which marks those tracks
edited on every load. The badge-free authoring shape is the value in the track
config's own `displays` block instead.

The key only reaches that command from inside `init`. `grape_peach` spelled it
as a sibling of `init`, i.e. a view snapshot property, which MST drops without a
word — the demo rendered straight chords until this doc's own audit caught it.
A generated config is where that typo survives longest, because nothing renders
it during the build.

Cosmetic, and a mechanical conversion, but it touches generated configs, so it
wants the generator changed rather than the output. `demos/ecoli_pangenome`
already dropped its explicit value for the opposite reason: under `stripDefault`
that `false` meant unset, and carrying it into v5 would stamp a delta on every
visitor and override their own pinned default. The figure specs keep theirs
deliberately, so captures stay straight whatever the environment holds.

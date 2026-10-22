---
status: Accepted
summary: "Every color object is in one of three states: unset (the display's default, its `impliedField` where its schema declares one), a constant `value`, or a `field`, which always paints. `scale: 'none'` goes. The field a write leaves is display state (`ParkedColorMixin`), parked by an action middleware in the write's own batch, so Default and back restores its domain, range and names and refetches nothing. Every Color by block offers Solid color...; the radio that unset paints is ticked by unset, the implied field's own radio where there is one, so LGVSynteny's Normal and the ribbons' Default go. LGVSyntenyColor's `field: 'strand'` default and the circular view's `query` default become implied fields. Builds ADR-240 amendment 4"
---

# ADR-241: A color object is unset, a value or a field

## Status

Accepted (2026-10-22). Builds ADR-240's amendment 4 into every display. An
Opus review of the rule against every Color by menu shaped it.

## Context

`scale: 'none'` let a color object hold a field that did not paint, so Color by
→ Default and Solid color... could keep it for the way back. Every reader then
checked for a field under `none`, and the config carried UI memory. ADR-240
removed it for the alignments display and named the field Default leaves as
display state; the other displays still wrote it, and two of them (LGVSynteny,
the multi-way ribbons) had a default field with a no-field radio beside it that
only `none` could spell.

## Decision

- **Three states.** Unset paints the display's default: the field its schema's
  `impliedField` names (wiggle `score`, the ribbons and LGVSynteny `strand`,
  the circular view `query`), else the track's own color. `value` is the
  constant. A written `field` always paints. No combination makes a written
  field wait unread.
- **Default writes unset**, in every menu. Where the display has an implied
  field, that field's radio is the one unset ticks, and there is no separate
  no-field radio: LGVSynteny's Normal and the ribbon menu's Default go.
- **Every Color by block offers Solid color...**, the only route to a flat
  color: alignments and LGVSynteny, the dotplot, linear synteny and circular
  views, the multi-way ribbons, beside the feature, variant, chord and gene
  blocks that had it.
- **The field a write leaves is display state.** `ParkedColorMixin(slot,
  writtenOf)` keeps it in `parkedColors`, keyed by color object, and
  `colorForField(current, field, parked)` gives its members back. An action
  middleware compares the written object across the model's outermost action,
  in one MobX batch with it, so every write path parks alike (menus, Group by,
  the Tag and field dialogs, Edit plot) and no observer sees the field gone
  unparked. A reaction parked a batch late, and the variant cells dropped their
  payload in between.
- **Readers of the parked field:** the variant cells and the canvas worker
  still read its values (`keptField`, the `rpcProps` color field), so Default
  and back refetches nothing; the Attribute dialog opens on it.
- `baseColor` holds a field alone, so its `scale` slot goes with nothing to
  park; `pileup.bases.show` comes with ADR-240's move of `baseColor` under
  `pileup.bases`.

## Rejected

| Proposal | Why not |
|---|---|
| Default writes the display's plain color as `value` | Each display would need its own "plain color", and LGVSynteny's is a theme color a constant would freeze |
| An explicit `field: ''` meaning no field | Leans on `''` against unset, which `stripDefault` erases |
| Parking in a reaction | Fires after the write's batch; the variant cells' settings autorun dropped the payload in between |
| Parking explicitly in each writer | Five writers bypass the menus through `applyPlot`; one middleware covers them |

## Consequences

- A config writing `{ value, field }` paints the field. Alignments and the
  ribbons still read `value` beside a field as the no-value fill until ADR-240's
  channel step moves it to the missing-value scale member; then `value` and
  `field` never share an object.
- A beta session holding `scale: 'none'` fails to load its color; no lift.
- A write from outside the display's own actions parks nothing: the config
  editor, `applyConfSettings` (a session spec, share link or agent bag) and a
  second display of the same track. Its way back starts from the field's
  defaults, and the canvas and variant fetch keys move with it.
- Wiggle's one-color swatch writes the plain string and parks the threshold it
  replaces, so splitting the sides again restores the cut, labels and title.

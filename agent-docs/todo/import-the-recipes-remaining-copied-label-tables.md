---
name: import-the-recipes-remaining-copied-label-tables
description: check each registry's module for a React import; a leaf is importable today
metadata:
  area: website, menus
  category: ready
---

# Import the recipes' remaining copied label tables

`website/src/lib/spec-recipe/fields.ts` names menu labels in the click paths
shown beside every doc figure and gallery card. Half its tables import the app's
own `[value, label]` registry and cannot drift; the other half retype the labels,
and every wrong label found so far was in a copy — "Gene glyph mode" for "Gene
glyph", "Arcs"/"Read cloud" for "Show read arcs"/"Show read cloud", "Finer /
Coarser" for a control that is two buttons. `check-spec-recipes` catches these
now, but a copy that cannot drift needs no catching.

**The criterion is whether the registry's module is a leaf.** The node script
that builds the recipes cannot load a module importing React, MUI or a lazy
`.tsx`, which is why `DEFAULT_AUTOSCALE_OPTIONS` had to move out of
`scoreMenuItems.ts` into `autoscale.ts` before it could be imported —
that move is the worked example, and `ARC_DISPLAY_MODE_OPTIONS` is the case that
needed nothing.

**The three that cited an unexported registry are done**, and all three needed
the extraction rather than an export, as expected — every one of their modules
imports MUI. `arcColorOptions` became `shared/arcColorOptions.ts` (which now also
feeds the config schema's `types.enumeration`), `displayModeOptions` and
`SUBFEATURE_LABEL_OPTIONS` became `RenderFeatureDataRPC/displayModes.ts`, and two
more went with them for free: `SHOW_LABELS_OPTION_LABELS` into the leaf
`showLabelsMode.ts` already beside it, and the synteny view's `CIGAR_MODES` into
`LinearSyntenyView/cigarModes.ts`.

The rest of the ~20 tables have no cited registry at all, and several are not
convertible in principle — the `GRAPH_*` tables name controls in a plugin this
repo does not build, and the config-slot names under `Track menu → Settings` are
generated form fields rather than labels. `SETTINGS_POPOVERS` is not one of them:
it is `SETTINGS_SURFACES` since `d2b71b3a48`
(`website/src/lib/spec-recipe/fields.ts:1465`) and both its labels are in this
repo — `'Synteny display settings'` at `SyntenySettingsMenu.tsx:91`,
`'Dotplot display settings'` at `DotplotSettingsMenu.tsx:54` — so it is
convertible under the criterion above, as an extraction rather than an export,
since both modules import MUI. Read the comment above each table before assuming
one is available; the ones worth doing say where their labels came from.

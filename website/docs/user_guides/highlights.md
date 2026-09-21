---
title: Highlights
description: Marking genomic regions and returning to them
guide_category: General usage
---

A highlight is a translucent band over a genomic region. Every linear genome
view (LGV) and dotplot showing the region's assembly draws it, and the session
saves it, so a shared link carries it. The highlight list, opened from **Tools →
Highlights** or **Open highlight list** in an LGV's menu, holds every highlight
with a link back to it.

## Making a highlight

- Drag across the scalebar at the top of an LGV and pick **Highlight region**.
- On a dotplot, drag a rectangle and pick **Highlight region**: the horizontal
  span bands the horizontal axis and the vertical span the vertical one.
- Press `Ctrl`/`Cmd` + `Shift` + `D` to highlight the region in view.
- Import a BED or TSV file from the highlight list's menu.
- Pass them in a URL, a session or code, [below](#setting-highlights-in-code).

<Figure caption="Drag across the top of an LGV and pick 'Highlight region.'" src="/img/highlight_list_create.png"/>

<Video src="/media/ui/highlight_region.mp4" caption="A span of PTEN selected on the scalebar and highlighted, the highlight list opened from the view menu, the row named, and the view sent elsewhere on chr10 before the row's link brings it back to the highlighted span." />

## The highlight list

- The link in the Location column navigates the focused LGV on that assembly, or
  opens one, zoomed out a little for context. `Ctrl`/`Cmd` + `Shift` + `M`
  navigates to the newest highlight.
- Click a Label cell and type to name a highlight. **Show… → Show highlight
  labels** in an LGV's menu shows or hides the names on the bands.
- The Color column sets a band's color. Tick rows to recolor or delete several
  at once.
- The list shows the highlights on an assembly some open view is showing, and
  says how many others it is hiding.

<Figure caption="A label typed into the highlight list names the band on the LGV." src="/img/highlight_list_edit_label.png"/>

## Showing, hiding and removing

**Show highlights** hides or shows the bands in every view at once. An LGV has
it under **Show…**, a dotplot at the top of its menu, and the list in its own
menu. Making or recoloring a highlight shows them again.

A band's chip menu has **Dismiss highlight**. In the list, tick rows and press
the delete icon.

## Export and import

Export writes the ticked highlights, or every listed one, as BED (one file per
assembly, 0-based starts) or TSV (one file with an `assembly_name` column,
1-based starts). Import reads either and adds to the list; a BED file takes the
assembly picked in the dialog.

## Setting highlights in code

Each form below takes a locstring or an object; an object adds `color` (used
as-is, alpha included) and `label`, and an entry without `assemblyName` takes
the view's assembly.

**In a URL**, [`&highlight=`](/docs/urlparams#highlight) beside `&assembly=` and
`&loc=`, several separated by spaces (`%20`):
[live link](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&assembly=volvox&loc=ctgA:1-20000&highlight=ctgA:5000-8000%20ctgA:12000-13000).

```text
&assembly=volvox&loc=ctgA:1-20000&highlight=ctgA:5000-8000
&highlight={"refName":"ctgA","start":5000,"end":8000,"color":"rgba(240,128,128,0.3)","label":"my region"}
```

**In a session spec or `defaultSession`**, as `highlight` on a view. The dotplot
takes the same key ([dotplot highlights](/docs/urlparams#dotplot-highlights)):

```json
{
  "views": [
    {
      "type": "LinearGenomeView",
      "assembly": "volvox",
      "loc": "ctgA:1-20000",
      "highlight": ["ctgA:5000-8000"]
    }
  ]
}
```

**In a saved session**, the session's `highlights` list, where each entry names
its assembly:

```json
"highlights": [
  { "assemblyName": "volvox", "refName": "ctgA", "start": 5000, "end": 8000, "label": "my region" }
]
```

**In an embedded LGV or from a plugin**, `highlight` in `createViewState` at
launch ([](/docs/embedded_components)); after that, `session.addHighlight` takes
an object like the one above, `session.setHighlights` replaces the list (`[]`
clears it), and `removeHighlight` and `updateHighlight` take an entry of
`session.highlights`. A view's `highlights` lists the ones on its own
assemblies. The [BaseSessionModel reference](/docs/models/basesessionmodel) has
the rest.

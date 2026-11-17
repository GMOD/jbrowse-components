---
title: Hierarchical track selector
description: Track grouping and display options for the hierarchical selector
guide_category: Appearance
---

Control track grouping, sorting, and collapse with `hierarchical` settings under
`configuration`. Add a `metadata` object to any track to gain filterable columns
in the faceted selector.

Tracks appear in config.json order unless the `hierarchical` settings change it.
[](/docs/config/hierarchicalconfigschema) lists every slot; the ones people set:

```json
{
  "configuration": {
    "hierarchical": {
      "sort": {
        "trackNames": true,
        "categories": true
      },
      "defaultCollapsed": {
        "categoryNames": ["VCF"],
        "topLevelCategories": true,
        "subCategories": true
      },
      "defaultFolderCategories": ["Wiggle", "Alignments,Coverage"]
    }
  }
}
```

- **A nested category is a comma-joined path** in `categoryNames` and
  `defaultFolderCategories` (`"Wiggle,Wiggle Rendering Styles"`).
- **`defaultCollapsed` and `defaultFolderCategories` apply on first load only.**
  Afterwards the user's own choice is kept in their session.
- **Typing in the filter box opens every category** while the query is active,
  so a match inside a collapsed category or a folder still shows. Clearing the
  box restores what was collapsed.

<Figure caption="All top-level categories collapsed." src="/img/hierarchical/collapse_toplevelcategories-fs8.png"/>

<Figure caption="The same options in the track selector's menu." src="/img/hierarchical/hierarchical_user_menu-fs8.png"/>

## Folder categories (supertracks)

A folder category replaces the whole category with one row showing how many of
its tracks are on; clicking it opens a faceted selector scoped to that category.
Users switch any category between folder and list from its context menu ("Show
as folder" / "Show as list"). Top-level group rows (the config's own tracks, and
each connection) cannot become folders, since clicking a connection's row loads
it. Plugins replace the folder dialog through
[`TrackSelector-folderDialog`](/docs/developer_guides/extension_points#trackselector-folderdialog).

## Faceted track selector

The faceted selector shows all tracks as a filterable table, opened from the
Tree | Table toggle at the top of "Available tracks" or a folder's context menu.
Every top-level key of a track's `metadata` object can be a column to filter or
sort on, as in the
[cookbook's metadata track](/docs/cookbook#instance-wide-settings).
[](/docs/user_guides/basic_usage#faceted-track-selector) covers the filter
panel.

Beside the name, the table shows as many columns as fit its width, with no
sideways scroll. By default those are the fields that sort tracks into groups:
category, kind, and each metadata key with at least two values that are each
shared by two or more tracks, and no more values than half the tracks that have
one. A per-track URL or description, a flag every track but one shares, or a key
that only repeats another column (a file format that always matches the kind) is
left out. The user's Manage columns choices override this either way. The filter
panel opens the filters for the first three of these columns and lists the other
grouping fields collapsed below them.

Where a hub's metadata has many keys of which a few matter, name them, most
important first, with `hierarchical.table.columns`. The table shows these first,
then fills any remaining room with the fields it would pick on its own, and
opens the filters for the first three:

```json
{
  "configuration": {
    "hierarchical": {
      "table": {
        "columns": ["metadata.assay", "metadata.biosample", "metadata.target"]
      }
    }
  }
}
```

An entry is `category`, `kind`, `description`, `adapter`, or `metadata.<key>`
for a top-level metadata key. `jbrowse validate` warns about an entry no track
in the config carries.

The kind column groups tracks by what they hold: the track type ("Alignments",
"Variant", "Quantitative") unless the track's `metadata.kind` says otherwise.
Set it where the type undersells the data, as for variants served as bigBed
features:

```json
{
  "trackId": "clinvar",
  "type": "FeatureTrack",
  "metadata": { "kind": "Variants" }
}
```

## See also

- [](/docs/user_guides/basic_usage)
- [Configuring tracks](/docs/config_guides/tracks)

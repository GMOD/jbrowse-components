---
title: Hierarchical track selector
description: Track grouping and display options for the hierarchical selector
guide_category: Appearance
---

**TL;DR:** control track grouping, sorting, and collapse with `hierarchical`
settings under `configuration`. Add a `metadata` object to any track to gain
filterable columns in the faceted selector.

Tracks appear in config.json order unless `hierarchical` says otherwise.
[HierarchicalConfigSchema](/docs/config/hierarchicalconfigschema) lists every
slot; the ones people set:

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

<Figure caption="Example showing all the top-level categories collapsed" src="/img/hierarchical/collapse_toplevelcategories-fs8.png"/>

<Figure caption="Screenshot showing that the end-user can toggle these options as well" src="/img/hierarchical/hierarchical_user_menu-fs8.png"/>

## Folder categories (supertracks)

A folder category replaces the whole category with one row showing how many of
its tracks are on; clicking it opens a faceted selector scoped to that category.
Users switch any category between folder and list from its context menu ("Show
as folder" / "Show as list"). Top-level group rows (the config's own tracks, and
each connection) cannot become folders, since clicking a connection's row is
what loads it. Plugins replace the folder dialog through
[`TrackSelector-folderDialog`](/docs/developer_guides/extension_points#trackselector-folderdialog).

## Faceted track selector

The faceted selector shows all tracks as a filterable table, opened from the
filter icon in the "Available tracks" widget or a folder's context menu. Every
top-level key of a track's `metadata` object becomes a column to filter or sort
on, as in the
[cookbook's metadata track](/docs/cookbook#instance-wide-settings), and columns
empty for every track are hidden.
[Basic usage](/docs/user_guides/basic_usage#faceted-track-selector) covers the
filter panel.

## See also

- [](/docs/user_guides/basic_usage)
- [Configuring tracks](/docs/config_guides/tracks)

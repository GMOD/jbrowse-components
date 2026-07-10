---
title: Hierarchical track selector
description: Track grouping and display options for the hierarchical selector
guide_category: Other features
---

By default, tracks appear in the order defined in config.json. The following
options control sorting and default collapse behavior.

- [`hierarchical.sort.trackNames`](/docs/config/hierarchicalconfigschema/#slot-configurationhierarchicalsorttracknames)
  — sort track names alphabetically

- [`hierarchical.sort.categories`](/docs/config/hierarchicalconfigschema/#slot-configurationhierarchicalsortcategories)
  — sort categories alphabetically (independent of track name sorting)

- [`hierarchical.defaultCollapsed.categoryNames`](/docs/config/hierarchicalconfigschema/#slot-configurationhierarchicaldefaultcollapsedcategorynames)
  — category names to collapse at startup. For nested categories, use a
  comma-joined path (e.g. `"Wiggle,Wiggle Rendering Styles"`)

- [`hierarchical.defaultCollapsed.topLevelCategories`](/docs/config/hierarchicalconfigschema/#slot-configurationhierarchicaldefaultcollapsedtoplevelcategories)
  — collapse all top-level categories at startup

- [`hierarchical.defaultCollapsed.subCategories`](/docs/config/hierarchicalconfigschema/#slot-configurationhierarchicaldefaultcollapsedsubcategories)
  — collapse all sub-categories at startup

<Figure caption="Example showing all the top-level categories collapsed" src="/img/hierarchical/collapse_toplevelcategories-fs8.png"/>

<Figure caption="Example showing all the sub-categories collapsed. The sub-category names remain visible as headers even when collapsed." src="/img/hierarchical/collapse_subcategories-fs8.png"/>

<Figure caption="Screenshot showing that the end-user can toggle these options as well" src="/img/hierarchical/hierarchical_user_menu-fs8.png"/>

Example config.json with examples of these hierarchical settings:

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
      }
    }
  }
}
```

Note: `defaultCollapsed` options only apply on initial startup — afterwards the
user's preference is preserved in their session.

## Folder categories (supertracks)

Categories can be displayed in "folder mode", which collapses the entire
category into a compact folder row. Clicking a folder opens a faceted track
selector scoped to just the tracks in that category.

- [`hierarchical.defaultFolderCategories`](/docs/config/hierarchicalconfigschema/#slot-configurationhierarchicaldefaultfoldercategories)
  — categories to display as folders at startup. Use the category name for
  top-level categories, or a comma-joined path for nested categories (e.g.
  `"Wiggle,Wiggle Rendering Styles"`)

Users can also toggle any category between folder and normal mode at runtime via
the category's context menu ("Collapse into folder" / "Expand to category").

Example config.json:

```json
{
  "configuration": {
    "hierarchical": {
      "defaultFolderCategories": ["Wiggle", "SNP/Coverage,Coverage"]
    }
  }
}
```

Note: Like `defaultCollapsed`, `defaultFolderCategories` only applies on initial
startup — afterwards the user's preference is preserved in their session.

For plugin developers: the category ID used internally is
`Tracks-{categoryPath}` (the full comma-joined path), which is the value matched
against in the `TrackSelector-folderDialog` extension point.

See the [hierarchical config schema docs](/docs/config/hierarchicalconfigschema)
for the full auto-generated reference, including each slot's type and default
value.

## Faceted track selector

The faceted track selector shows all tracks as a searchable, filterable table.
Open it by clicking the filter icon in the top right of the "Available tracks"
widget (or via a folder category's context menu).

Default columns shown for every track:

- **Name**
- **Category** (from `category` in the track config)
- **Adapter** (adapter type, e.g. `Gff3TabixAdapter`)
- **Description**

Columns that are empty for every track are hidden automatically.

### Adding metadata columns

Any `metadata` object in a track config adds extra filterable columns — one per
top-level key:

```json
{
  "trackId": "my_track",
  "name": "My Track",
  "metadata": {
    "origin": "public",
    "tissue": "liver",
    "date_added": "2024-02-20"
  }
}
```

With the config above, the faceted selector gains **origin**, **tissue**, and
**date_added** columns that can be used to filter or sort tracks.

The left-hand filter panel shows checkboxes for each distinct value in a column.
You can combine filters across multiple columns, and use the search box at the
top to further narrow results by name, category, or description.

## See also

- [Basic usage](/docs/user_guides/basic_usage) — using the track selector,
  favorites, and the faceted selector in the app
- [Configuring tracks](/docs/config_guides/tracks) — the track's `category`
  field that feeds this hierarchy

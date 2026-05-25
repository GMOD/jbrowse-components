---
id: track_selector
title: Hierarchical track selector
description: Track grouping and display options for the hierarchical selector
guide_category: Other features
---

By default, tracks appear in the order defined in config.json. The following
options control sorting and default collapse behavior.

- `hierarchical.sort.trackNames` - boolean - sort track names alphabetically.
  default: false

- `hierarchical.sort.categories` - boolean - sort categories alphabetically
  (independent of track name sorting). default: false

- `hierarchical.defaultCollapsed.categoryNames` - string array - category names
  to collapse at startup. For nested categories, use a comma-joined path (e.g.
  `"Wiggle,Wiggle Rendering Styles"`).

- `hierarchical.defaultCollapsed.topLevelCategories` - boolean - collapse all
  top-level categories by default. default: false

- `hierarchical.defaultCollapsed.subCategories` - boolean - collapse all
  sub-categories by default. default: false

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

- `hierarchical.defaultFolderCategories` - string array - categories to display
  as folders by default. Use the category name for top-level categories, or a
  comma-joined path for nested categories (e.g.
  `"Wiggle,Wiggle Rendering Styles"`). default: `[]`

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

For plugin developers: the category ID used internally is `Tracks-{categoryPath}`
(the full comma-joined path), which is the value matched against in the
`TrackSelector-folderDialog` extension point.

See the [hierarchical config schema docs](https://jbrowse.org/jb2/docs/config/hierarchicalconfigschema/)
for the full auto-generated reference.

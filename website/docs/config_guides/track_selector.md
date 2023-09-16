---
id: track_selector
title: Hierarchical track selector
---

import Figure from '../figure'

In v2.6.3 several options were added for configuring the hierarchical track
selector.

By default, the order of the tracks in the track selector tries to follow the
order of the tracks in the config.json.

- `hierarchical.sort.trackNames` - boolean - sort the track names
  alphabetically. default: false

- `hierarchical.sort.categories` - boolean - sort the categories alphabetically.
  this is separate from the track names sorting since conceptually you can sort
  the categories and track names separately. default: false

- `hierarchical.defaultCollapsed.categoryNames` - string array - array of
  category names to collapse at startup (comma-joined list of subcategory names
  if subcategories are used)

- `hierarchical.defaultCollapsed.topLevelCategories` - boolean - all the "top
  level categories" can be collapsed by default if true. default: false

- `hierarchical.defaultCollapsed.subCategories` - boolean - collapse all
  sub-categories by default. default: false

<Figure caption="Example showing all the top-level categories collapsed" src="/img/hierarchical/collapse_toplevelcategories-fs8.png"/>

<Figure caption="Example showing all the sub-categories collapsed. This can be useful to show all the sub-categories that are available without hiding them" src="/img/hierarchical/collapse_subcategories-fs8.png"/>

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
        "categoryNames": ["VCF"], // only collapse some categories on initial startup
        "topLevelCategories": true, // collapse all top level categories on initial startup
        "subCategories": true // collapse all subcategories on initial startup
      }
    }
  }
}
```

Note: The `defaultCollapsed` options only apply to the "initial startup",
afterwards, the "users preference" (their settings in their session) apply

See https://jbrowse.org/jb2/docs/config/hierarchicalconfigschema/ for more
auto-generated config schema docs

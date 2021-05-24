## 1.3.0 (2021-05-24)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/development-tools              | https://www.npmjs.com/package/@jbrowse/development-tools         |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-legacy-jbrowse          |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-protein                 |                                                                  |
| @jbrowse/plugin-rdf                     |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-trackhub-registry       |                                                                  |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#2001](https://github.com/GMOD/jbrowse-components/pull/2001) Make tracks added using the add track widget a session track if not in adminMode ([@cmdcolin](https://github.com/cmdcolin))
  - [#1980](https://github.com/GMOD/jbrowse-components/pull/1980) Add popup confirmation dialog for unknown session plugins, and use plugins.json as a whitelist ([@cmdcolin](https://github.com/cmdcolin))
  - [#1977](https://github.com/GMOD/jbrowse-components/pull/1977) Upgrade @material-ui/data-grid ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#1982](https://github.com/GMOD/jbrowse-components/pull/1982) Allow manually specifying adapter type if filename does not match expected pattern ([@cmdcolin](https://github.com/cmdcolin))
  - [#1975](https://github.com/GMOD/jbrowse-components/pull/1975) Allow local files on the users computer to be opened as tracks in jbrowse-web ([@cmdcolin](https://github.com/cmdcolin))
  - [#1865](https://github.com/GMOD/jbrowse-components/pull/1865) Show modified bases using MM and MP/ML tags in BAM/CRAM ([@cmdcolin](https://github.com/cmdcolin))
  - [#1984](https://github.com/GMOD/jbrowse-components/pull/1984) Better feature details when there are short arrays of json supplied as feature data ([@cmdcolin](https://github.com/cmdcolin))
  - [#1931](https://github.com/GMOD/jbrowse-components/pull/1931) Create in app graphical plugin store ([@elliothershberg](https://github.com/elliothershberg))

#### :bug: Bug Fix

- `core`
  - [#1985](https://github.com/GMOD/jbrowse-components/pull/1985) Avoid error calculating UTR on features that have no exon subfeatures ([@cmdcolin](https://github.com/cmdcolin))
  - [#1954](https://github.com/GMOD/jbrowse-components/pull/1954) Add more environments to configSchema create calls to fix ability to use custom jexl commands with main thread rendering ([@cmdcolin](https://github.com/cmdcolin))
  - [#1963](https://github.com/GMOD/jbrowse-components/pull/1963) Fix ability to use DialogComponent (used for svg export, pileup sort, etc) on embedded components ([@cmdcolin](https://github.com/cmdcolin))
  - [#1945](https://github.com/GMOD/jbrowse-components/pull/1945) Fix hic not being able to render due to incorrect lazy loading ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#1956](https://github.com/GMOD/jbrowse-components/pull/1956) Fix connection behavior ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1966](https://github.com/GMOD/jbrowse-components/pull/1966) Fix ability to use add-track force on symlink tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1951](https://github.com/GMOD/jbrowse-components/pull/1951) Fix breakpoint split view demo configuration on website ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2002](https://github.com/GMOD/jbrowse-components/pull/2002) Add @jbrowse/img to homepage ([@cmdcolin](https://github.com/cmdcolin))
- [#2007](https://github.com/GMOD/jbrowse-components/pull/2007) Update docs for modifications/methylation coloring, plugin store, and the sequence panel in feature details ([@cmdcolin](https://github.com/cmdcolin))
- [#1976](https://github.com/GMOD/jbrowse-components/pull/1976) reorganize the demo page to emphasize the cancer sv demo more ([@rbuels](https://github.com/rbuels))
- [#1952](https://github.com/GMOD/jbrowse-components/pull/1952) Add demo for 1000 genomes extended trio dataset to website ([@cmdcolin](https://github.com/cmdcolin))
- [#1862](https://github.com/GMOD/jbrowse-components/pull/1862) Add example for using a build-time included plugin to storybook ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#2003](https://github.com/GMOD/jbrowse-components/pull/2003) Make SNPCoverage independently generate the modifications tag-color mapping ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `development-tools`
  - [#1930](https://github.com/GMOD/jbrowse-components/pull/1930) Upgrade react scripts+react to latest versions ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 4

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Robert Buels ([@rbuels](https://github.com/rbuels))

## 1.2.0 (2021-05-03)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-legacy-jbrowse          |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-protein                 |                                                                  |
| @jbrowse/plugin-rdf                     |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-trackhub-registry       |                                                                  |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#1125](https://github.com/GMOD/jbrowse-components/pull/1125) Export SVG ([@cmdcolin](https://github.com/cmdcolin))
  - [#1867](https://github.com/GMOD/jbrowse-components/pull/1867) Virtualized tree for tracklist to support having thousands of tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1660](https://github.com/GMOD/jbrowse-components/pull/1660) Allow connections to have multiple assemblies ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1864](https://github.com/GMOD/jbrowse-components/pull/1864) Add Material UI's DataGrid to re-exports ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1875](https://github.com/GMOD/jbrowse-components/pull/1875) Make drawer widget titles stay visible when scrolling inside the widget ([@cmdcolin](https://github.com/cmdcolin))
  - [#1877](https://github.com/GMOD/jbrowse-components/pull/1877) Add ability to copy the text produced by the feature details sequence panel to MS Word/Google Docs and preserve styling ([@cmdcolin](https://github.com/cmdcolin))
  - [#1854](https://github.com/GMOD/jbrowse-components/pull/1854) Make "About track" dialog available from tracklist and for non-LGV tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1853](https://github.com/GMOD/jbrowse-components/pull/1853) Add mouseovers in feature details that show field descriptions for VCF fields ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#1892](https://github.com/GMOD/jbrowse-components/pull/1892) Create new JB2 plugin store ([@elliothershberg](https://github.com/elliothershberg))
  - [#1901](https://github.com/GMOD/jbrowse-components/pull/1901) Make using --out for add-assembly create output directory if it does not exist and fix outputting to symlink ([@cmdcolin](https://github.com/cmdcolin))
  - [#1850](https://github.com/GMOD/jbrowse-components/pull/1850) Add true breakend ALT strings to the feature details panel ([@cmdcolin](https://github.com/cmdcolin))
  - [#1878](https://github.com/GMOD/jbrowse-components/pull/1878) Add --delete to set-default-session, fix --session ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1861](https://github.com/GMOD/jbrowse-components/pull/1861) Change Alignments track "Fade mismatches by quality" setting to a separate config param and made it less strict ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#1924](https://github.com/GMOD/jbrowse-components/pull/1924) Fix import of BED and navToLocString from spreadsheet views ([@cmdcolin](https://github.com/cmdcolin))
  - [#1918](https://github.com/GMOD/jbrowse-components/pull/1918) Fix issue with some falsy values being hidden in feature details ([@cmdcolin](https://github.com/cmdcolin))
  - [#1911](https://github.com/GMOD/jbrowse-components/pull/1911) Fix breakpoint split view visualizations for files that need ref renaming (e.g. chr1 vs 1) ([@cmdcolin](https://github.com/cmdcolin))
  - [#1904](https://github.com/GMOD/jbrowse-components/pull/1904) Fix issue with synteny polygons displaying slightly offset ([@cmdcolin](https://github.com/cmdcolin))
  - [#1884](https://github.com/GMOD/jbrowse-components/pull/1884) Fix rIC ponyfill for use on Safari ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#1912](https://github.com/GMOD/jbrowse-components/pull/1912) Fix reloading of local sessions when using React.StrictMode ([@cmdcolin](https://github.com/cmdcolin))
  - [#1900](https://github.com/GMOD/jbrowse-components/pull/1900) Make clicking away from autocomplete popup on track container work ([@cmdcolin](https://github.com/cmdcolin))
  - [#1878](https://github.com/GMOD/jbrowse-components/pull/1878) Add --delete to set-default-session, fix --session ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1871](https://github.com/GMOD/jbrowse-components/pull/1871) Fix crash on dotplot/linear synteny import form and when closing linear synteny track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1860](https://github.com/GMOD/jbrowse-components/pull/1860) Fix alignments read filter jexl syntax ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1914](https://github.com/GMOD/jbrowse-components/pull/1914) Use MDX to add proper image captions in web and pdf documentation ([@cmdcolin](https://github.com/cmdcolin))
- [#1855](https://github.com/GMOD/jbrowse-components/pull/1855) Add download page in website header and new super-quick-start guide ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#1932](https://github.com/GMOD/jbrowse-components/pull/1932) Update analytics and share API URLs to refer to more stable locations ([@peterkxie](https://github.com/peterkxie))
  - [#1888](https://github.com/GMOD/jbrowse-components/pull/1888) More lazy loading of react components to reduce bundle size ([@cmdcolin](https://github.com/cmdcolin))
  - [#1790](https://github.com/GMOD/jbrowse-components/pull/1790) Allow MainThreadRpcDriver to skip serialization during RPC, improving main-thread rendering performance ([@garrettjstevens](https://github.com/garrettjstevens))
- Other
  - [#1926](https://github.com/GMOD/jbrowse-components/pull/1926) Update website to link to demos on cloudfront for better compression ([@cmdcolin](https://github.com/cmdcolin))
  - [#1868](https://github.com/GMOD/jbrowse-components/pull/1868) Export XYPlotRenderer and configSchema ([@elliothershberg](https://github.com/elliothershberg))
  - [#1863](https://github.com/GMOD/jbrowse-components/pull/1863) Update @gmod/indexedfasta ([@cmdcolin](https://github.com/cmdcolin))
  - [#1795](https://github.com/GMOD/jbrowse-components/pull/1795) Make LinearAlignmentsDisplay fully configurable in the UI ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1822](https://github.com/GMOD/jbrowse-components/pull/1822) Let React LGV navigate without setting displayedRegion first ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 4

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Peter Xie ([@peterkxie](https://github.com/peterkxie))

## 1.1.0 (2021-03-29)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-protein                 |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#1846](https://github.com/GMOD/jbrowse-components/pull/1846) Improve copy+paste in the data grids for feature details ([@cmdcolin](https://github.com/cmdcolin))
  - [#1814](https://github.com/GMOD/jbrowse-components/pull/1814) Add ability to get promoter sequence and intron sequence for genes from the feature details panel ([@cmdcolin](https://github.com/cmdcolin))
  - [#1816](https://github.com/GMOD/jbrowse-components/pull/1816) Remove some animation effects ([@cmdcolin](https://github.com/cmdcolin))
  - [#1778](https://github.com/GMOD/jbrowse-components/pull/1778) Adds dropdown to show drawer widget stack ([@teresam856](https://github.com/teresam856))
  - [#1685](https://github.com/GMOD/jbrowse-components/pull/1685) Change callbacks language from JavaScript to Jexl ([@peterkxie](https://github.com/peterkxie))
- Other
  - [#1831](https://github.com/GMOD/jbrowse-components/pull/1831) Add dialog for launching breakpoint split view from variant feature details ([@cmdcolin](https://github.com/cmdcolin))
  - [#1803](https://github.com/GMOD/jbrowse-components/pull/1803) Transcript and gene glyphs can now display implied UTRs, active by default ([@cmdcolin](https://github.com/cmdcolin))
  - [#1808](https://github.com/GMOD/jbrowse-components/pull/1808) Add another heuristic for returning gene features from BigBed ([@cmdcolin](https://github.com/cmdcolin))
  - [#1774](https://github.com/GMOD/jbrowse-components/pull/1774) Add warning dialog in LGV before returning to import form to prevent accidentally losing the current view ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#1811](https://github.com/GMOD/jbrowse-components/pull/1811) Check for existence of window more robustly to allow in SSR or node applications ([@elliothershberg](https://github.com/elliothershberg))
  - [#1793](https://github.com/GMOD/jbrowse-components/pull/1793) Fix dotplot rendering outside it's allowed bounds ([@cmdcolin](https://github.com/cmdcolin))
  - [#1783](https://github.com/GMOD/jbrowse-components/pull/1783) Add hic aborting and fix remoteAbort signal propagation ([@cmdcolin](https://github.com/cmdcolin))
  - [#1723](https://github.com/GMOD/jbrowse-components/pull/1723) A few bugfixes ([@garrettjstevens](https://github.com/garrettjstevens))
- Other
  - [#1815](https://github.com/GMOD/jbrowse-components/pull/1815) Clear tracks when using "Return to import form" ([@cmdcolin](https://github.com/cmdcolin))
  - [#1819](https://github.com/GMOD/jbrowse-components/pull/1819) Standardized sentence casing on drawer widget titles ([@cmdcolin](https://github.com/cmdcolin))
  - [#1796](https://github.com/GMOD/jbrowse-components/pull/1796) Bump generic-filehandle for fixing CORS errors from Chrome cache pollution ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1824](https://github.com/GMOD/jbrowse-components/pull/1824) Add storybook docs page for nextjs usage ([@elliothershberg](https://github.com/elliothershberg))
- [#1770](https://github.com/GMOD/jbrowse-components/pull/1770) 1469 storybook deploy ([@elliothershberg](https://github.com/elliothershberg))
- [#1807](https://github.com/GMOD/jbrowse-components/pull/1807) Update developer guide to cover displays, and highlight working external plugins ([@cmdcolin](https://github.com/cmdcolin))
- [#1779](https://github.com/GMOD/jbrowse-components/pull/1779) Collaborative release announcement editing ([@rbuels](https://github.com/rbuels))
- [#1791](https://github.com/GMOD/jbrowse-components/pull/1791) Add a couple more demos for our live version with MDX ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#1820](https://github.com/GMOD/jbrowse-components/pull/1820) Create v1.1.0.md, draft of release announcements ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1823](https://github.com/GMOD/jbrowse-components/pull/1823) Add note about previewing changelog to CONTRIBUTING.md ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#1834](https://github.com/GMOD/jbrowse-components/pull/1834) Change jbrowse-components monorepo default branch from 'master' to 'main' ([@rbuels](https://github.com/rbuels))

#### Committers: 6

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Peter Xie ([@peterkxie](https://github.com/peterkxie))
- Robert Buels ([@rbuels](https://github.com/rbuels))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))

## 1.0.4 (2021-03-08)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-legacy-jbrowse          |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/protein-widget                 |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#1758](https://github.com/GMOD/jbrowse-components/pull/1758) Add ability to get stitched together CDS, protein, and cDNA sequences in feature details ([@cmdcolin](https://github.com/cmdcolin))
  - [#1721](https://github.com/GMOD/jbrowse-components/pull/1721) Manually adjust feature height and spacing on alignments track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1728](https://github.com/GMOD/jbrowse-components/pull/1728) Add list of loaded plugins to the "About widget" ([@rbuels](https://github.com/rbuels))
  - [#1711](https://github.com/GMOD/jbrowse-components/pull/1711) Add plugin top-level configuration ([@teresam856](https://github.com/teresam856))
  - [#1699](https://github.com/GMOD/jbrowse-components/pull/1699) Add sequence track for both read and reference genome in the "Linear read vs ref" comparison ([@cmdcolin](https://github.com/cmdcolin))
  - [#1701](https://github.com/GMOD/jbrowse-components/pull/1701) Add clickable navigation links to supplementary alignments/paired ends locations and BND/TRA endpoints in detail widgets ([@cmdcolin](https://github.com/cmdcolin))
  - [#1601](https://github.com/GMOD/jbrowse-components/pull/1601) Add ability to color by per-base quality in alignment tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1640](https://github.com/GMOD/jbrowse-components/pull/1640) Move stats calculation to BaseFeatureAdapter ([@cmdcolin](https://github.com/cmdcolin))
  - [#1588](https://github.com/GMOD/jbrowse-components/pull/1588) Add "Get sequence" action to LGV rubber-band ([@teresam856](https://github.com/teresam856))
- Other
  - [#1743](https://github.com/GMOD/jbrowse-components/pull/1743) Add color picker and choice of summary score style for wiggle track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1763](https://github.com/GMOD/jbrowse-components/pull/1763) Add a "CSS reset" to jbrowse-react-linear-genome-view to prevent parent styles from outside the component leaking in ([@cmdcolin](https://github.com/cmdcolin))
  - [#1756](https://github.com/GMOD/jbrowse-components/pull/1756) Split alignments track menu items into "Pileup" and "SNPCoverage" submenus ([@cmdcolin](https://github.com/cmdcolin))
  - [#1742](https://github.com/GMOD/jbrowse-components/pull/1742) Add ability to display crosshatches on the wiggle line/xyplot renderer ([@cmdcolin](https://github.com/cmdcolin))
  - [#1736](https://github.com/GMOD/jbrowse-components/pull/1736) Fix CLI add-track --load inPlace to put exact contents into the config, add better CLI example docs ([@cmdcolin](https://github.com/cmdcolin))
  - [#1394](https://github.com/GMOD/jbrowse-components/pull/1394) Add new menu items for show/hide feature labels, set max height, and set compact display mode ([@cmdcolin](https://github.com/cmdcolin))
  - [#1720](https://github.com/GMOD/jbrowse-components/pull/1720) Standardize phred qual scaling between BAM and CRAM and add option to make mismatches render in a lighter color when quality is low ([@cmdcolin](https://github.com/cmdcolin))
  - [#1704](https://github.com/GMOD/jbrowse-components/pull/1704) Add "Show all regions in assembly" to import form and make import form show entire region when refName selected ([@cmdcolin](https://github.com/cmdcolin))
  - [#1687](https://github.com/GMOD/jbrowse-components/pull/1687) Threshold for indicators on SNPCoverage + inverted bargraph of interbase counts for sub-threshold events ([@cmdcolin](https://github.com/cmdcolin))
  - [#1695](https://github.com/GMOD/jbrowse-components/pull/1695) Improve zoomed-out display of quantitative displays tracks when bicolor pivot is active ([@cmdcolin](https://github.com/cmdcolin))
  - [#1680](https://github.com/GMOD/jbrowse-components/pull/1680) Add on click functionality to quantitative track features ([@teresam856](https://github.com/teresam856))
  - [#1630](https://github.com/GMOD/jbrowse-components/pull/1630) Get column names from BED tabix files and other utils for external jbrowse-plugin-gwas support ([@cmdcolin](https://github.com/cmdcolin))
  - [#1709](https://github.com/GMOD/jbrowse-components/pull/1709) Improve sorting and filtering in variant detail widget ([@cmdcolin](https://github.com/cmdcolin))
  - [#1688](https://github.com/GMOD/jbrowse-components/pull/1688) Bold insertion indicator for large insertions on pileup track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1669](https://github.com/GMOD/jbrowse-components/pull/1669) Allow plain json encoding of the session in the URL ([@cmdcolin](https://github.com/cmdcolin))
  - [#1642](https://github.com/GMOD/jbrowse-components/pull/1642) Enable locstring navigation from LGV import form ([@teresam856](https://github.com/teresam856))
  - [#1655](https://github.com/GMOD/jbrowse-components/pull/1655) Add GFF3Tabix and BEDTabix inference to JB1 connection ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1643](https://github.com/GMOD/jbrowse-components/pull/1643) Add an offset that allows all wiggle y-scalebar labels to be visible ([@cmdcolin](https://github.com/cmdcolin))
  - [#1632](https://github.com/GMOD/jbrowse-components/pull/1632) Displays warnings when receiving a session with custom callbacks ([@peterkxie](https://github.com/peterkxie))
  - [#1615](https://github.com/GMOD/jbrowse-components/pull/1615) Increase pileup maxHeight ([@cmdcolin](https://github.com/cmdcolin))
  - [#1624](https://github.com/GMOD/jbrowse-components/pull/1624) GCContent adapter ([@cmdcolin](https://github.com/cmdcolin))
  - [#1614](https://github.com/GMOD/jbrowse-components/pull/1614) Add insertion and clip indicators to SNPCoverage views (part of Alignments tracks) ([@cmdcolin](https://github.com/cmdcolin))
  - [#1610](https://github.com/GMOD/jbrowse-components/pull/1610) Display error message from dynamodb session sharing error ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#1777](https://github.com/GMOD/jbrowse-components/pull/1777) Quick fix for block error ([@cmdcolin](https://github.com/cmdcolin))
  - [#1748](https://github.com/GMOD/jbrowse-components/pull/1748) External plugins load after confirming config warning ([@peterkxie](https://github.com/peterkxie))
  - [#1750](https://github.com/GMOD/jbrowse-components/pull/1750) Fix pileup sorting when using string tag ([@cmdcolin](https://github.com/cmdcolin))
  - [#1747](https://github.com/GMOD/jbrowse-components/pull/1747) Fix the position of the popup menu after rubberband select when there is a margin on the component e.g. in embedded ([@cmdcolin](https://github.com/cmdcolin))
  - [#1736](https://github.com/GMOD/jbrowse-components/pull/1736) Fix CLI add-track --load inPlace to put exact contents into the config, add better CLI example docs ([@cmdcolin](https://github.com/cmdcolin))
  - [#1731](https://github.com/GMOD/jbrowse-components/pull/1731) Fix alignment track ability to remember the height of the SNPCoverage subtrack on refresh ([@cmdcolin](https://github.com/cmdcolin))
  - [#1719](https://github.com/GMOD/jbrowse-components/pull/1719) Fix for navigation past end of chromosome ([@cmdcolin](https://github.com/cmdcolin))
  - [#1698](https://github.com/GMOD/jbrowse-components/pull/1698) Fix rendering read vs ref comparisons with CIGAR strings that use = sign matches ([@cmdcolin](https://github.com/cmdcolin))
  - [#1697](https://github.com/GMOD/jbrowse-components/pull/1697) Fix softclipping configuration setting causing bases to be missed ([@cmdcolin](https://github.com/cmdcolin))
  - [#1689](https://github.com/GMOD/jbrowse-components/pull/1689) Disable copy/delete menu items for reference sequence track ([@teresam856](https://github.com/teresam856))
  - [#1682](https://github.com/GMOD/jbrowse-components/pull/1682) Fix parsing of BED and BEDPE files with comment header for spreadsheet view ([@cmdcolin](https://github.com/cmdcolin))
  - [#1679](https://github.com/GMOD/jbrowse-components/pull/1679) Fix issue with using launching the add track widget on views that are not displaying any regions ([@teresam856](https://github.com/teresam856))
  - [#1642](https://github.com/GMOD/jbrowse-components/pull/1642) Enable locstring navigation from LGV import form ([@teresam856](https://github.com/teresam856))
  - [#1626](https://github.com/GMOD/jbrowse-components/pull/1626) Bug Fix: specify assembly in locstring ([@teresam856](https://github.com/teresam856))
  - [#1619](https://github.com/GMOD/jbrowse-components/pull/1619) Fix overview scale polygon not appearing properly in some cases ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#1714](https://github.com/GMOD/jbrowse-components/pull/1714) Fix ability to add a PAF on initial dotplot view creation ([@cmdcolin](https://github.com/cmdcolin))
  - [#1657](https://github.com/GMOD/jbrowse-components/pull/1657) Fix for track using assembly alias not displaying ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1620](https://github.com/GMOD/jbrowse-components/pull/1620) Add error reporting on a worker failure ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1725](https://github.com/GMOD/jbrowse-components/pull/1725) JBrowseR release ([@elliothershberg](https://github.com/elliothershberg))
- [#1677](https://github.com/GMOD/jbrowse-components/pull/1677) Config guide updates ([@elliothershberg](https://github.com/elliothershberg))
- [#1665](https://github.com/GMOD/jbrowse-components/pull/1665) Add Nextstrain COVID storybook ([@elliothershberg](https://github.com/elliothershberg))
- [#1670](https://github.com/GMOD/jbrowse-components/pull/1670) typo in developer guide docs ([@teresam856](https://github.com/teresam856))
- [#1592](https://github.com/GMOD/jbrowse-components/pull/1592) Website copy edits ([@rbuels](https://github.com/rbuels))
- [#1646](https://github.com/GMOD/jbrowse-components/pull/1646) Fix "See code" link in CLI docs ([@garrettjstevens](https://github.com/garrettjstevens))
- [#1618](https://github.com/GMOD/jbrowse-components/pull/1618) Add whole-genome view and color/sort alignments tutorials to user guide ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#1666](https://github.com/GMOD/jbrowse-components/pull/1666) Move "mouseover" config from BaseLinearDisplay to LinearBasicDisplay display ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1751](https://github.com/GMOD/jbrowse-components/pull/1751) Make the variant display derive from the feature display ([@cmdcolin](https://github.com/cmdcolin))
  - [#1716](https://github.com/GMOD/jbrowse-components/pull/1716) Stringify labels before adding to rendering to avoid undefineds on label.length ([@cmdcolin](https://github.com/cmdcolin))
  - [#1713](https://github.com/GMOD/jbrowse-components/pull/1713) Add console.error log in block setError ([@cmdcolin](https://github.com/cmdcolin))
  - [#1663](https://github.com/GMOD/jbrowse-components/pull/1663) Make LGV "initialized" not depend on displayedRegions ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1672](https://github.com/GMOD/jbrowse-components/pull/1672) Fix import forms crashing if there are no assemblies ([@cmdcolin](https://github.com/cmdcolin))
  - [#1644](https://github.com/GMOD/jbrowse-components/pull/1644) Bump electron from 9.3.1 to 9.4.0 ([@dependabot[bot]](https://github.com/apps/dependabot))
  - [#1641](https://github.com/GMOD/jbrowse-components/pull/1641) Remove codecov pr annotations ([@cmdcolin](https://github.com/cmdcolin))
  - [#1609](https://github.com/GMOD/jbrowse-components/pull/1609) Add extra checks for release script ([@peterkxie](https://github.com/peterkxie))
- `core`
  - [#1762](https://github.com/GMOD/jbrowse-components/pull/1762) Add requestidlecallback ponyfill in @jbrowse/core/util ([@cmdcolin](https://github.com/cmdcolin))
  - [#1629](https://github.com/GMOD/jbrowse-components/pull/1629) Add RegionsAdapter/SequenceAdapter, reorganize base adapters ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1625](https://github.com/GMOD/jbrowse-components/pull/1625) Make renderArgs consistent and don't duplicate data ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1414](https://github.com/GMOD/jbrowse-components/pull/1414) Typescriptify and MST'ify the add track workflow ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 7

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Liu ZH ([@sqwwwok](https://github.com/sqwwwok))
- Peter Xie ([@peterkxie](https://github.com/peterkxie))
- Robert Buels ([@rbuels](https://github.com/rbuels))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))

## 1.0.3 (2021-01-11)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/development-tools              | https://www.npmjs.com/package/@jbrowse/development-tools         |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-trackhub-registry       |                                                                  |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/protein-widget                 |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#1560](https://github.com/GMOD/jbrowse-components/pull/1560) Provide a dialog to add extra genomic context for linear read vs. ref visualization ([@elliothershberg](https://github.com/elliothershberg))
  - [#1604](https://github.com/GMOD/jbrowse-components/pull/1604) Add ability to filter for read name to the alignments filter dialog ([@cmdcolin](https://github.com/cmdcolin))
  - [#1599](https://github.com/GMOD/jbrowse-components/pull/1599) Replace 'show all regions' with 'show all regions in assembly' ([@cmdcolin](https://github.com/cmdcolin))
  - [#1595](https://github.com/GMOD/jbrowse-components/pull/1595) Admin server GUI enhancements ([@elliothershberg](https://github.com/elliothershberg))
  - [#1584](https://github.com/GMOD/jbrowse-components/pull/1584) Restructure demo page and release cancer demo ([@elliothershberg](https://github.com/elliothershberg))
  - [#1579](https://github.com/GMOD/jbrowse-components/pull/1579) Create --branch and --nightly flags for `jbrowse create` and `jbrowse upgrade` commands ([@cmdcolin](https://github.com/cmdcolin))
  - [#1575](https://github.com/GMOD/jbrowse-components/pull/1575) Improve mobx-state-tree type validation errors ([@cmdcolin](https://github.com/cmdcolin))
  - [#1574](https://github.com/GMOD/jbrowse-components/pull/1574) Make softclip indicator black if no seq available ([@cmdcolin](https://github.com/cmdcolin))
  - [#1554](https://github.com/GMOD/jbrowse-components/pull/1554) Coloring options with simple color for tag ([@peterkxie](https://github.com/peterkxie))
  - [#1565](https://github.com/GMOD/jbrowse-components/pull/1565) Rename jbrowse cli add-track --type to --trackType ([@cmdcolin](https://github.com/cmdcolin))
  - [#1558](https://github.com/GMOD/jbrowse-components/pull/1558) Add docs for sequence track, variant track, launching synteny from dotplot, and add UCSC plugin to demo ([@cmdcolin](https://github.com/cmdcolin))
  - [#1533](https://github.com/GMOD/jbrowse-components/pull/1533) Display file headers in pre tag in about dialogs and bump @gmod/bam and @gmod/tabix package versions ([@cmdcolin](https://github.com/cmdcolin))
  - [#1541](https://github.com/GMOD/jbrowse-components/pull/1541) Add more info about adding a PAF file to the synteny import form ([@cmdcolin](https://github.com/cmdcolin))
  - [#1509](https://github.com/GMOD/jbrowse-components/pull/1509) Combine Search and Dropdown component on LGV ([@teresam856](https://github.com/teresam856))
  - [#1530](https://github.com/GMOD/jbrowse-components/pull/1530) Add spreadsheet filter support for derived columns ([@elliothershberg](https://github.com/elliothershberg))
  - [#1483](https://github.com/GMOD/jbrowse-components/pull/1483) Add session export to and import from file ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1519](https://github.com/GMOD/jbrowse-components/pull/1519) Add autoSql to the bigBed "About this track" dialog ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#1531](https://github.com/GMOD/jbrowse-components/pull/1531) Add track menu options for autoscale, log scale, histogram fill, setting min/max score, and zoom level/resolution for wiggle/snpcoverage tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1473](https://github.com/GMOD/jbrowse-components/pull/1473) Color, filter, and sort options for the alignments ([@cmdcolin](https://github.com/cmdcolin))
  - [#1576](https://github.com/GMOD/jbrowse-components/pull/1576) Add location string to tooltip for wiggle and SNPCoverage tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1529](https://github.com/GMOD/jbrowse-components/pull/1529) Display subfeatures in feature details widget ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `development-tools`
  - [#1578](https://github.com/GMOD/jbrowse-components/pull/1578) Update build system for external plugins ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- Other
  - [#1608](https://github.com/GMOD/jbrowse-components/pull/1608) Take into account offsetX of the rubberband on scalebar zooming ([@cmdcolin](https://github.com/cmdcolin))
  - [#1597](https://github.com/GMOD/jbrowse-components/pull/1597) Fix crash when there are undefined references in the state tree e.g. when a track is deleted but still referred to by a session ([@peterkxie](https://github.com/peterkxie))
  - [#1598](https://github.com/GMOD/jbrowse-components/pull/1598) Disable 'copy to clipboard' while share url being generated ([@peterkxie](https://github.com/peterkxie))
  - [#1589](https://github.com/GMOD/jbrowse-components/pull/1589) Fix the display of trackhub registry results ([@cmdcolin](https://github.com/cmdcolin))
  - [#1573](https://github.com/GMOD/jbrowse-components/pull/1573) Update hic-straw to fix error for hic files with many scaffolds ([@cmdcolin](https://github.com/cmdcolin))
  - [#1563](https://github.com/GMOD/jbrowse-components/pull/1563) Remove softclip and hardclip from being counted as SNPs in the SNPCoverage ([@cmdcolin](https://github.com/cmdcolin))
  - [#1559](https://github.com/GMOD/jbrowse-components/pull/1559) Avoid errors from breakpoint split view related to getBoundingClientRect on null track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1540](https://github.com/GMOD/jbrowse-components/pull/1540) Fix memory leak when side scrolling LGV blocks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1534](https://github.com/GMOD/jbrowse-components/pull/1534) Fix breakpoint split view showing too many connections for paired end ends ([@cmdcolin](https://github.com/cmdcolin))
  - [#1524](https://github.com/GMOD/jbrowse-components/pull/1524) Move loading flag for spreadsheet import wizard to volatile to avoid it persisting across refresh ([@cmdcolin](https://github.com/cmdcolin))
  - [#1521](https://github.com/GMOD/jbrowse-components/pull/1521) Add missing dep to react-linear-genome-view ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#1587](https://github.com/GMOD/jbrowse-components/pull/1587) Fix positioning of scalebar tooltips, overview scalebar plotting, and refName label positioning when displaying many regions ([@cmdcolin](https://github.com/cmdcolin))
  - [#1547](https://github.com/GMOD/jbrowse-components/pull/1547) Fix analytics crashing when using plugins ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1594](https://github.com/GMOD/jbrowse-components/pull/1594) Add GFF3 example to quickstart ([@cmdcolin](https://github.com/cmdcolin))
- [#1581](https://github.com/GMOD/jbrowse-components/pull/1581) Add some features that are missing from jbrowse 2 to the feature comparison table ([@cmdcolin](https://github.com/cmdcolin))
- [#1558](https://github.com/GMOD/jbrowse-components/pull/1558) Add docs for sequence track, variant track, launching synteny from dotplot, and add UCSC plugin to demo ([@cmdcolin](https://github.com/cmdcolin))
- [#1537](https://github.com/GMOD/jbrowse-components/pull/1537) Add CONTRIBUTING.md with tips for getting started with codebase ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#1606](https://github.com/GMOD/jbrowse-components/pull/1606) Upgrade @testing-library/react and improve test reliability ([@cmdcolin](https://github.com/cmdcolin))
- [#1555](https://github.com/GMOD/jbrowse-components/pull/1555) Remove the TextDecoder/TextEncoder polyfill ([@cmdcolin](https://github.com/cmdcolin))
- [#1522](https://github.com/GMOD/jbrowse-components/pull/1522) Update oclif and remove now unnecessary file copy ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 6

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Peter Xie ([@peterkxie](https://github.com/peterkxie))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))
- [@Akusem](https://github.com/Akusem)

## v1.0.2 (2020-12-02)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/development-tools              | https://www.npmjs.com/package/@jbrowse/development-tools         |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-legacy-jbrowse          |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-protein                 |                                                                  |
| @jbrowse/plugin-rdf                     |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-trackhub-registry       |                                                                  |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/protein-widget                 |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#1513](https://github.com/GMOD/jbrowse-components/pull/1513) Add a custom scrollbar that overrides the auto-hiding behavior of scrollbars on OSX ([@elliothershberg](https://github.com/elliothershberg))

#### :bug: Bug Fix

- Other
  - [#1514](https://github.com/GMOD/jbrowse-components/pull/1514) react-linear-genome-view bug fixes ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1517](https://github.com/GMOD/jbrowse-components/pull/1517) Fix the use of filtering display on desktop ([@cmdcolin](https://github.com/cmdcolin))
  - [#1512](https://github.com/GMOD/jbrowse-components/pull/1512) Fix setting maxDisplayedBpPerPx for pileup display, helps prevent too large an area from being rendered ([@cmdcolin](https://github.com/cmdcolin))
  - [#1442](https://github.com/GMOD/jbrowse-components/pull/1442) Change track selector togglebutton to normal button ([@cmdcolin](https://github.com/cmdcolin))
  - [#1506](https://github.com/GMOD/jbrowse-components/pull/1506) Fix horizontally flipped translation frames position ([@cmdcolin](https://github.com/cmdcolin))
  - [#1501](https://github.com/GMOD/jbrowse-components/pull/1501) Fix CLI to allow jbrowse create to download newer monorepo tag format ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#1505](https://github.com/GMOD/jbrowse-components/pull/1505) Fix loading of local files in jbrowse-desktop ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## v1.0.1 (2020-11-25)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/development-tools              | https://www.npmjs.com/package/@jbrowse/development-tools         |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           |                                                                  |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-legacy-jbrowse          |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-protein                 |                                                                  |
| @jbrowse/plugin-rdf                     |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-trackhub-registry       |                                                                  |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/protein-widget                 |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#1462](https://github.com/GMOD/jbrowse-components/pull/1462) Allow importing gzip and bgzip files in the spreadsheet and SV inspector ([@cmdcolin](https://github.com/cmdcolin))
  - [#1460](https://github.com/GMOD/jbrowse-components/pull/1460) Add support for more bigBed subtypes and fallback for unsupported types ([@peterkxie](https://github.com/peterkxie))
  - [#1455](https://github.com/GMOD/jbrowse-components/pull/1455) Add the ability to use connection across refreshes in jbrowse-web using session connections ([@peterkxie](https://github.com/peterkxie))
  - [#1439](https://github.com/GMOD/jbrowse-components/pull/1439) 1381 improve assembly add form ([@elliothershberg](https://github.com/elliothershberg))
  - [#1433](https://github.com/GMOD/jbrowse-components/pull/1433) Make add track warning a bit more lenient ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1420](https://github.com/GMOD/jbrowse-components/pull/1420) Add the assembly manager feature to jbrowse-desktop ([@elliothershberg](https://github.com/elliothershberg))
- `core`
  - [#1458](https://github.com/GMOD/jbrowse-components/pull/1458) Add three frame translation to the sequence track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1453](https://github.com/GMOD/jbrowse-components/pull/1453) Change "Factory reset" to "Reset session" in jbrowse-web ([@teresam856](https://github.com/teresam856))
  - [#1441](https://github.com/GMOD/jbrowse-components/pull/1441) New icon for the track selector ([@cmdcolin](https://github.com/cmdcolin))
  - [#1438](https://github.com/GMOD/jbrowse-components/pull/1438) Improve assembly loading time by moving to main thread ([@cmdcolin](https://github.com/cmdcolin))
  - [#1434](https://github.com/GMOD/jbrowse-components/pull/1434) Create separate config schema for ReferenceSequenceTrack ([@elliothershberg](https://github.com/elliothershberg))

#### :bug: Bug Fix

- `core`
  - [#1491](https://github.com/GMOD/jbrowse-components/pull/1491) Fix ability to add a PAF synteny track with add-track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1470](https://github.com/GMOD/jbrowse-components/pull/1470) Avoid rendering the literal string 'null' in the feature details ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#1489](https://github.com/GMOD/jbrowse-components/pull/1489) Fix long read vs ref CIGAR rendering for horizontally flipped synteny view ([@cmdcolin](https://github.com/cmdcolin))
  - [#1460](https://github.com/GMOD/jbrowse-components/pull/1460) Add support for more bigBed subtypes and fallback for unsupported types ([@peterkxie](https://github.com/peterkxie))
  - [#1472](https://github.com/GMOD/jbrowse-components/pull/1472) Wait on assemblies that are being tracked by the assemblyManager only ([@cmdcolin](https://github.com/cmdcolin))
  - [#1466](https://github.com/GMOD/jbrowse-components/pull/1466) Avoid rendering the display and renderer settings in the about this track dialog ([@cmdcolin](https://github.com/cmdcolin))
  - [#1461](https://github.com/GMOD/jbrowse-components/pull/1461) Fix usage of jbrowse-cli on node 10.9 related to fs.promises ([@cmdcolin](https://github.com/cmdcolin))
  - [#1452](https://github.com/GMOD/jbrowse-components/pull/1452) Bug: search box disappears from LGV header on smaller widths ([@teresam856](https://github.com/teresam856))
  - [#1432](https://github.com/GMOD/jbrowse-components/pull/1432) Make global variables window.JBrowseSession and window.JBrowseRootModel available in jbrowse-web ([@teresam856](https://github.com/teresam856))
  - [#1431](https://github.com/GMOD/jbrowse-components/pull/1431) Fix connection tracks not showing up in track selector ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1428](https://github.com/GMOD/jbrowse-components/pull/1428) Fix the listVersions behavior of the jbrowse-cli returning duplicate entries ([@cmdcolin](https://github.com/cmdcolin))
  - [#1422](https://github.com/GMOD/jbrowse-components/pull/1422) Fix crash from empty ALT field in VCF ([@cmdcolin](https://github.com/cmdcolin))
  - [#1413](https://github.com/GMOD/jbrowse-components/pull/1413) Fix ability to add CRAM tracks using the web based add-track GUI ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1435](https://github.com/GMOD/jbrowse-components/pull/1435) Updates to quickstart guides ([@garrettjstevens](https://github.com/garrettjstevens))

#### :house: Internal

- Other
  - [#1437](https://github.com/GMOD/jbrowse-components/pull/1437) Use lerna-changelog for changelog generation ([@cmdcolin](https://github.com/cmdcolin))
  - [#1465](https://github.com/GMOD/jbrowse-components/pull/1465) Establish minimum node version of 10.4 for using jbrowse-cli tools ([@cmdcolin](https://github.com/cmdcolin))
  - [#1454](https://github.com/GMOD/jbrowse-components/pull/1454) Fix GH workflow build ([@elliothershberg](https://github.com/elliothershberg))
  - [#1448](https://github.com/GMOD/jbrowse-components/pull/1448) Move building and testing from Travis to GitHub Workflow ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1450](https://github.com/GMOD/jbrowse-components/pull/1450) Fix website build ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#1468](https://github.com/GMOD/jbrowse-components/pull/1468) Have assembly manager get plugin manager from factory function args ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 5

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))
- [@peterkxie](https://github.com/peterkxie)

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

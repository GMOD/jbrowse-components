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

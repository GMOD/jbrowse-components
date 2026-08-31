// Ordered `guide_category` values for each hand-written guide directory. A page
// declares one of these in its frontmatter; that value sections it on the
// landing-page index (scripts/generate-guide-indexes.ts) and heads its run of
// pages in the sidebar (docs-sidebar.ts), in the order listed here. Keeping the
// orders in one place stops the two groupings from drifting — a page's sidebar
// neighbors and its overview-page section are guaranteed to match.
//
// Keep these names SHORT, though no longer to a character budget: they were
// prefixed onto every page label until the sidebar grew heading rows, so
// "<Category>: <Title>" had to fit ~40 characters, and "Callbacks and
// customization" wrapped every page under it, which is why it is now just
// "Callbacks". A heading is written once on a line of its own and can afford
// more, but it is also read as a group name rather than as part of a title, so
// short still wins.
//
// Every name has to SAY something. Both guide dirs used to end in an "Other
// features" bucket, which named nothing and meant something different in each
// dir. The pages in them were not actually miscellaneous — user_guides' were
// mostly sequence operations, config_guides' were session/appearance settings
// and deployment ops — so they are named for that now. A page that fits no
// category is a signal the categories are wrong, not that a drawer is needed.

export const USER_CATEGORIES = [
  'General usage',
  'Track types',
  'Views',
  'Sequence tools',
  'Analysis',
  'Tutorials',
]

export const CONFIG_CATEGORIES = [
  'Core configuration',
  'Track types',
  'Callbacks',
  'Appearance',
  'Deployment',
]

// 'Plugins' follows 'Getting started' so that the overview page of that name
// (developer_guides/pluggable_elements.md, tagged 'Getting started') lands
// directly above the twelve pages it introduces. With 'Core concepts' between
// them, six unrelated entries separated the index from its own section.
export const DEVELOPER_CATEGORIES = [
  'Getting started',
  'Plugins',
  'Core concepts',
  'Advanced topics',
]

// Ordered `tutorial_category` values, shared by the tutorials landing page
// (pages/docs/tutorials/index.astro) and the user guide index, so the two
// groupings of the same pages can't drift. A tutorial with no category, or one
// not listed here, falls into TUTORIAL_FALLBACK rather than vanishing.
// 'Cancer genomics' is split out from 'Structural variation' rather than
// widened into it: the tumor pages are not all SV work (a somatic point-mutation
// matrix is not structural variation, which is what filed it under 'Population
// genomics' before), and the SV pages are not all cancer (the 1000 Genomes
// inversion and copy-number panels are germline). One axis each keeps both
// headings true of everything under them.
//
// One category per page, deliberately, and not a tag system. Tutorials do sit
// on several axes at once — biology domain, variant type, the display doing the
// work — and every few months that reads like an argument for tags. It isn't,
// at this size: these are section headings on one landing page, a page can only
// appear once in a linear list, and after the split above all 35 pages have a
// category that is true of them. What a reader actually wants from tags is to
// find the sibling page in another section, and `## See also` already does that
// with prose that says WHY the two are related, which a tag cannot. When a page
// straddles, fix the cross-links, not the schema. Revisit only if the corpus
// roughly doubles or a section stops describing its contents.
//
// 'genomes.jbrowse.org' leads, and is the second heading here that names
// something other than a biology domain. It holds the pages that are about the
// hosted site rather than about a dataset: each opens on a genome that is
// already configured, so the whole page is a click path and its Prerequisites
// list is "nothing to install". Filed by domain they were scattered across
// four sections, each sitting among pages that want minimap2, pggb or a
// tabix'd file first, so the one group a reader can follow without downloading
// anything was the one group that could not be seen. They already read as a
// series: all four cross-link each other, and all four lead their sidebar_label
// with the site's name so the flat sidebar sorts them as one run. This is not
// the same axis as "costs the reader nothing", which is wider (the
// demo-instance pages are zero-setup too, and `mappability_qc` is a hosted
// click path whose subject is SMN, not the site) and wants a per-card badge
// rather than a heading.
export const TUTORIAL_CATEGORIES = [
  'genomes.jbrowse.org',
  'Getting started',
  'Synteny & comparative genomics',
  'Structural variation',
  'Cancer genomics',
  'Population genomics',
  'Epigenomics & single cell',
  'Transcriptomics & proteins',
  'Genes & annotation',
  'Configuration & embedding',
]

export const TUTORIAL_FALLBACK = 'More tutorials'

// The `data` frontmatter field: what it takes to end up with what a tutorial
// produces, as a chip on its card. Half these pages open a hosted link and half
// want pggb, Cactus or minimap2 run first, and until this the cards said
// nothing either way, so the zero-setup entry points could only be found by
// opening pages.
//
// The question is deliberately "what does it cost to get what this page shows",
// not "can I read it with nothing installed". Almost every page answers yes to
// the second — their figures are hosted, which is what makes them figures — so
// a badge on that axis would mark 30 of 42 pages and mean nothing. Under the
// first, `dog10k_svs` is a bcftools pipeline whose opening bullet says the
// figures are free to read, and the card should say pipeline.
//
// A page whose cost is not about data leaves the field off: the embedding and
// display-settings walkthroughs need a text editor and an instance, which is
// none of these three and does not become one by picking the nearest.
export const TUTORIAL_DATA_COSTS: Record<string, { label: string; title: string }> =
  {
    hosted: {
      label: 'No setup',
      title: 'Nothing to install: the data is already served',
    },
    download: {
      label: 'Download',
      title: 'Fetch and index published files, no analysis tool',
    },
    pipeline: {
      label: 'Pipeline',
      title: 'Run an analysis tool first (aligner, graph builder, caller)',
    },
  }

// Curated order within each tutorial category, by page slug. Sorting
// alphabetically floated niche pages to the top (the CLI config walkthrough
// once led Getting started); instead each section leads with its most
// representative page. Anything unlisted falls after, alphabetically. Includes
// a few slugs that only the landing page shows (the quickstarts, the cookbook,
// the external examples card); they are inert for the user guide index.
export const TUTORIAL_ORDER = [
  // The hosted-site series, in the order it is meant to be read: open a genome
  // and turn on a track, then the two right-click launchers that build a second
  // view out of the gene under the cursor, then the display swap that needs no
  // second view at all. It leads the page ahead of Getting started because both
  // quickstarts are "install JBrowse and load data into it", and these are the
  // pages that need neither — the shortest path from the tutorials index to a
  // reader looking at real data in a real browser.
  'genomes_basics',
  'genomes_synteny',
  'genomes_proteins',
  'repeatmasker_classes',
  'quickstart_web',
  'quickstart_desktop',
  'synteny_visualization',
  'multiway_synteny_grape_peach_cacao',
  'allvsall_synteny',
  'hg002_haplotypes',
  'pangenome_ecoli',
  'pangenome_cactus',
  'pangenome_hprc',
  'sv_visualization_cgiab',
  'sv_multisamples',
  'population_genomics',
  'analyze_trio',
  'ld_human',
  'ld_mosquitoes',
  'bxd_qtl',
  'methylation',
  'bisulfite',
  'chromhmm',
  'scatac_pseudobulk',
  'rnaseq',
  'cookbook',
  'display_settings',
  'embed_linear_genome_view',
  'embedding_examples',
  'cli_desktop',
]

// Tutorial cards that deliberately render the compact chromeless card instead
// of a thumbnail. Every other card's thumb is derived from a figure its page
// embeds (scripts/gen-tutorial-thumbs.ts); there are no hand-made ones, which is
// why a page with no figure to derive from goes here rather than getting a
// stand-in.
//
// - cli_desktop is the text-only CLI walkthrough.
// - embedding_examples links out to the Storybook. Nothing in the repo is a
//   capture of that site, and any doc figure would be a picture of something
//   else.
//
// Shared with the generator rather than kept next to the <img>, because the two
// halves of "does this card have a thumbnail" have to be the same list. They
// weren't: the landing page rendered an <img> for any key not listed here, while
// the generator only checked that its own specs still had pages. A new tutorial
// with no spec therefore linked a webp nobody had generated, and the first thing
// to notice was the website link checker.
export const TUTORIAL_NO_THUMB = new Set(['cli_desktop', 'embedding_examples'])

// Curated lead pages within a `guide_category`, by slug — the same idea as
// TUTORIAL_ORDER above, for the same reason. A category sorted purely
// alphabetically leads with whichever page happens to start with an early
// letter, which buried "config.json format" fifth of the nine Core
// configuration pages and put "Writing a plugin" *after* "Writing a no-build
// plugin". Slugs here sort first, in this order; everything else follows
// alphabetically by label as before. Only list a page whose position this
// actually changes (user_guides needs no entry — "Basic usage" already leads
// General usage on its own).
export const GUIDE_ORDER: Record<string, string[]> = {
  config_guides: ['intro', 'assemblies', 'tracks'],
  // pluggable_elements last of Getting started: it is the index for the
  // 'Plugins' category, which DEVELOPER_CATEGORIES puts next.
  //
  // The three display pages lead 'Plugins' in escalation order. Alphabetically
  // creating_gpu_display sorts above plotting_features, so the sidebar led with
  // the shader path while both guides tell you to start on Canvas2D and move up
  // only when a profile says so.
  developer_guides: [
    'simple_plugin',
    'no_build_plugin',
    'pluggable_elements',
    'creating_display',
    'plotting_features',
    'creating_gpu_display',
  ],
}

// Rank of a page within its category: listed slugs first in listed order, the
// rest after (the caller's existing alphabetical-by-label order is preserved by
// a stable sort). Takes either a bare page slug or the `<dirName>/<slug>` id
// the sidebar carries.
export function guideRank(dirName: string, slug: string): number {
  const order = GUIDE_ORDER[dirName]
  const prefix = `${dirName}/`
  const bare = slug.startsWith(prefix) ? slug.slice(prefix.length) : slug
  const i = order ? order.indexOf(bare) : -1
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}

// Maps an autogenerated sidebar `dirName` to its category order. Only the
// hand-written guide dirs order by frontmatter `guide_category`; `config` and
// `models` order by the category in their generated `sidebar_label`, and `api`
// not at all. `tutorials` is deliberately absent: its sidebar list stays flat
// and alphabetical, with no prefix — the landing page sections the same pages,
// which is enough categorization. The grouping the sidebar does have comes from
// the labels themselves: a tutorial's sidebar_label leads with the word its kin
// lead with ("Synteny (…)", "SVs (…)", "Pangenome (…)"), so sorting them
// alphabetically puts each family in one run. docs/tutorials/CLAUDE.md is where
// that convention is written for authors.
export const GUIDE_CATEGORY_ORDER: Record<string, string[]> = {
  user_guides: USER_CATEGORIES,
  config_guides: CONFIG_CATEGORIES,
  developer_guides: DEVELOPER_CATEGORIES,
}

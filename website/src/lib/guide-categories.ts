// Ordered `guide_category` values for each hand-written guide directory. A page
// declares one of these in its frontmatter; that value sections it on the
// landing-page index (scripts/generate-guide-indexes.ts) and prefixes its
// sidebar label (docs-sidebar.ts), in the order listed here. Keeping the orders
// in one place stops the two groupings from drifting — a page's sidebar
// neighbors and its overview-page section are guaranteed to match.
//
// Keep these names SHORT. Since the sidebar flattened they are prefixed onto
// every page label, so "<Category>: <Title>" has to fit ~40 characters or the
// entry wraps to two lines. "Callbacks and customization" wrapped every page
// under it, which is why it is now just "Callbacks".
//
// Every name also has to SAY something. Both guide dirs used to end in an
// "Other features" bucket, which named nothing, meant something different in
// each dir, and spent 16 of those ~40 characters saying so on a dozen labels.
// The pages in them were not actually miscellaneous — user_guides' were mostly
// sequence operations, config_guides' were session/appearance settings and
// deployment ops — so they are named for that now. A page that fits no category
// is a signal the categories are wrong, not that a drawer is needed.

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
export const TUTORIAL_CATEGORIES = [
  'Getting started',
  'Synteny & comparative genomics',
  'Structural variation',
  'Cancer genomics',
  'Population genomics',
  'Epigenomics & single cell',
  'Transcriptomics & proteins',
  'Configuration & embedding',
]

export const TUTORIAL_FALLBACK = 'More tutorials'

// Curated order within each tutorial category, by page slug. Sorting
// alphabetically floated niche pages to the top (the CLI config walkthrough
// once led Getting started); instead each section leads with its most
// representative page. Anything unlisted falls after, alphabetically. Includes
// a few slugs that only the landing page shows (the quickstarts, the cookbook,
// the external examples card); they are inert for the user guide index.
export const TUTORIAL_ORDER = [
  // Leads Getting started, ahead of the two quickstarts: both of those are
  // "install JBrowse and load data into it", and this one is the page that
  // needs neither, so it is the shortest path from the tutorials index to a
  // reader looking at real data in a real browser.
  'genomes_basics',
  'quickstart_web',
  'quickstart_desktop',
  'synteny_visualization',
  'multiway_synteny',
  'allvsall_synteny',
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
  'protein_structure',
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
// which is enough categorization.
export const GUIDE_CATEGORY_ORDER: Record<string, string[]> = {
  user_guides: USER_CATEGORIES,
  config_guides: CONFIG_CATEGORIES,
  developer_guides: DEVELOPER_CATEGORIES,
}

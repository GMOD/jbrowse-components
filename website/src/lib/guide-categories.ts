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

// Ordered `tutorial_category` values, shared by the tutorials landing page and
// the user guide index. An unlisted or missing category lands in
// TUTORIAL_FALLBACK.
//
// One category per page, not tags: these are section headings on one page, and
// `## See also` already links the sibling in another section with the reason.
// 'Cancer genomics' and 'Structural variation' stay apart because neither is a
// subset of the other. 'genomes.jbrowse.org' leads because its pages need
// nothing installed. A section too big to scan splits into
// TUTORIAL_SUBCATEGORIES rather than into more top-level headings.
export const TUTORIAL_CATEGORIES = [
  'genomes.jbrowse.org',
  'Getting started',
  'Synteny & comparative genomics',
  'Pangenomes',
  'Structural variation',
  'Cancer genomics',
  'Population genomics',
  'Epigenomics & single cell',
  'Transcriptomics & proteins',
  'Genes & annotation',
  'Grammar of graphics',
  'Configuration & embedding',
  'Automation',
]

export const TUTORIAL_FALLBACK = 'More tutorials'

// Ordered `tutorial_subcategory` values per category. A page in one of these
// categories without a subcategory draws above the subsections.
export const TUTORIAL_SUBCATEGORIES: Record<string, string[]> = {
  'Synteny & comparative genomics': [
    'Whole-genome alignments',
    'Ortholog tables',
  ],
  Pangenomes: ['HPRC release 2'],
  'Population genomics': ['Dog10K'],
}

// Curated order within each section, by slug; unlisted slugs follow
// alphabetically. Includes the root-level and external cards only the landing
// page shows.
export const TUTORIAL_ORDER = [
  'genomes_basics',
  'genomes_synteny',
  'genomes_proteins',
  'repeatmasker_classes',
  'quickstart_web',
  'quickstart_desktop',
  'synteny_visualization',
  'allvsall_synteny',
  'syri_synteny',
  'circular_synteny',
  'hg002_haplotypes',
  'hg38_vertebrates_synteny',
  'mcscan_synteny_grape_peach',
  'multiway_synteny_grape_peach_cacao',
  'orthofinder_synteny',
  'primate_orthologs_synteny',
  'ecoli_orthologs_synteny',
  'odp_linkage_groups_synteny',
  'homoeolog_synteny',
  'selection_pressure',
  'pangenome_ecoli',
  'pangenome_cactus',
  'pangenome_mouse',
  'pangenome_cattle',
  'pangenome_prepare_graph',
  'pangenome_hprc',
  'pangenome_hprc_part2',
  'pangenome_hprc_part3',
  'pangenome_hprc_part5',
  'pangenome_chrm',
  'sv_multisamples',
  'population_cnv',
  'hic_structural_variants',
  'mappability_qc',
  'sv_visualization_cgiab',
  'sv_callset_review',
  'cancer_sv',
  'k562_fusions',
  'tcga_cohort_mutations',
  'tcga_cohort_cnv',
  'population_genomics',
  'analyze_trio',
  'ld_human',
  'ld_mosquitoes',
  'bxd_qtl',
  'dog10k_selection',
  'dog10k_lof',
  'dog10k_svs',
  'local_ancestry',
  'methylation',
  'bisulfite',
  'chromhmm',
  'scatac_pseudobulk',
  'scrna_pseudobulk',
  'alphagenome',
  'rnaseq',
  'dtu',
  'tp53_structures',
  'gene_prediction_review',
  'gene_density',
  'alu_age',
  'read_marks',
  'cookbook',
  'display_settings',
  'embed_linear_genome_view',
  'embedding_examples',
  'cli_desktop',
  'agent_synteny',
  'agents',
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
// - pangenome_prepare_graph is the build page behind the pangenome graph
//   tracks: every picture of its output lives on the pages that read the files
//   it writes, so a card here would crop one of theirs and name the wrong
//   tutorial.
//
// Shared with the generator rather than kept next to the <img>, because the two
// halves of "does this card have a thumbnail" have to be the same list. They
// weren't: the landing page rendered an <img> for any key not listed here, while
// the generator only checked that its own specs still had pages. A new tutorial
// with no spec therefore linked a webp nobody had generated, and the first thing
// to notice was the website link checker.
export const TUTORIAL_NO_THUMB = new Set([
  'cli_desktop',
  'embedding_examples',
  'pangenome_prepare_graph',
  'agents',
])

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

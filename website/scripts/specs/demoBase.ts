// Where the E. coli pangenome demo's data files live.
//
// Every pggb/minigraph figure reads this demo, and its files are rebuilt by
// scripts/build_ecoli_pangenome_graph.sh and then uploaded. Between those two
// steps the hosted copy is the OLD build, so a spec for a track the rebuild
// just added renders a "track not found" frame rather than failing, which is
// the worst way to find out. Point this at a local `npx serve` of the build
// output to render the new figures before the upload:
//
//   npx --yes serve -l 8081 --cors ecoli_pangenome_graph_build/jbrowse2
//   ECOLI_DEMO_BASE=http://localhost:8081 node scripts/generate-screenshots.ts \
//     --filter pangenome
//
// Leave it unset to render against the hosted demo, which is what a committed
// figure and its live link must both point at — `pnpm check-live-configs`
// fails on a figure whose config lives on no server.
export const ECOLI_DEMO_BASE =
  process.env.ECOLI_DEMO_BASE ?? 'https://jbrowse.org/demos/ecoli_pangenome'

export const usingLocalDemo = Boolean(process.env.ECOLI_DEMO_BASE)

 - no click and drag lgv scroll when on bookmark icon
 - make 'show proper pairs':false still show discordant pairs, not just abnormally long ones?
 - make small samplot show at least 1px wide?
 - make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
 - aggressively refactor plugins/alignments/src/LinearAlignmentsDisplay/renderers/GpuAlignmentsRenderer.ts
 - aggressively refactor generate-screenshots

 1. Stop the browser from opening on pnpm start

  webpack/scripts/start.ts:56 has open: true. For jbrowse-web that's the right default (you want a browser
  tab); for desktop you want Electron to be the only client. I'd make it environment-gated:

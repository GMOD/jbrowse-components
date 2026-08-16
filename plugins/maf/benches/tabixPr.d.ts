// `@gmod/tabix-pr` is an alias esbuild fills in at bundle time from
// `TABIX_PR_SRC` — a checkout of GMOD/tabix-js#156, which is unpublished, so
// there is no package for tsc to resolve and no version to depend on. Declared
// here as the slice `mafTabixBytes.bench.ts` uses, which is also the clearest
// statement of what the PR adds: `lineBytesCallback` beside `lineCallback`,
// exactly one of the two.
declare module '@gmod/tabix-pr' {
  export class TabixIndexedFile {
    constructor(args: { path: string; tbiPath: string })

    getLines(
      refName: string,
      start: number,
      end: number,
      opts:
        | {
            lineCallback: (
              line: string,
              fileOffset: number,
              start: number,
              end: number,
            ) => void
          }
        | {
            lineBytesCallback: (
              buffer: Uint8Array,
              lineStart: number,
              lineEnd: number,
              fileOffset: number,
              start: number,
              end: number,
            ) => void
          },
    ): Promise<void>
  }
}

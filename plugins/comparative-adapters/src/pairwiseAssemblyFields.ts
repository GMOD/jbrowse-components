/**
 * How a pairwise comparative adapter names its two assemblies: the ordered pair,
 * plus the two single-string alternatives.
 *
 * Six adapters declared this trio and had drifted into four wordings of the same
 * three sentences — `assemblyNames` was described two ways, `targetAssembly`
 * and `queryAssembly` two more ("Alternative to assemblyNames array: the target
 * assembly" against "Alternative to assemblyNames: the target assembly name").
 * Nothing behaved differently; the config pages just said it differently six
 * times.
 *
 * **Only the pairwise adapters take this.** `AllVsAllPAFAdapter` and the MCScan
 * family also declare `assemblyNames`, and it does not mean an ordered
 * query/target pair there — all-vs-all names N assemblies and reads none of
 * them through this slot — so giving them the description would document a
 * meaning they do not have.
 */
export const pairwiseAssemblyFields = {
  assemblyNames: {
    type: 'stringArray',
    defaultValue: [],
    description:
      'Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second',
  },
  targetAssembly: {
    type: 'string',
    defaultValue: '',
    description: 'Alternative to assemblyNames: the target assembly name',
  },
  queryAssembly: {
    type: 'string',
    defaultValue: '',
    description: 'Alternative to assemblyNames: the query assembly name',
  },
} as const

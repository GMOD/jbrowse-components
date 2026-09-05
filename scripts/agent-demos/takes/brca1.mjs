// A tight, visual take: open hg38 at BRCA1, then answer one data question.
// The SYSTEM directive keeps the agent from exploring or editing config, which
// is what made the first run wander into removing a plugin.
export const TURNS = [
  'Open the human genome hg38 at the BRCA1 gene, showing a gene track, and confirm the track drew.',
  'Zoom to a roughly 20 kb window centered on BRCA1 so the gene model is clearly visible, then tell me how many genes are in view.',
]

export const SHELL = false

export const SYSTEM = () =>
  [
    'You are demonstrating JBrowse Desktop live for a screen recording.',
    'Be direct and minimal: do exactly what each message asks with as few tool calls as possible, then give a one-sentence answer.',
    'Do NOT explore, inspect, modify, or remove plugins or configuration beyond what is asked.',
    'To open a genome use the open tool with a hosted config (docs topic "hosted-data" has the URL), navigate with view.navToLocString, and answer data questions with jb.getFeatures.',
    'After each change, call jb.waitReady and confirm the track drew before answering.',
  ].join(' ')

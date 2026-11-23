// An `addassembly` fence tagged `genome=<name>` describes an assembly
// genomes.jbrowse.org also hosts under that name, so a reader can skip the
// files: the widget leads with a tab naming the three routes to the hosted
// copy (Desktop, genomes.jbrowse.org, `jbrowse add-assembly --genome`), and the
// raw markdown carries the same text under the fence. The fence's JSON stays as
// the fuller example. check-config-blocks holds the name to the hub's
// assembly, out of the digest gen-hosted-configs writes.
import { isGenArkAccession } from '../../../packages/launch-args/src/genome.ts'
import defaultFavs from '../../../products/jbrowse-desktop/src/components/StartScreen/defaultFavs.ts'
import { DESKTOP_UI_LABELS } from './derive-desktop-steps.ts'
import { fenceMeta } from './derive-session-url.ts'

import type { List, Paragraph, PhrasingContent, RootContent } from 'mdast'

type Part =
  | string
  | { code: string }
  | { strong: string }
  | { link: string; url: string }

export function hostedGenome(meta: string | null | undefined) {
  return fenceMeta(meta).genome || undefined
}

function hostedGenomePage(genome: string) {
  return isGenArkAccession(genome)
    ? `https://genomes.jbrowse.org/accession/${genome}/`
    : `https://genomes.jbrowse.org/ucsc/${genome}/`
}

function lead(genome: string): Part[] {
  return [
    'genomes.jbrowse.org hosts ',
    { code: genome },
    `, and this page's ${genome} tracks attach to it by that name. The other tabs build the same assembly from its files.`,
  ]
}

function routes(genome: string): Part[][] {
  const onStartScreen = defaultFavs.some(fav => fav.id === genome)
  return [
    [
      'In JBrowse Desktop, ',
      ...(onStartScreen
        ? [`click ${genome} on the start screen`]
        : [
            'click ',
            { strong: DESKTOP_UI_LABELS.allGenomes },
            ` on the start screen and pick ${genome}`,
          ]),
      ', or launch ',
      { code: `jbrowse-desktop --genome ${genome}` },
      '.',
    ],
    [
      'On the web, open ',
      { link: `${genome} on genomes.jbrowse.org`, url: hostedGenomePage(genome) },
      '.',
    ],
    [
      'In your own JBrowse Web, ',
      { code: `jbrowse add-assembly --genome ${genome}` },
      ' adds it to the ',
      { code: 'config.json' },
      ' in the current folder.',
    ],
  ]
}

function phrasing(parts: Part[]): PhrasingContent[] {
  return parts.map(part =>
    typeof part === 'string'
      ? { type: 'text', value: part }
      : 'code' in part
        ? { type: 'inlineCode', value: part.code }
        : 'strong' in part
          ? { type: 'strong', children: [{ type: 'text', value: part.strong }] }
          : {
              type: 'link',
              url: part.url,
              children: [{ type: 'text', value: part.link }],
            },
  )
}

function markdown(parts: Part[]) {
  return parts
    .map(part =>
      typeof part === 'string'
        ? part
        : 'code' in part
          ? `\`${part.code}\``
          : 'strong' in part
            ? `**${part.strong}**`
            : `[${part.link}](${part.url})`,
    )
    .join('')
}

export function hostedGenomeNodes(genome: string): RootContent[] {
  return [
    {
      type: 'paragraph',
      children: phrasing(lead(genome)),
    } satisfies Paragraph,
    {
      type: 'list',
      ordered: false,
      spread: false,
      children: routes(genome).map(parts => ({
        type: 'listItem',
        spread: false,
        children: [{ type: 'paragraph', children: phrasing(parts) }],
      })),
    } satisfies List,
  ]
}

export function hostedGenomeLines(genome: string) {
  return [
    '',
    `Hosted: ${markdown(lead(genome))}`,
    '',
    ...routes(genome).map(parts => `- ${markdown(parts)}`),
  ]
}

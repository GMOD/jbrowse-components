/// <reference types="jest" />
// Same tsconfig situation as docFenceRegions.test.ts: without the reference
// above, every `test`/`expect` here reads as an undefined name under
// `astro check`.

/**
 * The shell-snippet parser behind `check-script-commands`, whose failure mode is
 * a guard that passes because it found nothing.
 *
 * The check asserts that every tool a tutorial shows still runs in the build
 * script the command was lifted from. If this parser returns an empty list, the
 * check reports "every marked command still runs" on a page full of commands
 * that no longer do, and nothing distinguishes that from the healthy case. The
 * awk-body and continuation cases below are the two that actually broke it.
 */
import { invocations, toolsAndFlags } from './shellCommands.ts'

test('a plain invocation yields its tool and long/short flags', () => {
  expect(toolsAndFlags('bwameth.py --reference ref.fa -t 8 R1.fq.gz')).toEqual([
    { tool: 'bwameth.py', flags: ['--reference', '-t'] },
  ])
})

test('each pipeline stage is its own invocation', () => {
  expect(
    toolsAndFlags('bcftools mpileup -a AD in.bam | bcftools query -f fmt').map(
      t => t.tool,
    ),
  ).toEqual(['bcftools', 'bcftools'])
})

test('a backslash continuation stays one invocation', () => {
  // Regression: the second line parsed as a tool named `gt=chr1.gt.vcf.gz`.
  const found = toolsAndFlags(
    [
      'java -Xmx12g -jar flare.jar ref=a.vcf.gz \\',
      '  gt=b.vcf.gz seed=42',
    ].join('\n'),
  )
  expect(found).toHaveLength(1)
  expect(found[0]!.tool).toBe('java')
})

test('a multi-line quoted awk program is not a series of commands', () => {
  // Regression: `end=$2+2000;` and a bare `}'` each parsed as a tool, which is
  // the noise that gets a check switched off rather than fixed.
  const found = toolsAndFlags(
    [
      "awk -F'\\t' 'NR==FNR{len[$1]=$2; next}",
      '     FNR>1 {',
      '       end=$2+2000; if (end>len[$1]) end=len[$1]',
      '       print $1, end',
      "     }' sizes.txt data.txt",
    ].join('\n'),
  )
  expect(found).toHaveLength(1)
  expect(found[0]!.tool).toBe('awk')
})

test('a leading VAR=value assignment is not the command', () => {
  expect(toolsAndFlags('LC_COLLATE=C sort -k1,1 in.bed')[0]!.tool).toBe('sort')
})

test('a bare assignment line contributes no tool', () => {
  expect(toolsAndFlags('PANEL=https://example.org/panel.bcf')).toEqual([])
})

test('comments are dropped outside quotes and kept inside them', () => {
  expect(toolsAndFlags('# just a note')).toEqual([])
  expect(toolsAndFlags('samtools view in.bam  # trailing note')).toEqual([
    { tool: 'samtools', flags: [] },
  ])
  // `#` inside a PanSN path is data, not a comment.
  const found = toolsAndFlags(`awk -v p="K12#1#chr" '{print $1}' in.tsv`)
  expect(found).toHaveLength(1)
  expect(found[0]!.flags).toEqual(['-v'])
})

test('shell builtins and quickstart plumbing are skipped', () => {
  expect(toolsAndFlags('cd build; curl -fO https://example.org/x.sh')).toEqual(
    [],
  )
})

test('invocations never silently swallows a snippet', () => {
  // The guard on the guard: whatever the parsing details, a snippet holding
  // commands must not come back empty.
  const snippet = [
    'vcftools --gzvcf in.vcf.gz --TajimaD 2000 --out d',
    "awk 'NR>1 {print}' d.Tajima.D | sort -k1,1 > d.bg",
    'bedGraphToBigWig d.bg chrom.sizes d.bw',
  ].join('\n')
  expect(invocations(snippet).length).toBeGreaterThanOrEqual(4)
  expect(toolsAndFlags(snippet).map(t => t.tool)).toEqual([
    'vcftools',
    'awk',
    'sort',
    'bedGraphToBigWig',
  ])
})

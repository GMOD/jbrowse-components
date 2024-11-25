/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'
import { runCommand } from '@oclif/test'
import nock from 'nock'

import {
  runInTmpDir,
  ctxDir,
  dataDir,
  readConf,
  readConfAlt,
} from '../testUtil'

const { copyFile, writeFile, mkdir } = fs.promises

// Cleaning up exitCode in Node.js 20, xref https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))

test('add-assembly no load flag', async () => {
  const { error } = await runCommand('add-assembly {}')
  expect(error?.message).toMatchSnapshot()
})

test('fails if using inline JSON sequence custom with no --name', async () => {
  const { error } = await runCommand(['add-assembly', '{}', '--load', 'copy'])
  expect(error?.message).toMatchSnapshot()
})
test('fails if custom sequence adapter has no type', async () => {
  const { error } = await runCommand([
    'add-assembly',
    '{}',
    '--name',
    'simple',
    '--load',
    'copy',
  ])
  expect(error?.message).toMatchSnapshot()
})
test('fails if custom refNameAliases adapter has no type', async () => {
  const { error } = await runCommand([
    'add-assembly',
    '{"type":"fromConfigSequenceAdapter"}',
    '--name',
    'simple',
    '--refNameAliases',
    '{}',
    '--refNameAliasesType',
    'custom',
    '--load',
    'copy',
  ])
  expect(error?.message).toMatchSnapshot()
})
test('fails if custom refNameAliases adapter has no type', async () => {
  const { error } = await runCommand([
    'add-assembly',
    '{"type":"fromConfigSequenceAdapter"}',
    '--name',
    'simple',
    '--refNameAliases',
    '{}',
    '--refNameAliasesType',
    'custom',
    '--load',
    'copy',
  ])
  expect(error?.message).toMatchSnapshot()
})

test('fails if trying to add an assembly with a name that already exists', async () => {
  await runInTmpDir(async ctx => {
    const simple2bit = path.join(
      __dirname,
      '..',
      '..',
      'test',
      'data',
      'simple.2bit',
    )
    await copyFile(simple2bit, path.join(ctx.dir, path.basename(simple2bit)))
    await runCommand('add-assembly simple.2bit --load copy')
    const { error } = await runCommand('add-assembly simple.2bit --load copy')
    expect(error?.message).toMatchSnapshot()
  })
})
test('fails if it cannot guess the sequence type', async () => {
  const { error } = await runCommand([
    'add-assembly',
    'simple.unusual.extension.xyz',
    '--load',
    'copy',
  ])
  expect(error?.message).toMatchSnapshot()
})

test('fails if it cannot find a file', async () => {
  const { error } = await runCommand([
    'add-assembly',
    'simple.doesNotExist.fasta',
    '--load',
    'copy',
  ])
  expect(error?.message).toMatchSnapshot()
})

test('fails if using invalid inline JSON', async () => {
  const { error } = await runCommand([
    'add-assembly',
    '{"type":"fromConfigSequenceAdapter"}',
    '--name',
    'simple',
    '--refNameAliases',
    'notValidJSON',
    '--refNameAliasesType',
    'custom',
    '--load',
    'copy',
  ])
  expect(error?.message).toMatchSnapshot()
})

test('fails if load flag is passed with a URL', async () => {
  const { error } = await runCommand([
    'add-assembly',
    'https://mysite.com/data/simple.2bit',
    '--load',
    'copy',
  ])
  expect(error?.message).toMatchSnapshot()
})

test('adds an assembly from a FASTA', async () => {
  await runInTmpDir(async ctx => {
    fs.copyFileSync(dataDir('simple.fasta'), ctxDir(ctx, 'simple.fasta'))
    fs.copyFileSync(
      dataDir('simple.fasta.fai'),
      ctxDir(ctx, 'simple.fasta.fai'),
    )
    await runCommand(['add-assembly', 'simple.fasta', '--load', 'copy'])
    expect(readConf(ctx)).toMatchSnapshot()
  })
})

test('adds an assembly from a FASTA (.fa extension)', async () => {
  await runInTmpDir(async ctx => {
    fs.copyFileSync(dataDir('simple.fasta'), ctxDir(ctx, 'simple.fa'))
    fs.copyFileSync(dataDir('simple.fasta.fai'), ctxDir(ctx, 'simple.fa.fai'))
    await runCommand(['add-assembly', 'simple.fa', '--load', 'copy'])
    expect(readConf(ctx)).toMatchSnapshot()
  })
})

test('adds an assembly from a FASTA (bgzip)', async () => {
  await runInTmpDir(async ctx => {
    fs.copyFileSync(dataDir('simple.fasta.gz'), ctxDir(ctx, 'simple.fasta.gz'))
    fs.copyFileSync(
      dataDir('simple.fasta.gz.fai'),
      ctxDir(ctx, 'simple.fasta.gz.fai'),
    )
    fs.copyFileSync(
      dataDir('simple.fasta.gz.gzi'),
      ctxDir(ctx, 'simple.fasta.gz.gzi'),
    )
    await runCommand(['add-assembly', 'simple.fasta.gz', '--load', 'copy'])
    expect(readConf(ctx)).toMatchSnapshot()
  })
})

test('adds an assembly from a 2bit', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(dataDir('simple.2bit'), ctxDir(ctx, 'simple.2bit'))
    await runCommand(['add-assembly', 'simple.2bit', '--load', 'copy'])
    expect(readConf(ctx)).toMatchSnapshot()
  })
})
test('adds an assembly from chrom.sizes', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(
      dataDir('simple.chrom.sizes'),
      ctxDir(ctx, 'simple.chrom.sizes'),
    )
    await runCommand(['add-assembly', 'simple.chrom.sizes', '--load', 'copy'])
    expect(readConf(ctx)).toMatchSnapshot()
  })
})
test('adds an assembly from a custom adapter JSON file', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(dataDir('simple.json'), ctxDir(ctx, 'simple.json'))
    await runCommand(['add-assembly', 'simple.json', '--load', 'copy'])
    expect(readConf(ctx)).toMatchSnapshot()
  })
})

test('adds an assembly from a custom adapter inline JSON', async () => {
  await runInTmpDir(async ctx => {
    await runCommand([
      'add-assembly',
      '{"type":"FromConfigRegionsAdapter","features":[{"refName":"SEQUENCE_1","uniqueId":"firstId","start":0,"end":233},{"refName":"SEQUENCE_2","uniqueId":"secondId","start":0,"end":120}]}',
      '--name',
      'simple',
      '--load',
      'copy',
    ])
    expect(readConf(ctx)).toMatchSnapshot()
  })
})

test("can specify --type when the type can't be inferred from the extension", async () => {
  await runInTmpDir(async ctx => {
    fs.copyFileSync(dataDir('simple.2bit'), ctxDir(ctx, 'simple.2bit.xyz'))

    await runCommand([
      'add-assembly',
      'simple.2bit.xyz',
      '--type',
      'twoBit',
      '--load',
      'copy',
    ])
    expect(readConf(ctx)).toMatchSnapshot()
  })
})
test('can specify a custom faiLocation and gziLocation', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(dataDir('simple.fasta.gz'), ctxDir(ctx, 'simple.fasta.gz'))
    await copyFile(
      dataDir('simple.fasta.gz.fai'),
      ctxDir(ctx, 'simple.fasta.gz.fai.abc'),
    )
    await copyFile(
      dataDir('simple.fasta.gz.gzi'),
      ctxDir(ctx, 'simple.fasta.gz.gzi.def'),
    )

    await runCommand([
      'add-assembly',
      'simple.fasta.gz',
      '--faiLocation',
      'simple.fasta.gz.fai.abc',
      '--gziLocation',
      'simple.fasta.gz.gzi.def',
      '--load',
      'copy',
    ])
    expect(readConf(ctx)).toMatchSnapshot()
  })
})

test('can specify a custom name and alias', async () => {
  await runInTmpDir(async ctx => {
    await runCommand([
      'add-assembly',
      '{"type":"CustomAdapter"}',
      '--name',
      'customName',
      '--alias',
      'customAlias',
      '--load',
      'copy',
    ])

    expect(readConf(ctx)).toMatchSnapshot()
  })
})
test('can specify a multiple aliases', async () => {
  await runInTmpDir(async ctx => {
    await runCommand([
      'add-assembly',
      '{"type":"CustomAdapter"}',
      '--name',
      'simple',
      '--alias',
      'firstAlias',
      '--alias',
      'secondAlias',
      '--load',
      'copy',
    ])

    expect(readConf(ctx)).toMatchSnapshot()
  })
})
test('can specify a refNameAliases file', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(dataDir('simple.aliases'), ctxDir(ctx, 'simple.aliases'))
    await runCommand([
      'add-assembly',
      '{"type":"CustomAdapter"}',
      '--name',
      'simple',
      '--refNameAliases',
      'simple.aliases',
      '--load',
      'copy',
    ])

    expect(readConf(ctx)).toMatchSnapshot()
  })
})

test('can specify a refNameAliases file type custom', async () => {
  await runInTmpDir(async ctx => {
    await runCommand([
      'add-assembly {"type":"CustomAdapter"}',
      '--name',
      'simple',
      '--refNameAliases',
      '{"type":"CustomAdapter"}',
      '--refNameAliasesType',
      'custom',
      '--load',
      'copy',
    ])

    expect(readConf(ctx)).toMatchSnapshot()
  })
})
test('can specify a custom name and alias and refNameColors', async () => {
  await runInTmpDir(async ctx => {
    await runCommand([
      'add-assembly {"type":"CustomAdapter"}',
      '--name',
      'simple',
      '--refNameColors',
      'red,orange,yellow,green,blue,purple',
      '--load',
      'copy',
    ])

    expect(readConf(ctx)).toMatchSnapshot()
  })
})
test('can use an existing config file', async () => {
  await runInTmpDir(async ctx => {
    await writeFile('config.json', '{}')
    await runCommand([
      'add-assembly',
      '{"type":"CustomAdapter"}',
      '--name',
      'simple',
      '--load',
      'copy',
    ])

    expect(readConf(ctx)).toMatchSnapshot()
  })
})
test('can use --overwrite to replace an existing assembly', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(dataDir('simple.2bit'), ctxDir(ctx, 'simple.2bit'))
    await runCommand(['add-assembly', 'simple.2bit', '--load', 'copy'])
    await runCommand([
      'add-assembly',
      'simple.2bit',
      '--overwrite',
      '--load',
      'copy',
    ])

    expect(readConf(ctx)).toMatchSnapshot()
  })
})

test('relative path', async () => {
  await runInTmpDir(async ctx => {
    await mkdir('jbrowse')
    await copyFile(dataDir('simple.2bit'), ctxDir(ctx, 'simple.2bit'))
    process.chdir('jbrowse')
    await runCommand([
      'add-assembly',
      path.join('..', 'simple.2bit'),
      '--load',
      'inPlace',
    ])
    expect(readConf(ctx, 'jbrowse')).toMatchSnapshot()
  })
})

test('adds an assembly from a URL', async () => {
  await runInTmpDir(async ctx => {
    nock('https://mysite.com').head('/data/simple.2bit').reply(200)
    await runCommand(['add-assembly', 'https://mysite.com/data/simple.2bit'])
    expect(readConf(ctx)).toMatchSnapshot()
  })
})
test('can use --out to make a new directory', async () => {
  await runInTmpDir(async ctx => {
    fs.copyFileSync(dataDir('simple.2bit'), ctxDir(ctx, 'simple.2bit'))
    await runCommand([
      'add-assembly',
      'simple.2bit',
      '--load',
      'copy',
      '--out',
      'testing',
    ])
    expect(readConf(ctx, 'testing').assemblies.length).toBe(1)
  })
})
test('can use --out to write to a file', async () => {
  await runInTmpDir(async ctx => {
    fs.copyFileSync(dataDir('simple.2bit'), ctxDir(ctx, 'simple.2bit'))
    await runCommand([
      'add-assembly',
      'simple.2bit',
      '--load',
      'copy',
      '--out',
      'out/testing.json',
    ])
    expect(readConfAlt(ctx, 'out', 'testing.json').assemblies.length).toBe(1)
  })
})

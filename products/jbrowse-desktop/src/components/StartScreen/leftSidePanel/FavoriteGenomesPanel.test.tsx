import { render, screen } from '@testing-library/react'

import defaultFavs from '../defaultFavs.ts'
import FavoriteGenomesPanel from './FavoriteGenomesPanel.tsx'

import type { Fav } from '../types.ts'

function fav(over: Partial<Fav> & Pick<Fav, 'id'>): Fav {
  return {
    shortName: over.id,
    description: '',
    commonName: '',
    jbrowseConfig: `https://example.com/${over.id}/config.json`,
    ...over,
  }
}

function labels(favorites: Fav[]) {
  render(
    <FavoriteGenomesPanel
      favorites={favorites}
      setFavorites={jest.fn()}
      launch={jest.fn()}
    />,
  )
  return screen.getAllByRole('link').map(link => link.textContent)
}

test('the defaults read as organism, name and assembly, newest first', () => {
  expect(labels(defaultFavs)).toEqual([
    'Human hg38 (GRCh38)',
    'Human hs1 (T2T CHM13v2.0)',
    'Human hg19 (GRCh37)',
  ])
})

test('defaults lead in their own order however they were stored, then added favorites in the order added', () => {
  const mouse = fav({
    id: 'mm39',
    description: 'Jun. 2020 (GRCm39/mm39)',
    commonName: 'Mouse',
  })
  const panda = fav({
    id: 'GCF_000004335.4',
    shortName: 'ASM433v2',
    description: 'giant panda',
    commonName: 'giant panda',
  })
  expect(labels([panda, ...defaultFavs.toReversed(), mouse])).toEqual([
    'Human hg38 (GRCh38)',
    'Human hs1 (T2T CHM13v2.0)',
    'Human hg19 (GRCh37)',
    'giant panda ASM433v2',
    'Mouse mm39 (GRCm39)',
  ])
})

test('a favorite missing a common name or description still gets a label', () => {
  expect(
    labels([
      fav({ id: 'a', shortName: 'danRer11', description: '(GRCz11/danRer11)' }),
      fav({ id: 'b', shortName: 'xyz1', commonName: 'Yeast' }),
      fav({ id: 'c', shortName: 'abc2', description: '(abc2)' }),
    ]),
  ).toEqual(['danRer11 (GRCz11)', 'Yeast xyz1', 'abc2'])
})

import { getCollection, type CollectionEntry } from 'astro:content';

export type Work = CollectionEntry<'works'>;
export type WorkType = Work['data']['type'];

export const typeMeta: Record<WorkType, { label: string; en: string; href: string; motif: string }> = {
  illustration: { label: '插画', en: 'ILLUSTRATION', href: '/works/?type=illustration', motif: '✦' },
  novel: { label: '小说', en: 'NOVEL', href: '/works/?type=novel', motif: '❋' },
  video: { label: '影像', en: 'MOTION', href: '/works/?type=video', motif: '◉' },
};

export function workHref(work: Work) {
  return `/works/${work.id}/`;
}

export async function getWorks() {
  const works = await getCollection('works');
  return works.sort((a, b) => a.data.order - b.data.order);
}

export async function getFeatured() {
  const works = await getWorks();
  return works.filter((work) => work.data.featured);
}

export function getNextWork(works: Work[], id: string) {
  const index = works.findIndex((work) => work.id === id);
  return works[(index + 1) % works.length];
}

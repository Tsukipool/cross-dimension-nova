import { getCollection, type CollectionEntry } from 'astro:content';
import { withBase } from './url';

export type Work = CollectionEntry<'works'>;
export type WorkType = Work['data']['type'];

export const typeMeta: Record<WorkType, { label: string; en: string; href: string; motif: string }> = {
  illustration: { label: '插画', en: 'ILLUSTRATION', href: withBase('/works/?type=illustration'), motif: '✦' },
  novel: { label: '小说', en: 'NOVEL', href: withBase('/works/?type=novel'), motif: '❋' },
  video: { label: '影像', en: 'MOTION', href: withBase('/works/?type=video'), motif: '◉' },
};

function withBaseWork(work: Work): Work {
  return {
    ...work,
    data: {
      ...work.data,
      cover: withBase(work.data.cover),
      video: work.data.video ? withBase(work.data.video) : undefined,
      gallery: work.data.gallery.map((item) => ({
        ...item,
        src: withBase(item.src),
      })),
    },
  } as Work;
}

export function workHref(work: Work) {
  return withBase(`/works/${work.id}/`);
}

export async function getWorks() {
  const works = await getCollection('works');
  return works
    .map(withBaseWork)
    .sort((a, b) => a.data.order - b.data.order);
}

export async function getFeatured() {
  const works = await getWorks();
  return works.filter((work) => work.data.featured);
}

export function getNextWork(works: Work[], id: string) {
  const index = works.findIndex((work) => work.id === id);
  return works[(index + 1) % works.length];
}

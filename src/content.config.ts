import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const galleryItem = z.object({
  src: z.string(),
  alt: z.string(),
  caption: z.string().optional(),
});

const works = defineCollection({
  loader: glob({ base: './src/content/works', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    english: z.string(),
    type: z.enum(['illustration', 'novel', 'video']),
    category: z.string(),
    serial: z.string(),
    year: z.string(),
    date: z.string(),
    cover: z.string(),
    accent: z.string(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    order: z.number().default(99),
    gallery: z.array(galleryItem).default([]),
    video: z.string().optional(),
    duration: z.string().optional(),
    credits: z.array(z.object({ role: z.string(), name: z.string() })).default([]),
    quote: z.string().optional(),
    readingTime: z.string().optional(),
    motif: z.string().default('✦'),
  }),
});

export const collections = { works };

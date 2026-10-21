import { SITE, type Faq } from '../data/site';
import { getCollection, type CollectionEntry } from 'astro:content';

export const abs = (path: string) => new URL(path, SITE).href;

export function faqSchema(faqs: Faq[], path: string) {
  return {
    '@type': 'FAQPage',
    '@id': `${abs(path)}#faq`,
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export type Post = CollectionEntry<'insights'>;

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('insights', ({ data }) => (import.meta.env.PROD ? !data.draft : true));
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function readingTime(body: string): string {
  const words = (body || '').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);

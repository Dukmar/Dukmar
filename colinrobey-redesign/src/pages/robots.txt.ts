import type { APIRoute } from 'astro';
import { SITE, PREVIEW } from '../data/site';

// AI search and assistant crawlers are named and allowed explicitly: being readable by them
// is part of what this site sells. Training crawlers are allowed too, so the business entity
// is known to the models themselves, not only to their live search.
const AI_BOTS = [
  'OAI-SearchBot', 'ChatGPT-User', 'GPTBot',
  'Claude-SearchBot', 'Claude-User', 'ClaudeBot',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot', 'Applebot-Extended', 'Bingbot', 'DuckAssistBot', 'MistralAI-User', 'Meta-ExternalAgent',
];

export const GET: APIRoute = () => {
  const body = PREVIEW
    ? ['# Redesign preview: kept out of search until it replaces the live site.', 'User-agent: *', 'Disallow: /', ''].join('\n')
    : [
        ...AI_BOTS.flatMap((b) => [`User-agent: ${b}`, 'Allow: /', '']),
        'User-agent: *',
        'Allow: /',
        'Disallow: /success/',
        '',
        `Sitemap: ${SITE}/sitemap-index.xml`,
        '',
      ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

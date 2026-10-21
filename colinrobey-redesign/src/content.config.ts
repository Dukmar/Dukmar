import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Insights (blog) — the GEO engine. Markdown only (MDX turns a content typo into a
// failed deploy). Frontmatter is schema-validated so a malformed post fails loudly at
// build, not silently in production.
const insights = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/insights' }),
  schema: z.object({
    title: z.string(),
    // Optional <title> override when the headline runs past 60 characters. The headline
    // stays as written on the page and the cards; only the tab/SERP title changes.
    seoTitle: z.string().optional(),
    // description drives the meta description, the card excerpt, and the AI-extractable
    // summary — required so no post ships without one. Hand-written, payoff-first.
    description: z.string(),
    // The post's front-loaded, one-sentence answer. Rendered in the "answer card" header
    // and doubles as the extractable TL;DR. Required for the same reason.
    answer: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tag: z.string(), // single primary tag, shown as the header eyebrow
    draft: z.boolean().default(false),
    // Optional per-post social/OG image (public path, e.g. /og/slug.jpg). When set, the post
    // overrides the sitewide og-colin-robey.jpg so shares/Featured cards show a branded card
    // instead of the default face banner. Falls back to the sitewide image when omitted.
    image: z.string().optional(),
    // Alt text for that card. Omit and the layout describes the generated card from the
    // title, which is correct for cards built by scripts/build-insight-card.py. Set it
    // explicitly for any card whose art is more than the headline.
    imageAlt: z.string().optional(),
    // Optional real FAQ — only when the post genuinely contains a Q&A section. When
    // present, the layout renders it visibly AND emits FAQPage schema. Never emit FAQ
    // schema without matching visible content.
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  }),
});

export const collections = { insights };

import type { APIRoute } from 'astro';
import { SITE, AUTHOR, BUSINESS, SERVICES, STORY, AREAS, HOME_FAQS } from '../data/site';
import { getPosts, iso } from '../lib/schema';

// Built from the same data file as the pages, so it can't drift from what the site says.
export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const lines = [
    '# Colin Robey: website design for small businesses, Burlington, Ontario',
    '',
    `> Colin Robey is an independent website designer and AI-assisted marketing consultant in Burlington, Ontario, Canada. He designs and builds fast, custom websites for owner-led small service businesses (recruiting, accounting, law, trades, advisory) across ${AREAS.map((a) => a.name).join(', ')} and Southern Ontario. Sites are built to be found in Google and in AI answers, and owned outright by the client with no monthly platform subscription. Most sites run on a free hosting plan, so the main running cost is the domain. One person does the work; there is no agency layer.`,
    '',
    '## Services and prices (CAD)',
    '',
    ...SERVICES.map((s) => `- [${s.name}](${SITE}${s.href}): ${s.price}. ${s.blurb} Turnaround: ${s.time}.${s.credit ? ` ${s.credit} if the client goes on.` : ''}`),
    '- Site Care Plan: optional after the 90 days of support included with every build. Month to month, 30 days’ notice; a post or two a month, light updates, and a quarterly check on search and AI visibility. Priced to the site; no published rate.',
    '- No website yet: start with a free twenty-minute call instead of the scorecard.',
    '',
    '## Proof',
    '',
    `- [${STORY.client} case study](${SITE}/work/the-story-group/): ${STORY.industry} firm in ${STORY.where}. Aging Wix site rebuilt as a custom site with a page per specialization; Google PageSpeed mobile score ${STORY.speedAfter}/100, up from ${STORY.speedBefore}; forms that capture inquiries the old site could not track. Testimonial from ${STORY.person}, ${STORY.role}.`,
    '',
    '## Common questions',
    '',
    ...HOME_FAQS.map((f) => `- ${f.q} ${f.a}`),
    '',
    '## Insights',
    '',
    ...posts.map((p) => `- [${p.data.title}](${SITE}/insights/${p.id}/): ${p.data.answer} (Published ${iso(p.data.pubDate)}.)`),
    '',
    '## Contact',
    '',
    `- Name: ${AUTHOR.name}. Role: ${AUTHOR.jobTitle}. Based in Burlington, Ontario, Canada.`,
    `- Email: ${AUTHOR.email}. Phone: ${BUSINESS.telephoneDisplay}.`,
    `- Start here: ${SITE}/scorecard/ (free website scorecard) or ${SITE}/contact/.`,
    `- Profiles: ${BUSINESS.sameAs.join(', ')}.`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

import rss from '@astrojs/rss';
import { getPosts } from '../lib/schema';

export async function GET(context) {
  const posts = await getPosts();
  return rss({
    title: 'Colin Robey: Insights',
    description: 'Plain-English notes on getting a small business found in Google and named in AI answers.',
    site: context.site,
    items: posts.map((p) => ({ title: p.data.title, description: p.data.description, pubDate: p.data.pubDate, link: `/insights/${p.id}/` })),
    customData: '<language>en-ca</language>',
  });
}

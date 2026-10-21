import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://colinrobey.ca',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !/\/(success|404)\/?$/.test(page),
    }),
  ],
  build: { inlineStylesheets: 'always' },
});

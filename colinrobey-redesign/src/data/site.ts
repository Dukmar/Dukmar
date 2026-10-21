// One source of truth for every fact the site states. Pages, JSON-LD, llms.txt and the
// footer all read from here, so a price or a name can't say one thing in the copy and
// another in the schema (that mismatch is what gets a page distrusted by search and AI).
//
// Facts are carried over verbatim from the live colinrobey.ca build. Nothing here is new
// or invented: if a number isn't in the live site or the claims ledger, it isn't here.

export const SITE = 'https://colinrobey.ca';

// PREVIEW keeps this redesign out of search while it's being reviewed: a noindex meta on
// every page and a Disallow in robots.txt. It's on unless the build sets PREVIEW=false,
// which should happen only at go-live, on the real domain (see netlify.toml).
export const PREVIEW = process.env.PREVIEW !== 'false';

export const AUTHOR = {
  id: `${SITE}/#colin`,
  name: 'Colin Robey',
  url: `${SITE}/`,
  jobTitle: 'Website designer and AI-assisted marketing consultant',
  description:
    'Independent website designer and AI-assisted marketing consultant in Burlington, Ontario, building fast, custom websites for small Canadian service businesses.',
  image: `${SITE}/colin-robey.jpg`,
  linkedin: 'https://www.linkedin.com/in/colinrobey/',
  email: 'hello@colinrobey.ca',
  sameAs: ['https://www.linkedin.com/in/colinrobey/'],
  knowsAbout: [
    'Website design',
    'Website redesign',
    'Search engine optimization',
    'Generative engine optimization',
    'Local SEO',
    'Google Business Profile',
    'Structured data',
    'Small business marketing',
  ],
};

export const BUSINESS = {
  id: `${SITE}/#business`,
  name: 'Colin Robey',
  legalName: 'Colin Robey',
  slogan: 'Websites that make small businesses look as good as they are.',
  telephone: '+1-289-812-9084',
  telephoneDisplay: '(289) 812-9084',
  email: 'hello@colinrobey.ca',
  locality: 'Burlington',
  region: 'ON',
  regionName: 'Ontario',
  country: 'CA',
  sameAs: [
    'https://www.linkedin.com/company/colinrobey/',
    'https://www.linkedin.com/in/colinrobey/',
    'https://maps.google.com/?cid=12486607978732330945',
  ],
};

// Service area. Named towns are where the work is local enough for a coffee; everything
// else is "Southern Ontario", which is true and doesn't invent a presence anywhere.
export const AREAS = [
  { name: 'Burlington', note: 'Home base' },
  { name: 'Oakville', note: 'The STORY Group is here' },
  { name: 'Hamilton', note: '' },
  { name: 'Milton', note: '' },
  { name: 'Mississauga', note: '' },
  { name: 'Halton Hills', note: '' },
  { name: 'Grimsby', note: '' },
  { name: 'Toronto', note: '' },
];

export type Service = {
  slug: string;
  href: string;
  name: string;
  short: string;
  price: string;
  priceValue?: number;
  kicker: string;
  blurb: string;
  bullets: string[];
  credit?: string;
  time: string;
};

// The ladder, cheapest rung first. Order is the argument: diagnose before you rebuild.
export const SERVICES: Service[] = [
  {
    slug: 'scorecard',
    href: '/scorecard/',
    name: 'Website Scorecard',
    short: 'Scorecard',
    price: 'Free',
    priceValue: 0,
    kicker: 'A first look',
    blurb:
      'A one-page read on your current site: four letter grades and the three things I’d fix first, in order.',
    bullets: ['Design, SEO, AI-Readiness and performance, graded', 'The three fixes I’d make first', 'By email, no call required'],
    time: 'Usually a few days',
  },
  {
    slug: 'website-diagnostic',
    href: '/services/website-diagnostic/',
    name: 'Website Diagnostic',
    short: 'Diagnostic',
    price: '$400',
    priceValue: 400,
    kicker: 'The site, page by page',
    blurb:
      'Every page on your site read closely, plus a live check of where you show up when someone asks an AI, and who gets named instead.',
    bullets: ['A page-by-page read', 'The live AI check: who gets named instead of you', 'A prioritized fix list that’s yours to keep'],
    credit: '$400 comes off a Growth Audit',
    time: 'Five business days',
  },
  {
    slug: 'growth-audit',
    href: '/services/growth-audit/',
    name: 'Growth Audit',
    short: 'Audit',
    price: '$2,500',
    priceValue: 2500,
    kicker: 'The whole path',
    blurb:
      'How a stranger finds you, becomes a lead, and books a call, and where that path leaks. Ends in a 30/60/90-day plan.',
    bullets: ['Site, content and AI visibility together', 'How leads reach you and where they fall through', 'A 30/60/90-day plan in plain language'],
    credit: '$2,500 comes off a website build',
    time: 'About two weeks',
  },
  {
    slug: 'website-rebuild',
    href: '/services/website-rebuild/',
    name: 'Website design and build',
    short: 'Build',
    price: 'from $6,500',
    priceValue: 6500,
    kicker: 'The build',
    blurb:
      'A fast, custom site designed around your business, built to be found in Google and in AI answers, and owned by you outright.',
    bullets: ['Designed from scratch around your business', 'SEO and AI-search built in', 'Yours outright, no monthly platform fee', '90 days of hands-on support'],
    time: 'Six to eight weeks',
  },
];

export const STORY = {
  client: 'The STORY Group',
  clientUrl: 'https://storygroup.ca',
  where: 'Oakville, ON',
  industry: 'Recruiting',
  person: 'Ian O’Reilly',
  role: 'President',
  speedBefore: 62,
  speedAfter: 98,
  quote:
    'What stood out wasn’t just the website, it was the strategic thinking behind it. From the outset, Colin’s approach aligned with our mission of leveraging data, analytics, & technology. Every recommendation had a clear purpose, and the improvements were noticeable almost immediately. Our site is significantly faster, our search visibility has grown substantially, and we’re now receiving and tracking inquiries that we simply weren’t before. The end result has given us a much stronger online presence and a better platform for attracting both candidates and clients.',
  quoteShort:
    'What stood out wasn’t just the website, it was the strategic thinking behind it. Our site is significantly faster, and we’re now receiving and tracking inquiries that we simply weren’t before.',
  quoteDate: '2026-07-23',
};

export type Faq = { q: string; a: string };

// Homepage FAQ: the questions a small-business owner types into Google or an assistant,
// answered first-sentence-first so the answer survives being quoted on its own.
export const HOME_FAQS: Faq[] = [
  {
    q: 'How much does a small business website cost in Canada?',
    a: 'Mine start at $6,500 for a handful of pages, built custom and owned outright with no monthly platform fee. What moves the number is how many pages you need, how much of the writing falls to me, and whether anything has to connect to a system you already run. You get a fixed price before any work starts.',
  },
  {
    q: 'How long does a website redesign take?',
    a: 'Most builds run six to eight weeks for a handful of pages. The timing depends on how many pages you need and how quickly we settle the content together. You hear from me weekly with what’s done and what’s next.',
  },
  {
    q: 'Do I own the website when it’s done?',
    a: 'Yes. The code and the content are yours outright, with no monthly platform fee to keep it online. You’re not renting it, and you’re not locked into me to make changes later.',
  },
  {
    q: 'Will my new site show up in Google and in ChatGPT?',
    a: 'It’s built to: clean markup, structured data, fast pages, a page for each thing you want to be found for, and plain answers an assistant can quote. Nobody outside Google controls rankings, and nobody outside the AI companies controls whether an assistant names you, so I don’t promise positions. I show you where you stand before and after.',
  },
  {
    q: 'What if I don’t have a website at all yet?',
    a: 'That’s fine, and it happens more than you’d think. There’s nothing to score or diagnose, so we start with a twenty-minute call about what your customers search for and how many pages you’d need, and then I quote it. Building from scratch usually moves faster than replacing a site.',
  },
  {
    q: 'Do you use AI to build websites?',
    a: 'Yes, for the production: first drafts, research passes and repetitive build work. I make the judgment calls on what to say, how it sounds, and what’s worth doing, and I stay close to every page. It’s how the work stays affordable without becoming generic.',
  },
  {
    q: 'Who do you work with?',
    a: 'Owner-led service businesses in Southern Ontario: recruiting, accounting, law, trades, advisory and similar firms, usually small enough that the owner still makes the marketing calls. I take on a few clients at a time, on purpose.',
  },
];

export const REBUILD_FAQS: Faq[] = [
  {
    q: 'Do I own the site when it’s done?',
    a: 'Yes. The code and the content are yours outright, with no monthly platform fee to keep it online. You’re not renting it, and you’re not locked into me to make changes later.',
  },
  {
    q: 'What do you need from me?',
    a: 'The inside knowledge of your business: your customers, what’s worked, what hasn’t. That’s a few hours across the project, mostly early on. I bring the build and the systems; you bring the part only you know.',
  },
  {
    q: 'What if I don’t have a website at all yet?',
    a: 'That’s fine, and it happens more than you’d think. There’s nothing to score and nothing to diagnose, so we skip those steps and start with the call instead: twenty minutes to work out what your customers actually search for and how many pages you’d need, and then I quote it. Same build, same price band, same 90 days of support.',
  },
  {
    q: 'How much does a small business website cost in Canada?',
    a: 'Mine start at $6,500 for a handful of pages, built custom and owned outright with no monthly platform fee. What moves the number is how many pages you need, how much of the writing falls to me, and whether anything has to connect to a system you already run. You’ll have a fixed price before any work starts, and it doesn’t move unless you ask for something new.',
  },
  {
    q: 'How long does it take?',
    a: 'Most builds run six to eight weeks for a handful of pages, with the timing set by how many pages you need and how quickly we settle the content together. You’ll hear from me weekly with what’s done and what’s next.',
  },
  {
    q: 'What do the 90 days of support cover?',
    a: 'Tuning, mostly. Two rounds of revisions as we settle each page, the small edits you think of once the site is live, and adjustments to anything that isn’t performing the way we expected. If something does break, that’s covered too. A bigger addition down the road is its own small project, so the scope stays clear on both sides.',
  },
  {
    q: 'What happens after the 90 days?',
    a: 'It’s yours to run from there, or you can keep me on with a Site Care Plan: one to two short posts a month in your voice, light updates and fixes, and a quarterly check on whether you’re still being found in Google and AI answers. It’s sized to your site, month to month, with 30 days’ notice.',
  },
  {
    q: 'If AI is doing the production work, is my business information safe?',
    a: 'Fair question. The AI handles drafts and the repetitive production; I make the judgment calls and stay close to the work. Your information stays yours, and nothing about your site or your customers is sold or shared.',
  },
  {
    q: 'What if it turns out not to be the right fit?',
    a: 'We start with a short call before anyone commits to anything, precisely so we can find that out. If it isn’t a fit, for either of us, that’s fine, and there’s no hard sell.',
  },
];

export const AUDIT_FAQS: Faq[] = [
  {
    q: 'How is this different from the Website Diagnostic?',
    a: 'The Website Diagnostic ($400) looks at your site page by page, plus a live check of whether AI assistants name you. It’s the first of the Growth Audit’s five parts. The Audit adds the other four: your content and visibility, how leads actually reach you and where that path leaks, the repetitive work a tool could take off your team, and a 30/60/90-day plan. If you’ve already had the Diagnostic, the $400 comes off the Audit.',
  },
  {
    q: 'What do I actually get?',
    a: 'A written report on the whole path a stranger takes to becoming a client: your site, your visibility, how leads reach you, and where it leaks. It ends with a 30/60/90-day plan, in plain language, so it doesn’t sit in a drawer.',
  },
  {
    q: 'Is this just a sales pitch for a rebuild?',
    a: 'No. The audit stands on its own. You can take the plan and act on it yourself, or with whoever builds your site. If you do decide to rebuild, the audit becomes the plan we build from and the $2,500 comes off the rebuild, so the work isn’t wasted.',
  },
  {
    q: 'Do I need to get on a call?',
    a: 'We’d have a short conversation about your business so the audit is grounded in what you’re actually trying to do, but there’s no long sales process. You get the findings either way.',
  },
];

export const DIAGNOSTIC_FAQS: Faq[] = [
  {
    q: 'What do I actually get?',
    a: 'A read of every page on your site, a live check of whether the assistants name you, and a short, prioritized list of what’s worth fixing first, in plain language. It’s yours to act on, with me or with whoever builds your site.',
  },
  {
    q: 'How is this different from the free scorecard?',
    a: 'The scorecard is a one-page snapshot: four grades and the three things I’d fix first, enough to tell you whether a closer look is worth it. The Diagnostic is the long version: every page, the live AI check, and what I’d do about each thing I find, written up.',
  },
  {
    q: 'What if the fixes turn out to be small?',
    a: 'Then I’ll say so. You won’t be pointed at a rebuild you don’t need. If it’s a handful of fixes, I’ll quote a fixed-scope piece of work to do them. If it’s bigger, that’s where a Growth Audit or a rebuild comes in, and the $400 is credited toward a Growth Audit if you go on.',
  },
  {
    q: 'How long does it take?',
    a: 'I confirm the start date before anything’s owed. From there the write-up takes five business days, and it comes to you by email as a document you can hand to whoever builds your site.',
  },
  {
    q: 'Do I have to buy anything after?',
    a: 'No. The findings are yours either way. Most people want a clear read before they commit to anything bigger, and that’s what this is.',
  },
];

export const SCORECARD_FAQS: Faq[] = [
  {
    q: 'Is the website scorecard really free?',
    a: 'Yes, no cost. You send your website, I send back the scorecard. If it’s useful and you want to talk, we can; if not, it’s yours to keep.',
  },
  {
    q: 'Do I have to book a call to get it?',
    a: 'No. It comes by email. There’s no call to sit through and nothing to book before you see it.',
  },
  {
    q: 'What do I actually get?',
    a: 'A one-page scorecard: letter grades on your site’s design, SEO, AI-Readiness and performance, plus the three things I’d fix first, in order.',
  },
  {
    q: 'How long does it take?',
    a: 'I look at each one myself, so it’s usually a few days.',
  },
  {
    q: 'What if I don’t have a website yet?',
    a: 'Then there’s nothing to score, so the scorecard isn’t your starting point. Send me a note instead and we can talk about what a first site would need to do for you. Building from scratch usually moves faster than replacing a site, because there’s nothing to unpick.',
  },
];

export const LOCAL_FAQS: Faq[] = [
  {
    q: 'Is there a web designer in Burlington who works with small businesses directly?',
    a: 'Yes. I’m Colin Robey, an independent website designer based in Burlington, Ontario. You work with me directly from the first call to launch, with no account manager in between. I build custom sites for owner-led service businesses across Halton, Hamilton and Southern Ontario.',
  },
  {
    q: 'Can we meet in person?',
    a: 'Often, yes. Most of the work runs over short calls and shared links, but for businesses in Burlington, Oakville, Milton and Hamilton a coffee at the start of a project is easy to arrange.',
  },
  {
    q: 'How much does a website cost for a Burlington small business?',
    a: 'My builds start at $6,500 for a handful of pages, custom-designed and owned outright with no monthly platform fee. You get a fixed price before work starts. If you’re not sure a rebuild is the right move, the free scorecard or the $400 Website Diagnostic tells you first.',
  },
  {
    q: 'Do you help with Google Business Profile and local search?',
    a: 'Yes. For a local service business, the Google Business Profile often shows up ahead of the website, so it’s part of the work: accurate details, real services, and the listings that let Google and AI assistants recognise your business as one entity.',
  },
];

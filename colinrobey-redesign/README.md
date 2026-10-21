# colinrobey.ca redesign proposal

A complete, working redesign of colinrobey.ca, built as a separate site for review.
**The live site and its repo (`Dukmar/colin-robey-site`) are untouched.**

## How to look at it

- **On your laptop, no setup:** open the review link from the Claude session. It shows a
  short guide, then the full clickable site.
- **Run it locally:**
  ```bash
  cd colinrobey-redesign
  npm install
  npm run dev        # http://localhost:4321
  ```
- **As a Netlify preview:** create a new Netlify site from this folder. `netlify.toml` keeps it
  out of search (`PREVIEW=true`).

## The idea: "The Markup"

The current site is calm and editorial. It reads as trustworthy, but it doesn't *show* that you
can transform a website. This version is built around one image: **an editor's red pen on a
small-business website.** It's what you do (mark up what's wrong, then fix it), it's
personal (handwritten notes in your voice), and it's visual on every screen.

- **The hero is a live demo.** A tired 2014-style site covered in red-pen notes, with a slider
  that reveals the same business rebuilt. Visitors see the transformation before they read a word.
- **Palette:** warm paper, deep pine green for the dark bands, a red pen and a yellow
  highlighter. The pen is your terracotta pushed toward a truer red; the wordmark period
  survives.
- **Type:** Bricolage Grotesque (bold, characterful headlines), Figtree body (kept from the
  live site), and Caveat for the handwritten notes.
- **Personality comes from the copy:** dry humour where an owner will smile ("My nephew built
  it in 2016. He's an accountant now."), a "Things I won't do" list, and a polaroid that says
  "That's me. I answer my own email."

## What's on the homepage (top to bottom)

1. Hero: the headline, you and your photo, a one-field scorecard form, and the red-pen slider demo
2. "Every build" strip: custom design, built for Google and AI, owned outright, fixed price, 90 days
3. "Sound familiar?": six things owners say about their sites, each with a handwritten reply
4. The STORY Group: a draggable before/after of the real screenshots, animated 62 → 98 speed rings, Ian's quote
5. **A live speed test.** Visitors run Google's own mobile test on *their* site and see it next to 98
6. "A dozen small decisions": an interactive wireframe; hover over a decision and its spot on the page lights up
7. "Three audiences": tabs showing one sample business as a person, Google, an AI assistant and its structured data see it
8. The price ladder: Free → $400 → $2,500 → from $6,500, with the "credited" arrows between steps
9. How a build runs, week by week
10. Meet Colin, with "Things I won't do"
11. "Two questions, one honest answer": a path finder that recommends the right first step (it works without JavaScript)
12. FAQ, Insights, and the contact form

## Pages

Home, Services & pricing (with a side-by-side comparison table), Website design and build,
Growth Audit, Website Diagnostic, Free scorecard (with a sample scorecard and the speed test),
Work, The STORY Group case study, How I work, **Web design in Burlington** (new local page),
Insights index and all six posts, Contact (new), Privacy, a thank-you page and a 404.
Every existing URL is kept, so links and search history carry over.

## SEO + GEO: what's built in

- **One connected entity graph on every page:** `LocalBusiness` (a service-area business with
  `areaServed` towns, an offer catalog in CAD, and `sameAs` to LinkedIn and the Google Business
  Profile), plus `Person` (Colin, `knowsAbout`), `WebSite` and `WebPage`. They share stable `@id`s,
  so any page read on its own resolves to the same business.
- **Per-page schema:**
  - `Service` + `Offer` (CAD prices) on each service page
  - `FAQPage` wherever an FAQ is visible, with the schema matching the visible questions word for word
  - `BlogPosting`, with author, dates, abstract and word count
  - `Article` + `Review` + client `Organization` on the case study
  - `BreadcrumbList` on every inner page
  - `ItemList`, `Blog`, `AboutPage` and `ContactPage` where they fit
- **Answer-first content:** a quotable "short answer" card at the top of every service page,
  post and the local page. FAQ questions are written the way people type them ("How much does a
  small business website cost in Canada?").
- **AI crawlers:**
  - `robots.txt` names and allows OAI-SearchBot, ChatGPT-User, GPTBot, Claude-SearchBot,
    Claude-User, ClaudeBot, PerplexityBot, Google-Extended, Applebot and others.
  - `llms.txt` is generated from the same data file as the pages, so prices can't drift.
- **Local:** a substantial Burlington/Halton page with real proof, rather than thin doorway pages per town.
- **Tags and feeds:** titles under about 60 characters; Open Graph, `geo.region`, the RSS
  feed and the sitemap.
- **Speed:**
  - Static HTML and inlined CSS.
  - Self-hosted fonts, with the two critical ones preloaded.
  - The only images on the homepage are the headshot and the case-study screenshots. The hero
    demo is pure HTML/CSS.

**Lighthouse (mobile, go-live build with `PREVIEW=false`, local server):**

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Home | 94–96 | 100 | 100 | 100 |
| Website design and build | 96 | 100 | 100 | 100 |
| Insights post | 99 | 100 | 100 | 100 |

The preview build scores 69 on SEO only because it deliberately carries `noindex`.

## Research that shaped it

I researched about a dozen web-designer and small-studio sites selling to small businesses:
Oakville/Burlington/Hamilton/Toronto studios, plus best-in-class productized studios
elsewhere. Ideas I borrowed:

- **Prices on the page,** with timelines and what's included (Ministudio, Shift8 and Solo Web
  Design publish "from" prices). You already did this; it's now a visual ladder plus a comparison table.
- **Before/after proof with numbers** that anyone can verify (most strong portfolios do this).
- **An interactive self-test as a lead magnet** (the free-audit offers from Test Valley Digital,
  Redevolution and Oakville Web Designs). The speed checker gives an instant result and then
  hands off to your scorecard.
- **Honest scarcity** (Oakville Web Designs' "3 clients at a time"). Your "a few clients at a
  time" is true, so it stays.
- **Risk reversal** (Redefine Web's and Designjoy's guarantees). I kept it to what you can
  actually promise: a fixed price, you own it outright, and 90 days of tuning. No outcome guarantees.
- **One strong service-area page** (Test Valley Digital's per-town pages), done as one
  substantial page instead of thin copies.

Deliberately **not** borrowed:

- fake countdown scarcity
- "page one guaranteed" style promises
- cheap monthly subscription anchors that undercut your positioning

## Decisions that need your call

These depart from `DESIGN-BRIEF.md` or add something new. Nothing here goes live without you.

1. **Visual identity.** The brief locks the palette, type and wordmark (Boardroom, 2026-07-01).
   This proposal changes the palette (adds pine and the highlighter; the pen replaces
   terracotta) and the headline font (Bricolage Grotesque instead of Newsreader). It needs a
   fresh council run if you like it.
2. **Phone number shown on the page.** The live site shows the form and email only, with the
   business line in schema. Here (289) 812-9084 appears in the contact band and footer, which
   helps local SEO consistency. Keep or remove?
3. **New promises in the copy.** Check that you're happy standing behind each:
   - "usually within a business day or two" for replies
   - "a coffee at the start of a project is easy to arrange" (Burlington page)
   - the week-by-week process labels
4. **Service area list:** Burlington, Oakville, Hamilton, Milton, Mississauga, Halton Hills,
   Grimsby and Toronto. Trim it to where you'd really take a meeting.
5. **Humour lines:** the nephew card, "a visitor counter. bold.", "I answer my own email".
   Keep the ones that sound like you.
6. **The Sheridan credential** is still left off, per your standing decision. The research
   flags it as the strongest trust signal no competitor has. It's still your call.
7. **The speed checker** calls Google's PageSpeed API with no key, which is fine at low volume.
   Add a free API key in `src/components/SpeedChecker.astro` if it gets used a lot.

## Not ported yet (would come across at go-live)

- GA4 with consent, the cookieless counter, `/go/` links, the unsubscribe pages, the
  `submission-created` push function, IndexNow and the CRM hook.
- The Diagnostic page's "three real findings" block.
- **Claims ledger:** the redesign reuses the live site's claims. New copy (the speed-checker
  verdicts, the process timings) should go through the claims ledger and the prose-tells gate
  before launch.

## If you want to move forward

The cleanest path is to bring `src/` into `colin-robey-site` on a branch: same Astro version,
same content collection, same form names (`contact`, `scorecard`). Then port the analytics and
functions, run the review flow, set `PREVIEW=false` and merge.

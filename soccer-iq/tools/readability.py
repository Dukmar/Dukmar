#!/usr/bin/env python3
"""Reading-level check for everything a kid reads in Pitch IQ.

Pulls every caption, question, answer, explanation, prompt, rule and speech line
out of the content files (via node), scores each with the Flesch-Kincaid grade
level, and lists the hardest ones.

  python3 soccer-iq/tools/readability.py            # summary + lines above grade 5
  python3 soccer-iq/tools/readability.py --max 4    # stricter
  python3 soccer-iq/tools/readability.py --file quiz

Flesch-Kincaid is a rough guide: short soccer words like "goal-side" score as easy
even when a kid wouldn't know them, so a person still reads the list.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EXTRACT = r"""
global.window = {}; global.document = { createElement: function () { return {}; } };
var base = process.argv[1];
['js/core.js', 'js/content/shapes.js', 'js/content/lessons.js', 'js/content/lessons2.js', 'js/content/quiz.js',
 'js/content/scenarios.js', 'js/content/rules.js', 'js/content/talk.js'].forEach(function (f) {
  global.PIQ = window.PIQ;
  // world.js needs WebGL; the content files only need the field size
  if (window.PIQ && !window.PIQ.FIELD) window.PIQ.FIELD = { L: 50, W: 34, goalW: 4.88, goalH: 1.83, retreat: 50 / 3 };
  require(base + '/' + f);
});
var P = window.PIQ, out = [];
function add(file, where, text) { if (text) out.push({ file: file, where: where, text: String(text) }); }
P.UNITS.forEach(function (u) { u.lessons.forEach(function (l) {
  add('lessons', l.id + ' title', l.title);
  l.beats.forEach(function (b, i) { add('lessons', l.id + ' step ' + (i + 1), b.say); });
}); });
P.QUIZ.forEach(function (q) {
  add('quiz', q.id + ' question', q.q);
  q.a.forEach(function (a, i) { add('quiz', q.id + ' answer ' + 'ABCD'[i], a); });
  add('quiz', q.id + ' why', q.why);
});
P.SPOTON.forEach(function (s) { add('scenarios', s.id + ' prompt', s.prompt); add('scenarios', s.id + ' explain', s.explain); });
P.MISTAKES.forEach(function (s) { add('scenarios', s.id + ' prompt', s.prompt); add('scenarios', s.id + ' explain', s.explain); });
P.DECISIONS.forEach(function (s) { add('scenarios', s.id + ' prompt', s.prompt); s.options.forEach(function (o) { add('scenarios', s.id + ' ' + o.key + ' why', o.why); }); });
P.RULES.forEach(function (r) { add('rules', r.t, r.d); });
Object.keys(P.TALK.lessons).forEach(function (k) { P.TALK.lessons[k].forEach(function (t) { add('talk', k + ' step ' + (t[0] + 1), t[2]); }); });
process.stdout.write(JSON.stringify(out));
"""


def syllables(word):
    w = word.lower()
    w = re.sub(r"[^a-z]", "", w)
    if not w:
        return 0
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    return max(1, len(re.findall(r"[aeiouy]{1,2}", w)))


def clean(text):
    t = re.sub(r"<[^>]+>", "", text)
    t = t.replace("{name}", "Maya").replace("{team}", "blue").replace("&amp;", "&")
    return t


def grade(text):
    t = clean(text)
    words = re.findall(r"[A-Za-z][A-Za-z'\-]*", t)
    if len(words) < 4:
        return 0.0, len(words)
    sentences = max(1, len(re.findall(r"[.!?]+(\s|$)", t)))
    syl = sum(syllables(w) for w in words)
    g = 0.39 * (len(words) / sentences) + 11.8 * (syl / len(words)) - 15.59
    return round(g, 1), len(words)


def main():
    args = sys.argv[1:]
    limit = float(args[args.index('--max') + 1]) if '--max' in args else 5.0
    only = args[args.index('--file') + 1] if '--file' in args else None
    raw = subprocess.check_output(['node', '-e', EXTRACT, ROOT])
    items = json.loads(raw)
    if only:
        items = [i for i in items if i['file'] == only]
    by_file = {}
    hard = []
    for it in items:
        g, n = grade(it['text'])
        it['grade'] = g
        by_file.setdefault(it['file'], []).append((g, n))
        if g > limit:
            hard.append(it)
    print('Reading level (Flesch-Kincaid grade, word-weighted):')
    for f, gs in sorted(by_file.items()):
        words = sum(n for g, n in gs) or 1
        avg = sum(g * n for g, n in gs) / words
        print('  %-10s %5.1f   (%d lines, %d above grade %g)' % (f, avg, len(gs), sum(1 for g, n in gs if g > limit), limit))
    if hard:
        print('\nAbove grade %g, hardest first:' % limit)
        for it in sorted(hard, key=lambda x: -x['grade'])[:60]:
            print('  [%4.1f] %s | %s' % (it['grade'], it['where'], clean(it['text'])[:150]))
    return 0


if __name__ == '__main__':
    sys.exit(main())

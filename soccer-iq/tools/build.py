#!/usr/bin/env python3
"""Build Pitch IQ into single files.

  dist/pitch-iq.html   everything inlined, three.js included. Works offline:
                       double-click it on a Mac, or open it from any web host.
  dist/artifact.html   the same app for a claude.ai artifact: no html/head/body
                       wrapper (the host adds one) and three.js from jsDelivr.

Run from anywhere:  python3 soccer-iq/tools/build.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js'


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def main():
    index = read('index.html')
    css = read('css/app.css')
    scripts = re.findall(r'<script src="([^"]+)"></script>', index)
    app_js = []
    for src in scripts:
        if src.startswith('vendor/three'):
            continue
        # keep "</script>" sequences inside JS from closing the tag early
        app_js.append('/* ' + src + ' */\n' + read(src).replace('</script', '<\\/script'))
    app_js = '\n'.join(app_js)
    three = read('vendor/three.min.js')

    fonts = re.search(r'<link rel="stylesheet" href="(https://fonts.googleapis.com[^"]+)">', index).group(1)
    body = re.search(r'<body>(.*?)<!--SCRIPTS-->', index, re.S).group(1).strip()

    os.makedirs(DIST, exist_ok=True)

    # 1) offline single file
    offline = index
    offline = re.sub(r'<!--CSS-->.*?<!--/CSS-->', '<style>\n' + css + '\n</style>', offline, flags=re.S)
    offline = re.sub(r'<!--SCRIPTS-->.*?<!--/SCRIPTS-->',
                     lambda m: '<script>\n' + three + '\n</script>\n<script>\n' + app_js + '\n</script>',
                     offline, flags=re.S)
    with open(os.path.join(DIST, 'pitch-iq.html'), 'w', encoding='utf-8') as f:
        f.write(offline)

    # 2) artifact body (the host wraps it in its own doctype/head/body)
    artifact = (
        '<title>Pitch IQ</title>\n'
        '<link rel="stylesheet" href="' + fonts + '">\n'
        '<style>\n' + css + '\n</style>\n' + body + '\n'
        '<script src="' + THREE_CDN + '"></script>\n'
        '<script>\n' + app_js + '\n</script>\n'
    )
    with open(os.path.join(DIST, 'artifact.html'), 'w', encoding='utf-8') as f:
        f.write(artifact)

    for name in ('pitch-iq.html', 'artifact.html'):
        size = os.path.getsize(os.path.join(DIST, name))
        print('%-15s %7.0f KB' % (name, size / 1024))


if __name__ == '__main__':
    main()

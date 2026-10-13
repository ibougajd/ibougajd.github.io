#!/usr/bin/env python3
"""Builds assets/icons.svg — one <symbol> per logo, from Simple Icons (CC0).

usage: python3 tools/build-icons.py
Add a slug to SLUGS (see https://simpleicons.org) and re-run to get a new icon.
"""
import os
import re
import urllib.request

SLUGS = ("kubernetes k3s docker helm argo oracle microsoftazure amazonwebservices googlecloud hetzner coolify cloudflare "
         "terraform prometheus grafana elasticsearch logstash kibana githubactions git github gnubash nginx traefikproxy "
         "letsencrypt linux ubuntu debian c cplusplus go python javascript typescript postgresql mariadb mysql mongodb "
         "redis nestjs react").split()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "icons.svg")

symbols = []
for slug in SLUGS:
    svg = urllib.request.urlopen(f"https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/{slug}.svg", timeout=20).read().decode()
    paths = "".join(f'<path d="{d}"/>' for d in re.findall(r'<path[^>]* d="([^"]+)"', svg))
    symbols.append(f'<symbol id="i-{slug}" viewBox="0 0 24 24">{paths}</symbol>')

# hand-drawn extras for tools that have no logo in Simple Icons
symbols.append('<symbol id="i-lock" viewBox="0 0 24 24"><path d="M6 10V7a6 6 0 0 1 12 0v3h1.5A1.5 1.5 0 0 1 21 11.5v10'
               'A1.5 1.5 0 0 1 19.5 23h-15A1.5 1.5 0 0 1 3 21.5v-10A1.5 1.5 0 0 1 4.5 10zm3 0h6V7a3 3 0 0 0-6 0zm1.5 5.5a1.5'
               ' 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zm.75 1.5v3h1.5v-3z"/></symbol>')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    f.write('<svg xmlns="http://www.w3.org/2000/svg">\n' + "\n".join(symbols) + "\n</svg>\n")
print(f"wrote {OUT} ({len(symbols)} icons)")

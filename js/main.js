// ilyass@1337 — portfolio behaviour: boot, nav, terminal, command palette, filters, contact.
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EMAIL = 'ilyassbougajdi7777@gmail.com';
  const CV = 'assets/ilyass-bougajdi-cv.pdf';
  const LINKS = { github: 'https://github.com/ibougajd', linkedin: 'https://www.linkedin.com/in/ilyass-bougajdi' };
  const started = Date.now();

  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } }
  };

  // ------------------------------------------------------------ toast
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL);
    } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: EMAIL });
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
    toast(`✓ copied ${EMAIL}`);
  }

  // in drive mode the car takes you there; resolves once you've arrived
  function goTo(id) {
    if (window.drive) return window.drive.go(id) || Promise.resolve();
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    return Promise.resolve();
  }

  // ------------------------------------------------------------ boot sequence
  function runBoot() {
    const boot = $('#boot');
    if (!document.documentElement.classList.contains('booting')) return;
    boot.classList.add('is-on');
    store.set('booted', '1');
    const log = $('#boot-log'), bar = $('#boot-bar');
    const lines = [
      ['ok', 'Mounting /dev/portfolio'],
      ['ok', 'Starting kubelet.service'],
      ['ok', 'Reached target network-online'],
      ['ok', 'Pulling ghcr.io/ibougajd/portfolio:latest'],
      ['ok', 'argocd: application "portfolio" synced · healthy'],
      ['hl', 'Welcome, visitor.']
    ];
    let i = 0, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      boot.classList.add('is-done');
      document.documentElement.classList.remove('booting');
      setTimeout(() => boot.remove(), 500);
      removeEventListener('keydown', finish); removeEventListener('pointerdown', finish);
    };
    addEventListener('keydown', finish); addEventListener('pointerdown', finish);
    const step = () => {
      if (done) return;
      if (i < lines.length) {
        const [cls, text] = lines[i++];
        log.innerHTML += cls === 'ok' ? `[ <span class="ok"> OK </span> ] ${text}\n` : `\n<span class="hl">${text}</span>\n`;
        bar.style.width = `${(i / lines.length) * 100}%`;
        setTimeout(step, 150);
      } else setTimeout(finish, 380);
    };
    log.textContent = 'ilyass@1337 — Portfolio OS (HUD edition)\n\n';
    setTimeout(step, 150);
  }

  // ------------------------------------------------------------ mobile menu (active link + progress live in drive.js)
  const menuBtn = $('#menu-btn'), nav = $('#nav');
  menuBtn.addEventListener('click', () => {
    const open = menuBtn.getAttribute('aria-expanded') !== 'true';
    menuBtn.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  nav.addEventListener('click', e => {
    if (e.target.closest('a')) { menuBtn.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); }
  });

  // ------------------------------------------------------------ clock, uptime, year
  const clockEl = $('#clock'), uptimeEl = $('#uptime');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const uptime = () => {
    const sec = Math.floor((Date.now() - started) / 1000);
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  };
  function tick() {
    clockEl.textContent = fmt.format(new Date());
    uptimeEl.textContent = uptime();
  }
  tick(); setInterval(tick, 1000);
  $('#year').textContent = new Date().getFullYear();

  // hero glitch every few seconds; pause the diagram for reduced motion
  const title = $('.hero-title');
  if (!reduceMotion && title) {
    setInterval(() => { title.classList.add('glitching'); setTimeout(() => title.classList.remove('glitching'), 520); }, 6500);
  }
  if (reduceMotion) $('#pipeline')?.pauseAnimations?.();

  // ------------------------------------------------------------ project filters
  const filters = $$('.filter'), projects = $$('.project');
  filters.forEach(btn => btn.addEventListener('click', () => {
    const f = btn.dataset.filter;
    filters.forEach(b => { const on = b === btn; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    projects.forEach(p => p.classList.toggle('is-hidden', f !== 'all' && p.dataset.cat !== f));
  }));

  // ------------------------------------------------------------ stack
  const STACK = [
    ['Orchestration & cloud', [['kubernetes', 'Kubernetes'], ['k3s', 'K3s / K3d'], ['docker', 'Docker'], ['helm', 'Helm'], ['argo', 'ArgoCD'],
      ['oracle', 'Oracle Cloud'], ['microsoftazure', 'Azure'], ['amazonwebservices', 'AWS'], ['googlecloud', 'Google Cloud'],
      ['hetzner', 'Hetzner'], ['coolify', 'Coolify'], ['cloudflare', 'Cloudflare']]],
    ['IaC & CI/CD', [['terraform', 'Terraform'], ['githubactions', 'GitHub Actions'], ['github', 'GHCR'], ['git', 'Git'], ['gnubash', 'Bash']]],
    ['Observability', [['prometheus', 'Prometheus'], ['prometheus', 'Alertmanager'], ['grafana', 'Grafana'], ['elasticsearch', 'Elasticsearch'],
      ['logstash', 'Logstash'], ['kibana', 'Kibana']]],
    ['Networking & security', [['nginx', 'Nginx'], ['traefikproxy', 'Traefik'], ['letsencrypt', 'SSL / TLS'], ['lock', 'SOPS'],
      ['linux', 'Linux'], ['ubuntu', 'Ubuntu'], ['debian', 'Debian']]],
    ['Languages & data', [['c', 'C'], ['cplusplus', 'C++'], ['go', 'Go'], ['python', 'Python'], ['javascript', 'JavaScript'],
      ['postgresql', 'PostgreSQL'], ['mariadb', 'MariaDB'], ['mysql', 'MySQL'], ['mongodb', 'MongoDB'], ['redis', 'Redis']]]
  ];
  const stackRoot = $('#stack-groups');
  stackRoot.innerHTML = STACK.map(([group, items]) => `
    <div class="stack-group reveal">
      <h3>${group}<span class="count" data-count="${items.length}">[${String(items.length).padStart(2, '0')}]</span></h3>
      <ul class="tiles">${items.map(([slug, name], i) => `
        <li class="tile" title="${name}" style="--i:${i}"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="assets/icons.svg#i-${slug}"/></svg><span>${name}</span></li>`).join('')}
      </ul>
    </div>`).join('');

  // ------------------------------------------------------------ terminal
  const out = $('#term-out'), input = $('#term-input'), form = $('#term-form'), termBody = $('#term-body');
  const history = [];
  let hIdx = 0;
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const c = (cls, s) => `<span class="c-${cls}">${s}</span>`;
  const link = (href, text, dl = false) => `<a href="${href}" ${dl ? 'download' : 'target="_blank" rel="noopener"'}>${text}</a>`;
  function print(html = '') {
    const div = document.createElement('div');
    div.className = 'line';
    div.innerHTML = html;
    out.append(div);
  }
  const printLines = arr => arr.forEach(print);
  const scrollTerm = () => { termBody.scrollTop = termBody.scrollHeight; };
  const prompt = () => `${c('hl', 'visitor@1337')}${c('dim', ' ~ $')}`;

  const PROJECTS = {
    ft_transcendence: ['Cloud-native GitOps platform on OCI (K3d, ArgoCD, Helm, SOPS, ELK)', 'https://github.com/ibougajd/ft_transcendence'],
    inception: ['Containerized Nginx + WordPress + MariaDB infrastructure', 'https://github.com/ibougajd/inception'],
    ft_irc: ['IRC server from scratch in C++ (sockets, poll)', 'https://github.com/ibougajd/ft_irc'],
    minishell: ['Bash-like shell in C', 'https://github.com/ibougajd/minishell'],
    philosophers: ['Dining philosophers with pthreads & mutexes', 'https://github.com/ibougajd/Philosophers'],
    cub3d: ['Raycasting engine in C (Wolfenstein 3D style)', 'https://github.com/ibougajd/cub3d'],
    so_long: ['2D tile game in C with MiniLibX', 'https://github.com/ibougajd/so_long'],
    'cpp-modules': ['C++98 modules: OOP, templates, STL', 'https://github.com/ibougajd/Cpp-Modules']
  };
  const SECTIONS = ['about', 'work', 'stack', 'journey', 'shell', 'contact'];

  const COMMANDS = {
    help: ['list commands', () => {
      print(c('hl', 'available commands'));
      for (const [name, [desc]] of Object.entries(COMMANDS)) {
        if (desc) print(`  ${c('cy', name.padEnd(13))} ${c('dim', desc)}`);
      }
      print(c('dim', '  tip: ↑/↓ history · tab completes · ctrl+l clears'));
    }],
    whoami: ['who is this?', () => print(`${c('hl', 'Ilyass Bougajdi')} — DevOps Engineer · 1337 (UM6P) · Marrakesh, Morocco`)],
    about: ['short bio', () => printLines([
      "I'm a DevOps engineer trained at 1337 Coding School (UM6P), part of the 42 Network.",
      'Started deep in C (memory, processes, sockets), now building Kubernetes clusters,',
      'GitOps pipelines and observability stacks.',
      c('dim', '"I want to understand exactly how code lives, scales, and stays healthy in production."')
    ])],
    projects: ['list projects (alias: ls)', () => {
      print(c('dim', 'drwxr-xr-x  ilyass  1337  ~/projects'));
      for (const [name, [desc]] of Object.entries(PROJECTS)) print(`  ${c('cy', name.padEnd(18))} ${desc}`);
      print(c('dim', "  → open <name> to view the source"));
    }],
    ls: [null, a => COMMANDS.projects[1](a)],
    open: ['open <project> on GitHub', ([name]) => {
      const key = (name || '').toLowerCase();
      if (!PROJECTS[key]) { print(c('err', `open: ${esc(name || '')}: no such project`) + c('dim', ' (try: ls)')); return; }
      print(`opening ${link(PROJECTS[key][1], PROJECTS[key][1])} …`);
      window.open(PROJECTS[key][1], '_blank', 'noopener');
    }],
    stack: ['tech stack', () => {
      for (const [group, items] of STACK) print(`${c('hl', group.padEnd(24))} ${[...new Set(items.map(i => i[1]))].join(' · ')}`);
    }],
    journey: ['git log of my career', () => printLines([
      `${c('warn', 'e1337f0')} ${c('cy', '(HEAD → main)')} DevOps & SRE focus`,
      `${c('warn', '9c4a2de')} ft_transcendence — GitOps platform on OCI ${c('dim', '2024–2026')}`,
      `${c('warn', '5b81f3a')} ${c('err', '(tag: common-core)')} Common Core completed`,
      `${c('warn', '3e07b19')} ft_irc — IRC server from scratch ${c('dim', '2024')}`,
      `${c('warn', 'a4d2c77')} Inception — first containerized infra ${c('dim', '2023')}`,
      `${c('warn', '1f3c0a2')} joined 1337 Coding School (UM6P) ${c('dim', '2023')}`,
      `${c('warn', '0000000')} init: hello, world`
    ])],
    contact: ['ways to reach me', () => printLines([
      `email     ${link('mailto:' + EMAIL, EMAIL)}`,
      `github    ${link(LINKS.github, 'github.com/ibougajd')}`,
      `linkedin  ${link(LINKS.linkedin, 'in/ilyass-bougajdi')}`,
      `cv        ${link(CV, 'ilyass-bougajdi-cv.pdf', true)}`
    ])],
    email: ['copy my email address', () => { copyEmail(); print(c('ok', `✓ copied ${EMAIL} to your clipboard`)); }],
    cv: ['download my CV', () => {
      print(`downloading ${link(CV, 'ilyass-bougajdi-cv.pdf', true)} …`);
      const a = Object.assign(document.createElement('a'), { href: CV, download: 'ilyass-bougajdi-cv.pdf' });
      document.body.append(a); a.click(); a.remove();
    }],
    social: ['github + linkedin', () => printLines([`github    ${link(LINKS.github, 'github.com/ibougajd')}`, `linkedin  ${link(LINKS.linkedin, 'in/ilyass-bougajdi')}`])],
    neofetch: ['system info', () => {
      const art = [
        ' ██╗██████╗ ', ' ██║██╔══██╗', ' ██║██████╔╝', ' ██║██╔══██╗', ' ██║██████╔╝', ' ╚═╝╚═════╝ ', '', ''
      ];
      const info = [
        `${c('hl', 'visitor')}@${c('hl', 'ilyass')}`,
        c('dim', '──────────────'),
        `${c('cy', 'OS')}       Portfolio OS (HUD edition)`,
        `${c('cy', 'Host')}     1337 (UM6P) · 42 Network`,
        `${c('cy', 'Uptime')}   ${uptime()} (this session)`,
        `${c('cy', 'Shell')}    zsh`,
        `${c('cy', 'Stack')}    K8s · ArgoCD · Helm · Terraform`,
        `${c('cy', 'Monitor')}  ELK · Prometheus · Grafana`
      ];
      art.forEach((a, i) => print(`${c('cy', a.padEnd(12))}   ${info[i] || ''}`));
      print(`${' '.repeat(15)}<span style="color:#05d9e8">███</span><span style="color:#ff2a6d">███</span><span style="color:#d300c5">███</span><span style="color:#8fe3a8">███</span><span style="color:#e3c88f">███</span><span style="color:#aacfd1">███</span>`);
    }],
    kubectl: ['try: kubectl get pods', args => {
      const q = args.join(' ');
      if (q === 'get pods' || q === 'get po') {
        print(c('dim', 'NAME                          READY   STATUS             RESTARTS   AGE'));
        printLines([
          `portfolio-web-7c9f4b-x2lq     1/1     ${c('ok', 'Running')}            0          ${uptime()}`,
          `hero-scene-5d8c7f-k81z        1/1     ${c('ok', 'Running')}            0          ${uptime()}`,
          `terminal-6b4d9e-q0pd          1/1     ${c('ok', 'Running')}            0          ${uptime()}`,
          `contact-form-84f2a1-mm3t      1/1     ${c('ok', 'Running')}            0          ${uptime()}`,
          `coffee-maker-0                0/1     ${c('err', 'CrashLoopBackOff')}   1337       ${uptime()}`
        ]);
      } else if (q === 'get nodes' || q === 'get no') {
        print(c('dim', 'NAME        STATUS   ROLES           AGE     VERSION'));
        printLines([`master-01   ${c('ok', 'Ready')}    control-plane   1337d   v1.31.0`, `worker-01   ${c('ok', 'Ready')}    &lt;none&gt;          1337d   v1.31.0`, `worker-02   ${c('ok', 'Ready')}    &lt;none&gt;          42d     v1.31.0`]);
      } else if (q.startsWith('logs')) {
        print(c('dim', '[portfolio-web] GET / 200 · 12ms'));
        print(c('dim', '[portfolio-web] visitor connected · you are awesome'));
      } else if (q.startsWith('delete')) {
        print(c('err', 'Error from server (Forbidden): visitors can look, not touch. 🙂'));
      } else print(c('dim', 'visitors can run: kubectl get pods · kubectl get nodes · kubectl logs'));
    }],
    git: [null, args => (args[0] === 'log' ? COMMANDS.journey[1]() : print(c('dim', 'try: git log')))],
    boost: ['floor it 🚗', () => {
      print(c('ok', reduceMotion ? 'nitro is off: your system asks for reduced motion.' : 'nitro engaged. look down. 🚗💨'));
      window.scene?.boost(3);
    }],
    goto: ['drive to a district', ([s]) => {
      const id = s === 'projects' ? 'work' : s === 'home' ? 'top' : s;
      if (!SECTIONS.includes(id) && id !== 'top') { print(c('dim', `districts: home · ${SECTIONS.join(' · ')}`)); return; }
      print(c('dim', `driving to ${id === 'top' ? 'home' : id} …`));
      goTo(id);
    }],
    cd: [null, ([s]) => (s && s !== '~' ? COMMANDS.goto[1]([s.replace(/^\.?\/?/, '')]) : print(''))],
    cat: [null, ([f]) => (f === 'about.md' ? COMMANDS.about[1]() : print(c('err', `cat: ${esc(f || '')}: No such file or directory`)))],
    pwd: [null, () => print('/home/visitor')],
    date: [null, () => print(new Date().toString())],
    echo: [null, args => print(esc(args.join(' ')))],
    history: ['command history', () => history.forEach((h, i) => print(`${c('dim', String(i + 1).padStart(4))}  ${esc(h)}`))],
    sudo: [null, args => {
      if (args.join(' ') === 'hire-me') {
        printLines([
          c('dim', '[sudo] password for visitor: ********'),
          c('ok', '✓ access granted. excellent decision.'),
          `opening the contact panel … or just email ${link('mailto:' + EMAIL, EMAIL)}`
        ]);
        setTimeout(() => goTo('contact'), 900);
      } else print(c('err', 'visitor is not in the sudoers file. This incident will be reported. 🚨'));
    }],
    rm: [null, () => print(c('err', 'nice try. permission denied — and this cluster has backups. 🙂'))],
    vim: [null, () => print(c('dim', "you're stuck now. just kidding — type :q (or anything else)"))],
    ping: [null, () => printLines([`PING ilyass.dev: 56 data bytes`, `64 bytes: icmp_seq=0 ttl=64 time=13.37 ms`, c('ok', '--- 1 packets transmitted, 1 received, 0% packet loss ---')])],
    clear: ['clear the screen', () => { out.innerHTML = ''; }],
    exit: ['leave the shell', () => print(c('dim', 'logout. (you can\'t really leave — but you can drive on and say hi)'))]
  };
  const NAMES = Object.keys(COMMANDS);

  function run(raw) {
    const line = raw.trim();
    print(`${prompt()} ${esc(line)}`);
    if (!line) return scrollTerm();
    history.push(line); hIdx = history.length;
    const [cmd, ...args] = line.split(/\s+/);
    const entry = COMMANDS[cmd.toLowerCase()];
    if (entry) entry[1](args);
    else print(`${c('err', 'zsh: command not found:')} ${esc(cmd)} ${c('dim', '— type help')}`);
    scrollTerm();
  }

  printLines([
    `Welcome to ${c('hl', 'ilyass@1337')} ${c('dim', '(Portfolio OS, HUD edition)')}`,
    ` * docs:    type ${c('cy', 'help')}`,
    ` * status:  ${c('ok', '● all systems healthy')}`,
    c('dim', `Last login: ${new Date().toDateString()} from your-browser`),
    ''
  ]);

  form.addEventListener('submit', e => { e.preventDefault(); run(input.value); input.value = ''; });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { e.preventDefault(); if (hIdx > 0) input.value = history[--hIdx]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ''; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const parts = input.value.split(/\s+/);
      if (parts.length === 1) {
        const m = NAMES.filter(n => n.startsWith(parts[0]));
        if (m.length === 1) input.value = m[0] + ' ';
        else if (m.length > 1) { print(`${prompt()} ${esc(input.value)}`); print(c('dim', m.join('  '))); scrollTerm(); }
      } else if (parts[0] === 'open') {
        const m = Object.keys(PROJECTS).filter(n => n.startsWith(parts[1] || ''));
        if (m.length === 1) input.value = `open ${m[0]}`;
      }
    } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
  });
  termBody.addEventListener('click', () => { if (!getSelection().toString()) input.focus({ preventScroll: true }); });
  $$('.chip-cmd').forEach(b => b.addEventListener('click', () => { run(b.dataset.cmd); input.focus({ preventScroll: true }); }));
  const focusShell = () => goTo('shell').then(() => input.focus({ preventScroll: true }));
  $$('[data-focus-shell]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); focusShell(); }));

  // ------------------------------------------------------------ command palette
  const palette = $('#palette'), pInput = $('#palette-input'), pList = $('#palette-list');
  const ACTIONS = [
    ['→', 'Go to about', 'about', () => goTo('about')],
    ['→', 'Go to projects', 'work', () => goTo('work')],
    ['→', 'Go to tech stack', 'stack', () => goTo('stack')],
    ['→', 'Go to journey', 'git log', () => goTo('journey')],
    ['→', 'Go to contact', 'contact', () => goTo('contact')],
    ['$', 'Open the terminal', '`', focusShell],
    ['@', 'Copy email address', 'email', copyEmail],
    ['↓', 'Download CV', 'pdf', () => COMMANDS.cv[1]()],
    ['↗', 'Open GitHub', 'github', () => window.open(LINKS.github, '_blank', 'noopener')],
    ['↗', 'Open LinkedIn', 'linkedin', () => window.open(LINKS.linkedin, '_blank', 'noopener')],
    ['↗', 'View ft_transcendence source', 'project', () => window.open(PROJECTS.ft_transcendence[1], '_blank', 'noopener')],
    ['»', 'Boost the car', 'nitro', () => COMMANDS.boost[1]()],
    ['↑', 'Back to the start', 'home', () => goTo('top')]
  ];
  let matches = ACTIONS, sel = 0, lastFocus = null;
  const fuzzy = (q, s) => { let i = 0; for (const ch of s.toLowerCase()) if (ch === q[i]) i++; return i === q.length; };
  function renderPalette() {
    const q = pInput.value.trim().toLowerCase();
    matches = ACTIONS.filter(a => fuzzy(q, `${a[1]} ${a[2]}`));
    sel = Math.min(sel, Math.max(0, matches.length - 1));
    pList.innerHTML = matches.length
      ? matches.map((a, i) => `<li role="option" id="pal-${i}" aria-selected="${i === sel}" data-i="${i}"><span class="pi">${a[0]}</span>${a[1]}<span class="pk">${a[2]}</span></li>`).join('')
      : '<li class="palette-empty">no matching command</li>';
    pInput.setAttribute('aria-activedescendant', matches.length ? `pal-${sel}` : '');
    $(`#pal-${sel}`)?.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    lastFocus = document.activeElement;
    palette.hidden = false; pInput.value = ''; sel = 0; renderPalette(); pInput.focus();
  }
  function closePalette() { palette.hidden = true; lastFocus?.focus?.({ preventScroll: true }); }
  function choose(i) { const a = matches[i]; if (!a) return; closePalette(); a[3](); }
  $('#open-palette').addEventListener('click', openPalette);
  palette.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closePalette();
    const li = e.target.closest('li[data-i]'); if (li) choose(+li.dataset.i);
  });
  pInput.addEventListener('input', () => { sel = 0; renderPalette(); });
  pInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, matches.length); renderPalette(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + matches.length) % Math.max(1, matches.length); renderPalette(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
    else if (e.key === 'Tab') e.preventDefault();
  });

  addEventListener('keydown', e => {
    const typing = e.target instanceof Element && e.target.closest('input, textarea');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette.hidden ? openPalette() : closePalette(); }
    else if (e.key === 'Escape' && !palette.hidden) closePalette();
    else if (e.key === '`' && !typing) { e.preventDefault(); focusShell(); }
  });

  // ------------------------------------------------------------ contact
  $('#copy-email').addEventListener('click', copyEmail);
  const mailer = $('#mailer'), mStatus = $('#mailer-status');
  mailer.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = mailer.querySelector('button[type="submit"]');
    btn.disabled = true;
    mStatus.className = 'mailer-status'; mStatus.textContent = 'sending …';
    try {
      const res = await fetch(mailer.action, { method: 'POST', body: new FormData(mailer), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      mailer.reset();
      mStatus.classList.add('ok'); mStatus.textContent = '✓ message delivered — I\'ll get back to you soon.';
    } catch {
      mStatus.classList.add('err');
      mStatus.innerHTML = `✗ couldn't send. email me directly: <a href="mailto:${EMAIL}">${EMAIL}</a>`;
    } finally { btn.disabled = false; }
  });

  runBoot();
})();

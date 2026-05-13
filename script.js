document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile & Burger Menu
    const burger = document.querySelector('.burger');
    const nav = document.querySelector('.nav-links');
    const navLinks = document.querySelectorAll('.nav-links li');

    const navSlide = () => {
        if (burger) {
            burger.addEventListener('click', () => {
                nav.classList.toggle('nav-active');

                if (nav.classList.contains('nav-active')) {
                    burger.innerText = 'Close';
                    document.body.style.overflow = 'hidden';
                    navLinks.forEach((link, index) => {
                        link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
                    });
                } else {
                    burger.innerText = 'Menu';
                    document.body.style.overflow = 'auto';
                    navLinks.forEach((link) => {
                        link.style.animation = '';
                    });
                }
            });
        }
    };
    navSlide();

    // 2. Scroll Reveal Animation
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'all 0.6s ease-out';
    });

    const revealSection = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    };

    const sectionObserver = new IntersectionObserver(revealSection, {
        root: null,
        threshold: 0.15,
    });

    sections.forEach(section => {
        sectionObserver.observe(section);
    });

    // 3. Custom Cursor & Magnetic Effect
    const cursorDot = document.querySelector('[data-cursor-dot]');
    const cursorOutline = document.querySelector('[data-cursor-outline]');

    if (window.matchMedia("(pointer: fine)").matches && cursorDot && cursorOutline) {
        let cursorX = 0;
        let cursorY = 0;
        let outlineX = 0;
        let outlineY = 0;

        document.addEventListener('mousemove', (e) => {
            cursorX = e.clientX;
            cursorY = e.clientY;
            cursorDot.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
        });

        const animateCursor = () => {
            outlineX += (cursorX - outlineX) * 0.15;
            outlineY += (cursorY - outlineY) * 0.15;
            cursorOutline.style.transform = `translate(${outlineX}px, ${outlineY}px) translate(-50%, -50%)`;
            requestAnimationFrame(animateCursor);
        };
        animateCursor();

        const hoverables = document.querySelectorAll('a, button, .project-card, .social-icons a');
        hoverables.forEach(el => {
            el.addEventListener('mouseenter', () => {
                document.body.classList.add('hovering');
            });
            el.addEventListener('mouseleave', () => {
                document.body.classList.remove('hovering');
                if (!el.closest('.social-icons')) {
                    el.style.transform = '';
                }
            });

            if (el.classList.contains('cta-button')) {
                el.addEventListener('mousemove', (e) => {
                    const rect = el.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const moveX = e.clientX - centerX;
                    const moveY = e.clientY - centerY;
                    el.style.transform = `translate(${moveX * 0.15}px, ${moveY * 0.15}px)`;
                });
            }
        });
    }

    // 4. 3D Tilt Effect for Cards
    const tiltCards = document.querySelectorAll('.project-card, .stat-card');
    tiltCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -5;
            const rotateY = ((x - centerX) / centerX) * 5;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        });
    });

    // 5. Interactive Particle Network Background
    const canvas = document.getElementById('bg-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width, height;
        let particles = [];
        let mouse = { x: null, y: null, radius: 150 };

        window.addEventListener('mousemove', (event) => {
            mouse.x = event.x;
            mouse.y = event.y;
        });

        // Debounce resize
        let resizeTimeout;
        const resize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                width = canvas.width = window.innerWidth;
                height = canvas.height = window.innerHeight;
                initParticles();
            }, 200);
        };

        class Particle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 0.4;
                this.vy = (Math.random() - 0.5) * 0.4;
                this.size = Math.random() * 3 + 1; // Slightly larger for squares
                this.density = (Math.random() * 20) + 1;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;

                if (mouse.x != null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distanceSq = dx * dx + dy * dy;
                    let radiusSq = mouse.radius * mouse.radius;

                    if (distanceSq < radiusSq) {
                        const distance = Math.sqrt(distanceSq);
                        const forceDirectionX = dx / distance;
                        const forceDirectionY = dy / distance;
                        const force = (mouse.radius - distance) / mouse.radius;
                        this.x -= forceDirectionX * force * this.density * 0.5;
                        this.y -= forceDirectionY * force * this.density * 0.5;
                    }
                }
            }

            draw(color) {
                ctx.fillStyle = color;
                // Draw Square 'nodes' for DevOps look
                ctx.fillRect(this.x, this.y, this.size, this.size);
            }
        }

        const initParticles = () => {
            particles = [];
            let particleCount = Math.floor(width * height / 15000);
            if (particleCount > 150) particleCount = 150;

            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };

        const animateParticles = () => {
            ctx.clearRect(0, 0, width, height);
            const isLight = document.body.classList.contains('light-mode');
            
            // Generate a dynamic hue based on time for the "RGB Hack" effect
            const timeHue = (Date.now() / 30) % 360;

            // Base Colors (Dynamic HSL instead of static RGBA green)
            const baseColor = isLight ? 'rgba(0, 86, 179, 0.4)' : `hsla(${150 + timeHue}, 100%, 50%, 0.4)`;
            const baseLineColor = isLight ? 'rgba(0, 86, 179, 0.1)' : `hsla(${150 + timeHue}, 100%, 50%, 0.1)`;

            // Interaction Colors (Strong Light)
            const activeColor = isLight ? 'rgba(0, 86, 179, 1)' : 'rgba(255, 255, 255, 1)';
            const activeLineColor = isLight ? 'rgba(0, 86, 179, 1)' : 'rgba(255, 255, 255, 0.8)';

            particles.forEach((p, index) => {
                p.update();

                // Calculate distance to mouse for highlight
                let isNearMouse = false;
                if (mouse.x != null) {
                    const dx = mouse.x - p.x;
                    const dy = mouse.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < mouse.radius) {
                        isNearMouse = true;
                    }
                }

                // Draw Particle with dynamic color
                p.draw(isNearMouse ? activeColor : baseColor);

                for (let j = index + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const distanceSq = dx * dx + dy * dy;

                    if (distanceSq < 14400) { // 120^2
                        const distance = Math.sqrt(distanceSq);

                        // Determine line brightness
                        // If either particle is near mouse, make line super bright
                        let isLineActive = false;
                        if (mouse.x != null) {
                            const dx2 = mouse.x - p2.x;
                            const dy2 = mouse.y - p2.y;
                            const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                            if (isNearMouse || dist2 < mouse.radius) {
                                isLineActive = true;
                            }
                        }

                        // Fade out lines based on distance
                        ctx.globalAlpha = 1 - (distance / 120);
                        ctx.beginPath();
                        ctx.strokeStyle = isLineActive ? activeLineColor : baseLineColor;
                        ctx.lineWidth = isLineActive ? 2 : 1; // Thicker lines near mouse
                        ctx.moveTo(p.x + p.size / 2, p.y + p.size / 2); // Center of square
                        ctx.lineTo(p2.x + p2.size / 2, p2.y + p2.size / 2);
                        ctx.stroke();
                        ctx.globalAlpha = 1.0;
                    }
                }
            });
            requestAnimationFrame(animateParticles);
        };

        window.addEventListener('resize', resize);
        // Initial init calls for set width/height
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        initParticles();

        animateParticles();

        document.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });
    }

    // 6. Theme Toggle Logic
    const themeToggle = document.getElementById('theme-toggle');
    const toggleTheme = () => {
        document.body.classList.toggle('light-mode');
        const theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', theme);
    };

    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // 7. Terminal — Auto-play + Click-to-Interact
    const terminalText = document.getElementById('typewriter-text');
    const terminalBody = document.getElementById('terminal-body');
    const inputLine = document.querySelector('.terminal-input-line');
    const terminalInput = document.getElementById('terminal-input');
    const terminalLoader = document.getElementById('terminal-loader');
    const terminalCloseBtn = document.getElementById('terminal-close-btn');
    
    if (terminalText && terminalBody && inputLine && terminalInput) {
        let isInteractive = false;
        let autoPlayRunning = false;
        let autoPlayTimeout = null;
        let cmdHistory = [];
        let historyIdx = -1;

        // --- Command Definitions ---
        const COMMANDS = {
            help: () => `\n<span class="t-head">Available Commands</span>
  <span class="t-cmd">whoami</span>       - Display user info
  <span class="t-cmd">skills</span>       - List core technologies
  <span class="t-cmd">projects</span>     - Show featured projects
  <span class="t-cmd">contact</span>      - Contact information
  <span class="t-cmd">experience</span>   - Work experience
  <span class="t-cmd">education</span>    - Education background
  <span class="t-cmd">docker ps</span>    - Show running containers
  <span class="t-cmd">kubectl</span>      - Kubernetes pod status
  <span class="t-cmd">uptime</span>       - System uptime stats
  <span class="t-cmd">ls</span>           - List directory
  <span class="t-cmd">cat README.md</span>- Read the readme
  <span class="t-cmd">clear</span>        - Clear terminal
  <span class="t-cmd">exit</span>         - Back to auto-play mode\n`,

            whoami: () => `
<span class="t-head">ilyass@devops</span>
─────────────────────────────
Name       : Ilyass Bougajdi
Role       : DevOps Engineer
School     : 1337 / 42 Network
Status     : <span class="t-ok">● Open to Opportunities</span>
Focus      : Cloud · Containers · Automation
Motto      : "Infrastructure as Art"\n`,

            skills: () => `
<span class="t-head">Tech Stack</span>
─────────────────────────────
<span class="t-label">Languages</span>   C · C++ · Python · Go · SQL
<span class="t-label">DevOps</span>      Docker · Kubernetes (K3s/K3d) · Helm · ArgoCD
<span class="t-label">Cloud</span>       Oracle Cloud (OCI) · GitHub Actions
<span class="t-label">Observe</span>     ELK Stack · Prometheus · Grafana
<span class="t-label">Network</span>     Traefik · Nginx · TCP/IP · SOPS\n`,

            projects: () => `
<span class="t-head">Featured Projects</span>
─────────────────────────────
<span class="t-ok">[1]</span> <span class="t-cmd">app/ft_transcendence</span>
     Oracle Cloud (OCI) · Kubernetes · ArgoCD · ELK Stack
     <span class="t-dim">→ github.com/ibougajd/transcendence</span>

<span class="t-ok">[2]</span> <span class="t-cmd">bin/ft_irc</span>
     C++ · TCP/IP · Non-blocking I/O (poll)
     <span class="t-dim">→ github.com/ibougajd/ft_irc</span>

<span class="t-ok">[3]</span> <span class="t-cmd">container/inception</span>
     Docker Compose · Nginx · MariaDB · WordPress
     <span class="t-dim">→ github.com/ibougajd/inception</span>\n`,

            contact: () => `
<span class="t-head">Contact</span>
─────────────────────────────
Email    : ilyass@student.1337.ma
GitHub   : github.com/ibougajd
LinkedIn : linkedin.com/in/ilyassbougajdi
Location : Morocco\n`,

            experience: () => `
<span class="t-head">Experience</span>
─────────────────────────────
<span class="t-cmd">DevOps Engineer</span> — 1337 / 42 Network
  · Built Docker-based multi-service infrastructure
  · Automated CI/CD pipelines from scratch
  · Managed Kubernetes clusters for production workloads
  · Implemented IaC with Terraform & Ansible\n`,

            education: () => `
<span class="t-head">Education</span>
─────────────────────────────
<span class="t-cmd">1337 School (42 Network)</span>
  Peer-to-peer engineering school, Morocco
  Specialization: Systems & DevOps
  Notable: No traditional teachers — project-based learning\n`,

            'docker ps': () => `
CONTAINER ID   IMAGE      STATUS          NAMES
a1b2c3d4       nginx      <span class="t-ok">Up 6 hours</span>      nginx-lb
e5f6g7h8       postgres   <span class="t-ok">Up 6 hours</span>      postgres-db
i9j0k1l2       node:18    <span class="t-ok">Up 2 minutes</span>    portfolio-api
m3n4o5p6       redis      <span class="t-ok">Up 6 hours</span>      cache-layer\n`,

            kubectl: () => `
NAME              READY   STATUS    RESTARTS
frontend-7b8xf    1/1     <span class="t-ok">Running</span>   0
api-gateway-x9p   1/1     <span class="t-ok">Running</span>   0
postgres-0        1/1     <span class="t-ok">Running</span>   0
redis-master-0    1/1     <span class="t-ok">Running</span>   0\n`,

            uptime: () => {
                const now = new Date();
                return `
<span class="t-head">System Status</span>
─────────────────────────────
Uptime     : <span class="t-ok">99.9%</span>
Current    : ${now.toUTCString()}
Load Avg   : 0.42 0.38 0.35
Memory     : 2.1GB / 8GB
All systems: <span class="t-ok">● Operational</span>\n`;
            },

            ls: () => `
<span class="t-cmd">projects/</span>   <span class="t-cmd">scripts/</span>   <span class="t-cmd">configs/</span>
README.md   Dockerfile  docker-compose.yml   .env.example
Makefile    terraform/  kubernetes/\n`,

            'cat README.md': () => `
<span class="t-head"># Ilyass Bougajdi — Portfolio</span>

A DevOps engineer who writes infrastructure like code
and treats uptime like a virtue.

Built with: Vanilla JS · Three.js · GSAP · CSS
Deploy target: GitHub Pages
Uptime: <span class="t-ok">Always on</span> 🚀\n`,

            clear: null, // handled separately
            exit: null,  // handled separately
        };
        window.TERMINAL_COMMANDS = COMMANDS;

        // --- Rendering Helpers ---
        const appendLine = (html, color = null, cls = '') => {
            const div = document.createElement('div');
            div.innerHTML = html;
            div.classList.add('t-line');
            if (cls) div.classList.add(cls);
            if (color) div.style.color = color;
            terminalText.appendChild(div);
            terminalBody.scrollTop = terminalBody.scrollHeight;
            return div;
        };

        const appendPromptLine = (cmd) => {
            appendLine(`<span class="t-prompt">ilyass@devops:~$</span> <span class="t-input">${cmd}</span>`);
        };

        const processCommand = (cmd) => {
            const raw = cmd.trim().toLowerCase();
            if (!raw) return;

            if (raw === 'clear') {
                terminalText.innerHTML = '';
                return;
            }
            if (raw === 'exit') {
                terminalText.innerHTML = '';
                inputLine.style.display = 'none';
                isInteractive = false;
                collapseTerminal();
                return;
            }

            const handler = COMMANDS[raw];
            if (handler) {
                const output = handler();
                appendLine(output, null, 't-output');
            } else {
                appendLine(`<span class="t-err">bash: ${cmd}: command not found.</span> Type <span class="t-cmd">help</span> for commands.`, null, 't-output');
            }
        };

        // --- Auto-play Mode ---
        const autoSequence = [
            { cmd: 'whoami', delay: 600 },
            { cmd: 'docker ps', delay: 2500 },
            { cmd: 'kubectl', delay: 2500 },
            { cmd: 'uptime', delay: 2500 },
            { cmd: 'ls', delay: 2000 },
        ];

        let autoIdx = 0;

        const typeCommand = async (text, div) => {
            for (let i = 0; i < text.length; i++) {
                if (isInteractive || !autoPlayRunning) return false;
                div.querySelector('.t-input').textContent += text[i];
                await new Promise(r => setTimeout(r, Math.random() * 40 + 30));
            }
            return true;
        };

        const runNextAutoStep = async () => {
            if (isInteractive || !autoPlayRunning) return;

            const step = autoSequence[autoIdx % autoSequence.length];
            autoIdx++;

            // Print prompt line with typewriter
            const promptDiv = document.createElement('div');
            promptDiv.classList.add('t-line');
            promptDiv.innerHTML = `<span class="t-prompt">ilyass@devops:~$</span> <span class="t-input"></span>`;
            terminalText.appendChild(promptDiv);
            terminalBody.scrollTop = terminalBody.scrollHeight;

            const typed = await typeCommand(step.cmd, promptDiv);
            if (!typed) return;

            await new Promise(r => setTimeout(r, 200));
            if (isInteractive || !autoPlayRunning) return;

            processCommand(step.cmd);
            
            // Pause between commands; clear before next round
            autoPlayTimeout = setTimeout(async () => {
                if (!isInteractive && autoPlayRunning) {
                    // Clear after displaying result for readability
                    await new Promise(r => setTimeout(r, 400));
                    if (!isInteractive && autoPlayRunning) {
                        terminalText.innerHTML = '';
                        runNextAutoStep();
                    }
                }
            }, step.delay);
        };

        const startAutoPlay = () => {
            autoPlayRunning = true;
            terminalText.innerHTML = '';
            // Show a hint
            appendLine(`<span class="t-dim">[ Hover to interact · type <span class="t-cmd">help</span> for commands ]</span>`);
            setTimeout(() => {
                if (!isInteractive) runNextAutoStep();
            }, 1200);
        };

        const expandTerminal = () => {
            if (!terminalLoader) return;
            terminalLoader.classList.add('expanded');
            document.body.classList.add('terminal-active');
        };

        const collapseTerminal = () => {
            if (!terminalLoader) return;
            terminalLoader.classList.remove('expanded');
            document.body.classList.remove('terminal-active');
            startAutoPlay();
        };

        const switchToInteractive = () => {
            if (isInteractive) return;
            isInteractive = true;
            autoPlayRunning = false;
            if (autoPlayTimeout) clearTimeout(autoPlayTimeout);
            expandTerminal();
            terminalText.innerHTML = '';
            appendLine(`<span class="t-dim">Interactive mode. Type <span class="t-cmd">help</span> for commands · <span class="t-cmd">exit</span> or move mouse away to minimize.</span>`);
            inputLine.style.display = 'flex';
            terminalInput.focus();
        };

        // --- Hover Handlers ---
        terminalLoader.addEventListener('mouseenter', () => {
            if (!isInteractive) {
                switchToInteractive();
            }
        });

        terminalLoader.addEventListener('mouseleave', () => {
            if (isInteractive) {
                isInteractive = false;
                inputLine.style.display = 'none';
                collapseTerminal();
            }
        });

        // --- Keyboard Handler ---
        terminalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = terminalInput.value.trim();
                terminalInput.value = '';
                historyIdx = -1;

                if (cmd) {
                    cmdHistory.unshift(cmd);
                    if (cmdHistory.length > 50) cmdHistory.pop();
                    appendPromptLine(cmd);
                    processCommand(cmd);
                }
                terminalBody.scrollTop = terminalBody.scrollHeight;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIdx < cmdHistory.length - 1) {
                    historyIdx++;
                    terminalInput.value = cmdHistory[historyIdx] || '';
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIdx > 0) {
                    historyIdx--;
                    terminalInput.value = cmdHistory[historyIdx] || '';
                } else {
                    historyIdx = -1;
                    terminalInput.value = '';
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                const partial = terminalInput.value.toLowerCase();
                const match = Object.keys(COMMANDS).find(k => k.startsWith(partial) && k !== partial);
                if (match) terminalInput.value = match;
            }
        });

        // --- Start ---
        setTimeout(startAutoPlay, 1500);
    }
});

// 7. 3D Architecture Visualization (Three.js)
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('three-container');
    if (!container || typeof THREE === 'undefined') return;

    // SCENE SETUP
    const scene = new THREE.Scene();
    // Transparent background

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 5, 16);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // CONTROLS
    let controls;
    if (typeof THREE.OrbitControls !== 'undefined') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enableZoom = false;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.8;
    }

    // LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x64ffda, 2, 50);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    // GROUP
    const group = new THREE.Group();
    scene.add(group);

    // --- 1. Center Hub (DevOps Core) ---
    const hubGeo = new THREE.IcosahedronGeometry(2.5, 0);
    const hubMat = new THREE.MeshBasicMaterial({
        color: 0x64ffda,
        wireframe: true,
        transparent: true,
        opacity: 0.3
    });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    group.add(hub);

    // Inner Core (Solid glowing)
    const coreGeo = new THREE.IcosahedronGeometry(1.5, 1);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0x64ffda,
        wireframe: true,
        transparent: true,
        opacity: 0.8
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    hub.add(core);

    // Orbiting Ring
    const ringGeo = new THREE.TorusGeometry(5, 0.05, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x306060, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Sprite Text Helper
    const createSpriteText = (text, color = '#64ffda', size = 1) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontSize = 64;
        canvas.width = 512;
        canvas.height = 128;

        ctx.font = `bold ${fontSize}px "Courier New", monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowColor = 'rgba(0,0,0,1)';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = 'rgba(2, 12, 27, 0.9)';
        ctx.lineWidth = 6;
        ctx.strokeText(text, 256, 64);
        ctx.fillText(text, 256, 64);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(4 * size, 1 * size, 1);
        return sprite;
    };

    // Hub Label
    const hubLabel = createSpriteText('DEV∞OPS', '#64ffda', 1.2);
    hubLabel.position.set(0, 3.5, 0);
    group.add(hubLabel);

    // --- 2. Satellite Nodes ---
    const nodes = [];
    const packetSystems = []; // Store data packet systems

    const projects = [
        { name: 'CONTAINER', pos: { x: 8, y: 1, z: 2 }, geo: new THREE.BoxGeometry(2, 2, 2) },
        { name: 'K8S', pos: { x: -7, y: -2, z: 6 }, geo: new THREE.OctahedronGeometry(1.5) },
        { name: 'PIPELINE', pos: { x: -6, y: 4, z: -5 }, geo: new THREE.CylinderGeometry(0.5, 0.5, 3, 8) }
    ];

    projects.forEach(proj => {
        // Node
        const nodeMat = new THREE.MeshStandardMaterial({
            color: 0x112240,
            emissive: 0x64ffda,
            emissiveIntensity: 0.3,
            roughness: 0.1,
            metalness: 0.8,
            wireframe: false
        });
        const node = new THREE.Mesh(proj.geo, nodeMat);
        node.position.set(proj.pos.x, proj.pos.y, proj.pos.z);
        group.add(node);
        nodes.push(node);

        // Wireframe Overlay for Tech Look
        const wire = new THREE.LineSegments(
            new THREE.WireframeGeometry(proj.geo),
            new THREE.LineBasicMaterial({ color: 0x64ffda, transparent: true, opacity: 0.1 })
        );
        node.add(wire);

        // Label
        const label = createSpriteText(proj.name);
        label.position.set(0, 2.5, 0);
        node.add(label);

        // Connection Line
        const points = [new THREE.Vector3(0, 0, 0), node.position];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x64ffda, transparent: true, opacity: 0.1 });
        const line = new THREE.Line(lineGeo, lineMat);
        group.add(line);

        // --- Data Packet Animation ---
        // Create a moving particle along the line
        const packetGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const packetMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const packet = new THREE.Mesh(packetGeo, packetMat);
        group.add(packet);

        packetSystems.push({
            mesh: packet,
            start: new THREE.Vector3(0, 0, 0),
            end: node.position.clone(),
            progress: Math.random(), // Staggered start
            speed: 0.01 + Math.random() * 0.01
        });
    });

    // Particle Field (Stars/Dust)
    const particlesGeo = new THREE.BufferGeometry();
    const particleCount = 200;
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 40;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMat = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x64ffda,
        transparent: true,
        opacity: 0.4
    });
    const particleMesh = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particleMesh);

    // Floor Grid
    const gridHelper = new THREE.GridHelper(60, 40, 0x1d2d50, 0x0a192f);
    gridHelper.position.y = -8;
    gridHelper.material.opacity = 0.2; // Softer grid
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // RAYCASTER
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    container.addEventListener('mousemove', (event) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
    });

    // ANIMATION & INTERSECTION OBSERVER
    let isAnimating = false;
    let animationId = null;

    const animate = () => {
        if (!isAnimating) return;
        animationId = requestAnimationFrame(animate);
        const time = Date.now() * 0.001;

        if (controls && controls.autoRotate) controls.update();

        // Dynamic RGB Hack Color
        const dynamicColor = new THREE.Color().setHSL((time * 50 % 360) / 360, 1, 0.5);

        // Update Material Colors
        hubMat.color.copy(dynamicColor);
        coreMat.color.copy(dynamicColor);
        particlesMat.color.copy(dynamicColor);
        
        nodes.forEach((node) => {
            node.material.emissive.copy(dynamicColor);
            // The wireframe is a child of the node, its material is shared or could be updated directly
            node.children.forEach(child => {
                if (child.isLineSegments) {
                    child.material.color.copy(dynamicColor);
                }
            });
        });
        
        // Update connection lines
        group.children.forEach(child => {
            if (child.isLine && !child.isLineSegments) {
                child.material.color.copy(dynamicColor);
            }
        });

        // Hub Animation
        hub.rotation.y += 0.002;
        hub.rotation.x = Math.sin(time * 0.5) * 0.1;
        core.rotation.y -= 0.01;

        // Ring Animation
        ring.rotation.x = Math.PI / 2 + Math.sin(time) * 0.1;
        ring.rotation.y = Math.cos(time * 0.5) * 0.1;

        // Node Levitations
        nodes.forEach((node, i) => {
            node.rotation.y += 0.005;
            node.position.y += Math.sin(time * 2 + i) * 0.003;
        });

        // Data Packets Flow
        packetSystems.forEach(pkg => {
            pkg.progress += pkg.speed;
            if (pkg.progress > 1) pkg.progress = 0;

            // Lerp position
            pkg.mesh.position.lerpVectors(pkg.start, pkg.end, pkg.progress);
        });

        // Interaction
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(nodes);

        nodes.forEach(n => n.material.emissiveIntensity = 0.3);
        document.body.style.cursor = 'default';

        if (intersects.length > 0) {
            intersects[0].object.material.emissiveIntensity = 1.0;
            intersects[0].object.rotation.y += 0.05; // Spin faster on hover
            document.body.style.cursor = 'pointer';
            controls.autoRotate = false;
        } else {
            controls.autoRotate = true;
        }

        renderer.render(scene, camera);
    };

    // Intersection Observer to Pause/Play ThreeJS Animation
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (!isAnimating) {
                    isAnimating = true;
                    animate();
                }
            } else {
                isAnimating = false;
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            }
        });
    }, { threshold: 0.1 });

    const threejsSection = document.getElementById('devops-visual');
    if (threejsSection) {
        observer.observe(threejsSection);
    } else {
        // Fallback if section ID isn't found
        isAnimating = true;
        animate();
    }

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
});

// 8. Space Floating & Interactive Social Icons
document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined') return;

    const icons = document.querySelectorAll('.social-icon');
    const container = document.getElementById('social-icons-container');
    if (!icons.length || !container) return;

    // Remove any previous tweens
    gsap.killTweensOf(icons);

    icons.forEach((icon, index) => {
        const state = {
            swayX: 0,
            swayY: 0,
            rot: 0,
            hover: 0, 
            magnetX: 0,
            magnetY: 0
        };

        // Sway animations
        gsap.to(state, {
            swayX: "random(-20, 20)",
            swayY: "random(-30, 30)",
            rot: "random(-30, 30)",
            duration: "random(3, 5)",
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            delay: Math.random() * 2
        });

        let hoverTween = null;
        
        icon.addEventListener('mouseenter', (e) => {
            if (hoverTween) hoverTween.kill();
            const rect = icon.getBoundingClientRect();
            // Store center of icon dynamically when mouse enters
            icon._centerX = rect.left + rect.width / 2;
            icon._centerY = rect.top + rect.height / 2;
            
            state.magnetX = (e.clientX - icon._centerX) * 0.8;
            state.magnetY = (e.clientY - icon._centerY) * 0.8;
            hoverTween = gsap.to(state, { hover: 1, duration: 0.3, ease: "power2.out" });
        });

        icon.addEventListener('mousemove', (e) => {
            if(icon._centerX && icon._centerY) {
                state.magnetX = (e.clientX - icon._centerX) * 0.8;
                state.magnetY = (e.clientY - icon._centerY) * 0.8;
            }
        });

        icon.addEventListener('mouseleave', () => {
            if (hoverTween) hoverTween.kill();
            hoverTween = gsap.to(state, { hover: 0, duration: 0.5, ease: "power2.out" });
        });

        // Frame rendering
        gsap.ticker.add(() => {
            // Interpolate smoothly between floating state and magnet state
            const currentX = state.swayX + (state.magnetX - state.swayX) * state.hover;
            const currentY = state.swayY + (state.magnetY - state.swayY) * state.hover;
            const currentRot = state.rot * (1 - state.hover);

            gsap.set(icon, {
                x: currentX,
                y: currentY,
                rotation: currentRot,
                force3D: true // Hardware acceleration
            });
        });
    });

    // Global Parallax shift on the container for the "space" interactive feel
    window.addEventListener('mousemove', (e) => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        // Inverse movement to mouse
        const moveX = (e.clientX - centerX) * -0.015;
        const moveY = (e.clientY - centerY) * -0.015;

        gsap.to(container, {
            x: moveX,
            y: moveY,
            duration: 1.5,
            ease: "power2.out"
        });
    });
});

// 9. DevOps Project Modal Logic
document.addEventListener('DOMContentLoaded', () => {
    const projectCards = document.querySelectorAll('.service-card[data-project-id]');
    const modal = document.getElementById('project-modal');
    if (!modal) return;

    const modalCloseBtn = document.getElementById('modal-close-dot');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');

    const modalInput = document.getElementById('modal-terminal-input');
    const modalBody = document.querySelector('.modal-body');

    const projectDetails = {
        transcendence: `$> cat describe_project.sh\n<span style="color: var(--accent);">Project</span>: ft_transcendence\n<span style="color: var(--accent);">Type</span>: Cloud-Native GitOps Platform\n<span style="color: var(--accent);">Description</span>: Microservices Pong platform with real-time chat and matchmaking, deployed via ArgoCD with full GitOps automation on OCI.\n<span style="color: var(--accent);">Tech Stack</span>:\n  - NestJS\n  - React\n  - Postgres\n  - Kubernetes\n  - ArgoCD\n<span style="color: var(--accent);">Key Highlights</span>:\n  [✔] GitOps CI/CD\n  [✔] ELK Observability\n  [✔] SOPS Secrets\n`,
        irc: `$> cat describe_project.sh\n<span style="color: var(--accent);">Project</span>: ft_irc\n<span style="color: var(--accent);">Type</span>: IRC Server\n<span style="color: var(--accent);">Description</span>: Fully functional IRC server from scratch. Handles concurrent clients via non-blocking sockets and poll().\n<span style="color: var(--accent);">Language</span>: C++\n<span style="color: var(--accent);">I/O Multiplexing</span>: Non-blocking (poll)\n<span style="color: var(--accent);">Protocol</span>: TCP/IP\n`,
        inception: `$> cat describe_project.sh\n<span style="color: var(--accent);">Project</span>: Inception\n<span style="color: var(--accent);">Role</span>: System Admin\n<span style="color: var(--accent);">Description</span>: Strictly containerized infrastructure on Debian from scratch with private networking, persistent volumes, and optimized Dockerfiles.\n<span style="color: var(--accent);">Tech Stack</span>:\n  - Docker & Docker Compose\n  - Nginx\n  - MariaDB\n  - WordPress\n<span style="color: var(--accent);">Security</span>: Strict\n<span style="color: var(--accent);">Uptime Metric</span>: 100% Reproducible\n`
    };

    const openModal = (projectId, titleText) => {
        modalTitle.textContent = titleText;
        modalContent.innerHTML = projectDetails[projectId] || `$> echo "Project data not found."\n`;
        modal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        if (modalInput) {
            modalInput.value = '';
            setTimeout(() => modalInput.focus(), 100);
        }
    };

    const closeModal = () => {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    };

    projectCards.forEach(card => {
        card.addEventListener('click', () => {
            const projectId = card.getAttribute('data-project-id');
            const title = card.querySelector('.service-name').textContent;
            openModal(projectId, title);
        });
    });

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        } else if (modalInput) {
            // Auto-focus input when clicking inside the modal
            modalInput.focus();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            closeModal();
        }
    });

    // --- Modal Terminal Interaction Logic ---
    if (modalInput) {
        let cmdHistory = [];
        let historyIdx = -1;

        const appendLine = (html, cls = '') => {
            const div = document.createElement('div');
            div.innerHTML = html;
            div.classList.add('t-line');
            if (cls) div.classList.add(cls);
            modalContent.appendChild(div);
            if (modalBody) modalBody.scrollTop = modalBody.scrollHeight;
        };

        modalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = modalInput.value.trim();
                modalInput.value = '';
                historyIdx = -1;

                if (cmd) {
                    cmdHistory.unshift(cmd);
                    if (cmdHistory.length > 50) cmdHistory.pop();
                    
                    // Echo command
                    appendLine(`<span class="t-prompt" style="color: var(--accent);">ilyass@devops:~$</span> <span class="t-input">${cmd}</span>`);
                    
                    // Process command
                    const raw = cmd.toLowerCase();
                    if (raw === 'clear') {
                        modalContent.innerHTML = '';
                    } else if (raw === 'exit') {
                        closeModal();
                    } else {
                        const handler = window.TERMINAL_COMMANDS ? window.TERMINAL_COMMANDS[raw] : null;
                        if (handler) {
                            appendLine(handler(), 't-output');
                        } else {
                            appendLine(`<span class="t-err">bash: ${cmd}: command not found.</span> Type <span class="t-cmd">help</span> for commands.`, 't-output');
                        }
                    }
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIdx < cmdHistory.length - 1) {
                    historyIdx++;
                    modalInput.value = cmdHistory[historyIdx] || '';
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIdx > 0) {
                    historyIdx--;
                    modalInput.value = cmdHistory[historyIdx] || '';
                } else {
                    historyIdx = -1;
                    modalInput.value = '';
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                if (window.TERMINAL_COMMANDS) {
                    const partial = modalInput.value.toLowerCase();
                    const match = Object.keys(window.TERMINAL_COMMANDS).find(k => k.startsWith(partial) && k !== partial);
                    if (match) modalInput.value = match;
                }
            }
        });
    }
});

// 10. About Me Terminal Interaction
document.addEventListener('DOMContentLoaded', () => {
    const aboutInput = document.getElementById('about-terminal-input');
    const aboutContent = document.getElementById('about-terminal-content');
    const aboutBody = document.getElementById('about-terminal-body');

    if (aboutInput && aboutContent && aboutBody) {
        let cmdHistory = [];
        let historyIdx = -1;

        const appendLine = (html, cls = '') => {
            const div = document.createElement('div');
            div.innerHTML = html;
            div.classList.add('t-line');
            if (cls) div.classList.add(cls);
            aboutContent.appendChild(div);
            aboutBody.scrollTop = aboutBody.scrollHeight;
        };

        aboutInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = aboutInput.value.trim();
                aboutInput.value = '';
                historyIdx = -1;

                if (cmd) {
                    cmdHistory.unshift(cmd);
                    if (cmdHistory.length > 50) cmdHistory.pop();
                    
                    // Echo command
                    appendLine(`<span class="t-prompt" style="color: var(--accent);">ilyass@devops:~$</span> <span class="t-input">${cmd}</span>`);
                    
                    // Process command
                    const raw = cmd.toLowerCase();
                    if (raw === 'clear') {
                        aboutContent.innerHTML = '';
                    } else {
                        const handler = window.TERMINAL_COMMANDS ? window.TERMINAL_COMMANDS[raw] : null;
                        if (handler) {
                            appendLine(handler(), 't-output');
                        } else {
                            appendLine(`<span class="t-err">bash: ${cmd}: command not found.</span> Type <span class="t-cmd">help</span> for commands.`, 't-output');
                        }
                    }
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIdx < cmdHistory.length - 1) {
                    historyIdx++;
                    aboutInput.value = cmdHistory[historyIdx] || '';
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIdx > 0) {
                    historyIdx--;
                    aboutInput.value = cmdHistory[historyIdx] || '';
                } else {
                    historyIdx = -1;
                    aboutInput.value = '';
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                if (window.TERMINAL_COMMANDS) {
                    const partial = aboutInput.value.toLowerCase();
                    const match = Object.keys(window.TERMINAL_COMMANDS).find(k => k.startsWith(partial) && k !== partial);
                    if (match) aboutInput.value = match;
                }
            }
        });

        aboutBody.addEventListener('click', () => {
            aboutInput.focus();
        });
    }
});

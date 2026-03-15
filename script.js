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
                el.style.transform = '';
            });

            if (el.classList.contains('cta-button') || el.closest('.social-icons')) {
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

            // Base Colors
            const baseColor = isLight ? 'rgba(0, 86, 179, 0.4)' : 'rgba(0, 255, 136, 0.4)';
            const baseLineColor = isLight ? 'rgba(0, 86, 179, 0.1)' : 'rgba(0, 255, 136, 0.1)';

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

    // 7. Terminal Typewriter Effect (Infinite Loop with DevOps Commands)
    const terminalText = document.getElementById('typewriter-text');
    if (terminalText) {
        const commandSequence = [
            { text: "$ whoami", delay: 0, outputDelay: 300 },
            { text: "> devops_engineer", isOutput: true, delay: 1000 },

            { text: "$ docker ps --format 'table {{.Names}}\t{{.Status}}'", delay: 300, outputDelay: 400 },
            { text: "NAMES\t\tSTATUS\nnginx-lb\tUp 4 hours\npostgres-db\tUp 4 hours\nportfolio\tUp 2 minutes", isOutput: true, delay: 2000 },

            { text: "$ terraform plan", delay: 300, outputDelay: 800 },
            { text: "Plan: 3 to add, 0 to change, 0 to destroy.\n\nChanges to Outputs:\n  + load_balancer_ip = (known after apply)", isOutput: true, delay: 2000 },

            { text: "$ kubectl get pods -n production", delay: 300, outputDelay: 500 },
            { text: "NAME\t\tREADY\tSTATUS\tRESTART\nfrontend-7b\t1/1\tRunning\t0\napi-gateway-x\t1/1\tRunning\t0", isOutput: true, delay: 2000 },

            { text: "$ ansible-playbook deploy.yml", delay: 300, outputDelay: 1000 },
            { text: "[OK] Gather Facts\n[OK] Install Dependencies\n[OK] Deploy Artifacts\n[Changed] Restart Service", isOutput: true, delay: 2000 },

            { text: "$ ./status_check.sh", delay: 300, outputDelay: 300 },
            { text: "All Systems Operational.\nUptime: 99.9% 🚀", isOutput: true, delay: 3000 },
        ];

        const typeRecursive = async () => {
            while (true) { // Infinite loop
                for (const cmd of commandSequence) {
                    // NEW: If it's a new command (starts with $), clear the terminal first.
                    // This creates the "overwrite" effect so it doesn't expand forever.
                    if (cmd.text.startsWith('$')) {
                        terminalText.innerHTML = '';
                    }

                    // Create line container
                    const div = document.createElement('div');
                    if (cmd.isOutput) {
                        div.style.color = '#a5d6ff'; // Output color (softer blue/white)
                        div.style.marginBottom = '10px';
                        div.style.lineHeight = '1.4'; // Slightly tighter for output
                    } else {
                        div.style.color = '#5af78e'; // Command color (Green)
                        div.style.marginTop = '0px'; // Reset margin
                        div.style.fontWeight = 'bold';
                    }
                    div.style.whiteSpace = 'pre-wrap'; // Preserve format
                    terminalText.appendChild(div);

                    // Type effect
                    if (cmd.isOutput) {
                        // Outputs appear faster
                        div.textContent = cmd.text;
                        await new Promise(r => setTimeout(r, cmd.delay));
                    } else {
                        // Commands type out char by char
                        for (let i = 0; i < cmd.text.length; i++) {
                            div.textContent += cmd.text[i];
                            await new Promise(r => setTimeout(r, Math.random() * 30 + 30));
                            // Scroll handled automatically by overwrite (always top) but good safety
                        }
                        // Pause before showing output
                        await new Promise(r => setTimeout(r, cmd.outputDelay || 200));
                    }
                }
            }
        };

        // Start loop
        setTimeout(() => {
            typeRecursive();
        }, 1500);
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

    // ANIMATION
    const animate = () => {
        requestAnimationFrame(animate);
        const time = Date.now() * 0.001;

        if (controls && controls.autoRotate) controls.update();

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

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
});

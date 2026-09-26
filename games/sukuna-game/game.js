/**
 * Sukuna - Magical Physics Puzzle Game Module for QuantumPlay
 * Widescreen (1200x675) Laptop Display Edition
 * Powered by Matter.js Physics Engine
 */

(function () {
    let engine, world;
    let animationFrameId = null;

    const CELESTIAL_TIERS = [
        { tier: 0, name: "Star Gem", radius: 18, color: "#ffe066", emoji: "⭐", score: 2 },
        { tier: 1, name: "Moon Shard", radius: 25, color: "#80e5ff", emoji: "🌙", score: 4 },
        { tier: 2, name: "Sun Drop", radius: 32, color: "#ff8c1a", emoji: "☀️", score: 8 },
        { tier: 3, name: "Galaxy Petal", radius: 40, color: "#ff66cc", emoji: "🌸", score: 16 },
        { tier: 4, name: "Nebula Pearl", radius: 48, color: "#b366ff", emoji: "🔮", score: 32 },
        { tier: 5, name: "Comet Ring", radius: 57, color: "#33ffff", emoji: "🪐", score: 64 },
    ];

    const CANVAS_WIDTH = 1200;
    const CANVAS_HEIGHT = 675;

    // Centered Physics Container Box
    const CONTAINER_LEFT = 380;
    const CONTAINER_RIGHT = 820;
    const CONTAINER_WIDTH = CONTAINER_RIGHT - CONTAINER_LEFT;
    const DROP_Y = 55;
    const LIMIT_Y = 115;
    const GAME_OVER_BUFFER_MS = 1500;
    const DROP_COOLDOWN_MS = 500;

    let score = 0;
    let highScore = 0;
    let currentItemTier = null;
    let nextItemTier = null;
    let previewBody = null;
    let canDrop = true;
    let isGameOver = false;
    let pointerX = CANVAS_WIDTH / 2;
    let lastBtnAState = false;

    const bodiesAboveLimit = new Map();
    let mergeParticles = [];

    // Web Audio Synthesizer
    let audioCtx = null;
    function initAudioContext() {
        if (!audioCtx) {
            const AudioClass = window.AudioContext || window.webkitAudioContext;
            if (AudioClass) audioCtx = new AudioClass();
        }
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }

    function playSound(type) {
        if (!audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            if (type === 'drop') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(250, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
                osc.start(now);
                osc.stop(now + 0.18);
            } else if (type === 'merge') {
                const chord = [392.00, 523.25, 659.25, 783.99];
                chord.forEach((freq, idx) => {
                    const noteOsc = audioCtx.createOscillator();
                    const noteGain = audioCtx.createGain();
                    noteOsc.type = 'sine';
                    noteOsc.connect(noteGain);
                    noteGain.connect(audioCtx.destination);
                    noteOsc.frequency.setValueAtTime(freq, now + (idx * 0.05));
                    noteGain.gain.setValueAtTime(0.05, now + (idx * 0.05));
                    noteGain.gain.exponentialRampToValueAtTime(0.001, now + (idx * 0.05) + 0.25);
                    noteOsc.start(now + (idx * 0.05));
                    noteOsc.stop(now + (idx * 0.05) + 0.25);
                });
            }
        } catch (e) {}
    }

    function createMergeParticles(x, y, color) {
        for (let i = 0; i < 18; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            mergeParticles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2.0,
                radius: Math.random() * 4 + 2,
                color: color,
                alpha: 1.0,
                decay: Math.random() * 0.025 + 0.015
            });
        }
    }

    function updateAndDrawParticles(ctx) {
        for (let i = mergeParticles.length - 1; i >= 0; i--) {
            const p = mergeParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.10;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                mergeParticles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function start(canvas, ctx, getInput) {
        initAudioContext();
        if (typeof Matter === 'undefined') {
            console.error('Matter.js is required for Sukuna Game.');
            return;
        }

        const { Engine, Bodies, Composite, Events, Body } = Matter;

        score = 0;
        isGameOver = false;
        canDrop = true;
        mergeParticles = [];
        bodiesAboveLimit.clear();
        pointerX = CANVAS_WIDTH / 2;
        lastBtnAState = false;

        engine = Engine.create({ gravity: { y: 0.98, scale: 0.001 } });
        world = engine.world;

        // Static Boundaries around centered container
        const wallOptions = { isStatic: true, friction: 0.2, render: { visible: false } };
        const leftWall = Bodies.rectangle(CONTAINER_LEFT - 10, CANVAS_HEIGHT / 2, 20, CANVAS_HEIGHT, wallOptions);
        const rightWall = Bodies.rectangle(CONTAINER_RIGHT + 10, CANVAS_HEIGHT / 2, 20, CANVAS_HEIGHT, wallOptions);
        const floor = Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 25, CONTAINER_WIDTH + 20, 30, wallOptions);
        Composite.add(world, [leftWall, rightWall, floor]);

        currentItemTier = Math.floor(Math.random() * 4);
        nextItemTier = Math.floor(Math.random() * 4);
        spawnPreviewFruit();

        Events.on(engine, 'collisionStart', (event) => {
            const pairs = event.pairs;
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i];
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;
                if (bodyA.isStatic || bodyB.isStatic) continue;

                const tierA = bodyA.plugin ? bodyA.plugin.tier : undefined;
                const tierB = bodyB.plugin ? bodyB.plugin.tier : undefined;

                if (tierA !== undefined && tierA === tierB) {
                    if (bodyA.plugin.merged || bodyB.plugin.merged) continue;
                    bodyA.plugin.merged = true;
                    bodyB.plugin.merged = true;

                    const midX = (bodyA.position.x + bodyB.position.x) / 2;
                    const midY = (bodyA.position.y + bodyB.position.y) / 2;

                    setTimeout(() => {
                        Composite.remove(world, [bodyA, bodyB]);
                        const nextTier = tierA + 1;
                        if (nextTier < CELESTIAL_TIERS.length) {
                            spawnFruit(midX, midY, nextTier);
                            playSound('merge');
                            score += CELESTIAL_TIERS[tierA].score;
                            if (score > highScore) highScore = score;
                            createMergeParticles(midX, midY, CELESTIAL_TIERS[nextTier].color);
                        }
                    }, 0);
                }
            }
        });

        Events.on(engine, 'afterUpdate', () => {
            if (isGameOver) return;
            const bodies = Composite.allBodies(world);
            const now = Date.now();

            bodies.forEach(body => {
                if (body.isStatic || (body.plugin && body.plugin.isPreview)) return;
                if (body.plugin && (now - body.plugin.createdAt < 1000)) return;

                if (body.position.y < LIMIT_Y) {
                    if (!bodiesAboveLimit.has(body.id)) {
                        bodiesAboveLimit.set(body.id, now);
                    } else if (now - bodiesAboveLimit.get(body.id) > GAME_OVER_BUFFER_MS) {
                        isGameOver = true;
                    }
                } else {
                    bodiesAboveLimit.delete(body.id);
                }
            });
        });

        // Mouse/Touch Direct Pointer Controls
        const handleCanvasPointer = (clientX) => {
            const rect = canvas.getBoundingClientRect();
            const scaledX = (clientX - rect.left) * (CANVAS_WIDTH / rect.width);
            updatePointerX(scaledX);
        };

        canvas.onmousemove = (e) => handleCanvasPointer(e.clientX);
        canvas.onmousedown = (e) => {
            handleCanvasPointer(e.clientX);
            dropCurrentFruit();
        };

        function spawnPreviewFruit() {
            if (isGameOver) return;
            const item = CELESTIAL_TIERS[currentItemTier];
            const r = item.radius;
            pointerX = Math.max(CONTAINER_LEFT + r + 5, Math.min(CONTAINER_RIGHT - r - 5, pointerX));

            previewBody = Bodies.circle(pointerX, DROP_Y, r, {
                isStatic: true,
                collisionFilter: { category: 0x0002, mask: 0x0000 },
                plugin: { tier: currentItemTier, isPreview: true }
            });
            Composite.add(world, previewBody);
        }

        function spawnFruit(x, y, tier) {
            const item = CELESTIAL_TIERS[tier];
            const circle = Bodies.circle(x, y, item.radius, {
                friction: 0.12,
                restitution: 0.18,
                density: 0.001,
                plugin: { tier: tier, merged: false, createdAt: Date.now() }
            });
            Composite.add(world, circle);
            return circle;
        }

        function updatePointerX(newX) {
            if (isGameOver || currentItemTier === null) return;
            const r = CELESTIAL_TIERS[currentItemTier].radius;
            pointerX = Math.max(CONTAINER_LEFT + r + 5, Math.min(CONTAINER_RIGHT - r - 5, newX));
            if (previewBody) {
                Body.setPosition(previewBody, { x: pointerX, y: DROP_Y });
            }
        }

        function dropCurrentFruit() {
            if (!canDrop || isGameOver || currentItemTier === null) return;
            canDrop = false;
            playSound('drop');

            if (previewBody) {
                Composite.remove(world, previewBody);
                previewBody = null;
            }

            spawnFruit(pointerX, DROP_Y, currentItemTier);

            setTimeout(() => {
                if (isGameOver) return;
                currentItemTier = nextItemTier;
                nextItemTier = Math.floor(Math.random() * 5);
                spawnPreviewFruit();
                canDrop = true;
            }, DROP_COOLDOWN_MS);
        }

        // --- MAIN RENDER LOOP ---
        function loop() {
            Engine.update(engine, 1000 / 60);
            const input = getInput();

            // Analog Joystick X Control
            if (input && Math.abs(input.x) > 0.05) {
                updatePointerX(pointerX + input.x * 7);
            } else if (input && input.left) {
                updatePointerX(pointerX - 6);
            } else if (input && input.right) {
                updatePointerX(pointerX + 6);
            }

            // Action Button DROP
            if (input && input.btnA && !lastBtnAState) {
                dropCurrentFruit();
            }
            lastBtnAState = input ? input.btnA : false;

            // --- CANVAS DRAWING ---
            ctx.save();
            ctx.fillStyle = '#120317';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // Container Background Surface
            ctx.fillStyle = 'rgba(45, 11, 54, 0.7)';
            ctx.fillRect(CONTAINER_LEFT, 0, CONTAINER_WIDTH, CANVAS_HEIGHT - 40);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 4;
            ctx.strokeRect(CONTAINER_LEFT, 0, CONTAINER_WIDTH, CANVAS_HEIGHT - 40);

            // Upper Limit Line
            ctx.beginPath();
            ctx.moveTo(CONTAINER_LEFT, LIMIT_Y);
            ctx.lineTo(CONTAINER_RIGHT, LIMIT_Y);
            ctx.strokeStyle = isGameOver ? 'rgba(255, 51, 170, 0.8)' : 'rgba(218, 112, 214, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Aim Guide Line
            if (canDrop && !isGameOver) {
                ctx.beginPath();
                ctx.moveTo(pointerX, DROP_Y);
                ctx.lineTo(pointerX, CANVAS_HEIGHT - 40);
                ctx.strokeStyle = 'rgba(255, 51, 170, 0.3)';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Draw Matter.js Celestial Bodies
            const bodies = Composite.allBodies(world);
            bodies.forEach(body => {
                const tier = body.plugin ? body.plugin.tier : undefined;
                if (tier !== undefined) {
                    const item = CELESTIAL_TIERS[tier];
                    const isPreview = body.plugin.isPreview;

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(body.position.x, body.position.y, item.radius - 2, 0, Math.PI * 2);
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = 3;
                    ctx.shadowColor = item.color;
                    ctx.shadowBlur = isPreview ? 8 : 16;
                    ctx.stroke();
                    ctx.restore();

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(body.position.x, body.position.y, item.radius, 0, Math.PI * 2);
                    ctx.fillStyle = item.color;
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.font = `bold ${item.radius * 0.95}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(item.emoji, body.position.x, body.position.y);
                    ctx.restore();
                }
            });

            updateAndDrawParticles(ctx);

            // --- LEFT PANEL: LOGO & STATS ---
            ctx.fillStyle = '#ffffff';
            ctx.font = '800 32px Outfit, sans-serif';
            ctx.fillText('SUKUNA PUZZLE', 40, 60);

            // Stat Card 1: Score
            ctx.fillStyle = 'rgba(255, 51, 170, 0.1)';
            ctx.fillRect(40, 90, 140, 70);
            ctx.strokeStyle = 'rgba(255, 51, 170, 0.3)';
            ctx.strokeRect(40, 90, 140, 70);
            ctx.fillStyle = '#d8c3df';
            ctx.font = '600 12px Outfit, sans-serif';
            ctx.fillText('SCORE', 55, 112);
            ctx.fillStyle = '#ff33aa';
            ctx.font = '800 28px Outfit, sans-serif';
            ctx.fillText(`${score}`, 55, 148);

            // Stat Card 2: Best
            ctx.fillStyle = 'rgba(0, 240, 255, 0.1)';
            ctx.fillRect(195, 90, 140, 70);
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
            ctx.strokeRect(195, 90, 140, 70);
            ctx.fillStyle = '#d8c3df';
            ctx.font = '600 12px Outfit, sans-serif';
            ctx.fillText('BEST', 210, 112);
            ctx.fillStyle = '#00f0ff';
            ctx.font = '800 28px Outfit, sans-serif';
            ctx.fillText(`${highScore}`, 210, 148);

            // Next Item Preview Card
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(40, 180, 295, 100);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(40, 180, 295, 100);
            ctx.fillStyle = '#d8c3df';
            ctx.font = '600 12px Outfit, sans-serif';
            ctx.fillText('NEXT CELESTIAL ITEM', 55, 205);

            if (nextItemTier !== null && CELESTIAL_TIERS[nextItemTier]) {
                const nextItem = CELESTIAL_TIERS[nextItemTier];
                ctx.font = '36px sans-serif';
                ctx.fillText(nextItem.emoji, 60, 255);
                ctx.fillStyle = '#ffffff';
                ctx.font = '800 18px Outfit, sans-serif';
                ctx.fillText(nextItem.name, 120, 250);
            }

            // --- RIGHT PANEL: EVOLUTION CHAIN ---
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(860, 40, 300, 595);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(860, 40, 300, 595);

            ctx.fillStyle = '#ff33aa';
            ctx.font = '800 18px Outfit, sans-serif';
            ctx.fillText('EVOLUTION HIERARCHY', 880, 75);

            CELESTIAL_TIERS.forEach((item, idx) => {
                const yPos = 110 + idx * 85;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.fillRect(875, yPos, 270, 70);
                ctx.font = '28px sans-serif';
                ctx.fillText(item.emoji, 890, yPos + 46);
                ctx.fillStyle = '#ffffff';
                ctx.font = '600 16px Outfit, sans-serif';
                ctx.fillText(item.name, 940, yPos + 35);
                ctx.fillStyle = '#d8c3df';
                ctx.font = '12px Outfit, sans-serif';
                ctx.fillText(`+${item.score} Points`, 940, yPos + 54);
            });

            // Game Over Overlay
            if (isGameOver) {
                ctx.fillStyle = 'rgba(18, 3, 23, 0.88)';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                ctx.fillStyle = '#ff33aa';
                ctx.font = '800 48px Outfit, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
                ctx.fillStyle = '#ffffff';
                ctx.font = '24px sans-serif';
                ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
            }

            ctx.restore();
            animationFrameId = requestAnimationFrame(loop);
        }

        loop();
    }

    function stop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (engine) Matter.Engine.clear(engine);
    }

    window.QuantumGames = window.QuantumGames || {};
    window.QuantumGames['sukuna-game'] = {
        start,
        stop
    };
})();

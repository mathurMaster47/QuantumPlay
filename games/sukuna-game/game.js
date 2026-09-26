/**
 * Sukuna - Magical Physics Puzzle Game Module for QuantumPlay
 * Dynamic Screen Size Edition
 * Powered by Matter.js Physics Engine
 */

(function () {
    let engine, world;
    let animationFrameId = null;

    const CELESTIAL_TIERS = [
        { tier: 0, name: "Star Gem", baseRadius: 18, color: "#ffe066", emoji: "⭐", score: 2 },
        { tier: 1, name: "Moon Shard", baseRadius: 25, color: "#80e5ff", emoji: "🌙", score: 4 },
        { tier: 2, name: "Sun Drop", baseRadius: 32, color: "#ff8c1a", emoji: "☀️", score: 8 },
        { tier: 3, name: "Galaxy Petal", baseRadius: 40, color: "#ff66cc", emoji: "🌸", score: 16 },
        { tier: 4, name: "Nebula Pearl", baseRadius: 48, color: "#b366ff", emoji: "🔮", score: 32 },
        { tier: 5, name: "Comet Ring", baseRadius: 57, color: "#33ffff", emoji: "🪐", score: 64 },
    ];

    // Dynamic dimensions based on canvas size
    let CANVAS_WIDTH, CANVAS_HEIGHT;
    let CONTAINER_LEFT, CONTAINER_RIGHT, CONTAINER_WIDTH;
    let DROP_Y, LIMIT_Y;
    
    // Scaling factors for responsive design
    let scaleX, scaleY;

    // Game timing constants
    const GAME_OVER_BUFFER_MS = 1500;
    const DROP_COOLDOWN_MS = 500;

    let score = 0;
    let highScore = 0;
    let currentItemTier = null;
    let nextItemTier = null;
    let previewBody = null;
    let canDrop = true;
    let isGameOver = false;
    let pointerX;
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

    function initDynamicDimensions(canvas) {
        // Set canvas dimensions
        CANVAS_WIDTH = canvas.width;
        CANVAS_HEIGHT = canvas.height;
        
        // Calculate scaling factors based on original 1200x675 design
        scaleX = CANVAS_WIDTH / 1200;
        scaleY = CANVAS_HEIGHT / 675;
        
        // Calculate container dimensions (maintain aspect ratio of original design)
        CONTAINER_WIDTH = Math.round(440 * scaleX); // Original was 440px
        CONTAINER_LEFT = Math.round((CANVAS_WIDTH - CONTAINER_WIDTH) / 2);
        CONTAINER_RIGHT = CONTAINER_LEFT + CONTAINER_WIDTH;
        
        // Calculate Y positions
        DROP_Y = Math.round(55 * scaleY);
        LIMIT_Y = Math.round(115 * scaleY);
        
        // Initialize pointer position
        pointerX = CANVAS_WIDTH / 2;
    }

    function getScaledRadius(baseRadius) {
        // Use the average of scaleX and scaleY for radius scaling
        const avgScale = (scaleX + scaleY) / 2;
        return Math.round(baseRadius * avgScale);
    }

    function start(canvas, ctx, getInput, onGameOver) {
        initAudioContext();
        if (typeof Matter === 'undefined') {
            console.error('Matter.js is required for Sukuna Game.');
            return;
        }

        // Initialize dynamic dimensions based on actual canvas size
        initDynamicDimensions(canvas);

        const { Engine, Bodies, Composite, Events, Body } = Matter;

        score = 0;
        isGameOver = false;
        canDrop = true;
        mergeParticles = [];
        bodiesAboveLimit.clear();
        lastBtnAState = false;

        engine = Engine.create({ gravity: { y: 0.98, scale: 0.001 } });
        world = engine.world;

        // Static Boundaries around centered container
        const wallOptions = { isStatic: true, friction: 0.2, render: { visible: false } };
        const leftWall = Bodies.rectangle(CONTAINER_LEFT - (10 * scaleX), CANVAS_HEIGHT / 2, (20 * scaleX), CANVAS_HEIGHT, wallOptions);
        const rightWall = Bodies.rectangle(CONTAINER_RIGHT + (10 * scaleX), CANVAS_HEIGHT / 2, (20 * scaleX), CANVAS_HEIGHT, wallOptions);
        const floor = Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT - (25 * scaleY), CONTAINER_WIDTH + (20 * scaleX), (30 * scaleY), wallOptions);
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
            const r = getScaledRadius(item.baseRadius);
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
            const circle = Bodies.circle(x, y, getScaledRadius(item.baseRadius), {
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
            const r = getScaledRadius(CELESTIAL_TIERS[currentItemTier].baseRadius);
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
            ctx.fillRect(CONTAINER_LEFT, 0, CONTAINER_WIDTH, CANVAS_HEIGHT - Math.round(40 * scaleY));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 4;
            ctx.strokeRect(CONTAINER_LEFT, 0, CONTAINER_WIDTH, CANVAS_HEIGHT - Math.round(40 * scaleY));

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
                ctx.lineTo(pointerX, CANVAS_HEIGHT - Math.round(40 * scaleY));
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
                    const scaledRadius = getScaledRadius(item.baseRadius);

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(body.position.x, body.position.y, scaledRadius - 2, 0, Math.PI * 2);
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = 3;
                    ctx.shadowColor = item.color;
                    ctx.shadowBlur = isPreview ? 8 : 16;
                    ctx.stroke();
                    ctx.restore();

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(body.position.x, body.position.y, scaledRadius, 0, Math.PI * 2);
                    ctx.fillStyle = item.color;
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.font = `bold ${scaledRadius * 0.95}px sans-serif`;
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
            ctx.font = `800 ${Math.round(32 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('SUKUNA PUZZLE', Math.round(40 * scaleX), Math.round(60 * scaleY));

            // Stat Card 1: Score
            ctx.fillStyle = 'rgba(255, 51, 170, 0.1)';
            ctx.fillRect(Math.round(40 * scaleX), Math.round(90 * scaleY), Math.round(140 * scaleX), Math.round(70 * scaleY));
            ctx.strokeStyle = 'rgba(255, 51, 170, 0.3)';
            ctx.strokeRect(Math.round(40 * scaleX), Math.round(90 * scaleY), Math.round(140 * scaleX), Math.round(70 * scaleY));
            ctx.fillStyle = '#d8c3df';
            ctx.font = `600 ${Math.round(12 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('SCORE', Math.round(55 * scaleX), Math.round(112 * scaleY));
            ctx.fillStyle = '#ff33aa';
            ctx.font = `800 ${Math.round(28 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText(`${score}`, Math.round(55 * scaleX), Math.round(148 * scaleY));

            // Stat Card 2: Best
            ctx.fillStyle = 'rgba(0, 240, 255, 0.1)';
            ctx.fillRect(Math.round(195 * scaleX), Math.round(90 * scaleY), Math.round(140 * scaleX), Math.round(70 * scaleY));
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
            ctx.strokeRect(Math.round(195 * scaleX), Math.round(90 * scaleY), Math.round(140 * scaleX), Math.round(70 * scaleY));
            ctx.fillStyle = '#d8c3df';
            ctx.font = `600 ${Math.round(12 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('BEST', Math.round(210 * scaleX), Math.round(112 * scaleY));
            ctx.fillStyle = '#00f0ff';
            ctx.font = `800 ${Math.round(28 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText(`${highScore}`, Math.round(210 * scaleX), Math.round(148 * scaleY));

            // Next Item Preview Card
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(Math.round(40 * scaleX), Math.round(180 * scaleY), Math.round(295 * scaleX), Math.round(100 * scaleY));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(Math.round(40 * scaleX), Math.round(180 * scaleY), Math.round(295 * scaleX), Math.round(100 * scaleY));
            ctx.fillStyle = '#d8c3df';
            ctx.font = `600 ${Math.round(12 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('NEXT CELESTIAL ITEM', Math.round(55 * scaleX), Math.round(205 * scaleY));

            if (nextItemTier !== null && CELESTIAL_TIERS[nextItemTier]) {
                const nextItem = CELESTIAL_TIERS[nextItemTier];
                ctx.font = `${Math.round(36 * scaleX)}px sans-serif`;
                ctx.fillText(nextItem.emoji, Math.round(60 * scaleX), Math.round(255 * scaleY));
                ctx.fillStyle = '#ffffff';
                ctx.font = `800 ${Math.round(18 * scaleX)}px Outfit, sans-serif`;
                ctx.fillText(nextItem.name, Math.round(120 * scaleX), Math.round(250 * scaleY));
            }

            // --- RIGHT PANEL: EVOLUTION CHAIN ---
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(Math.round(860 * scaleX), Math.round(40 * scaleY), Math.round(300 * scaleX), Math.round(595 * scaleY));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(Math.round(860 * scaleX), Math.round(40 * scaleY), Math.round(300 * scaleX), Math.round(595 * scaleY));

            ctx.fillStyle = '#ff33aa';
            ctx.font = `800 ${Math.round(18 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('EVOLUTION HIERARCHY', Math.round(880 * scaleX), Math.round(75 * scaleY));

            CELESTIAL_TIERS.forEach((item, idx) => {
                const yPos = Math.round(110 * scaleY) + idx * Math.round(85 * scaleY);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.fillRect(Math.round(875 * scaleX), yPos, Math.round(270 * scaleX), Math.round(70 * scaleY));
                ctx.font = `${Math.round(28 * scaleX)}px sans-serif`;
                ctx.fillText(item.emoji, Math.round(890 * scaleX), yPos + Math.round(46 * scaleY));
                ctx.fillStyle = '#ffffff';
                ctx.font = `600 ${Math.round(16 * scaleX)}px Outfit, sans-serif`;
                ctx.fillText(item.name, Math.round(940 * scaleX), yPos + Math.round(35 * scaleY));
                ctx.fillStyle = '#d8c3df';
                ctx.font = `${Math.round(12 * scaleX)}px Outfit, sans-serif`;
                ctx.fillText(`+${item.score} Points`, Math.round(940 * scaleX), yPos + Math.round(54 * scaleY));
            });

            // Game Over — trigger overlay, stop loop
            if (isGameOver) {
                ctx.fillStyle = 'rgba(18, 3, 23, 0.75)';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                ctx.restore();
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
                if (typeof onGameOver === 'function') {
                    onGameOver({
                        title: 'Game Over',
                        score: `Final Score: ${score}`,
                        icon: '💫'
                    });
                }
                return;
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

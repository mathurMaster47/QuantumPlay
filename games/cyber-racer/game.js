/**
 * Cyber Turbo Racer Game Module for QuantumPlay
 * Widescreen (1200x675) Laptop Display Edition
 */

(function () {
    let animationFrameId = null;

    function start(canvas, ctx, getInput, onGameOver) {
        const ROAD_LEFT = 350;
        const ROAD_RIGHT = 850;
        const ROAD_WIDTH = ROAD_RIGHT - ROAD_LEFT;

        let player = {
            x: canvas.width / 2,
            y: canvas.height - 110,
            w: 48,
            h: 76,
            speed: 8
        };

        let obstacles = [];
        let particles = [];
        let roadOffset = 0;
        let score = 0;
        let speedMultiplier = 1.0;
        let isNitro = false;
        let isGameOver = false;
        let frame = 0;

        // Web Audio Synthesizer
        let audioCtx = null;
        function playSound(type) {
            if (!audioCtx) {
                const AudioClass = window.AudioContext || window.webkitAudioContext;
                if (AudioClass) audioCtx = new AudioClass();
            }
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            if (!audioCtx) return;

            try {
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);

                if (type === 'nitro') {
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(150, now);
                    osc.frequency.linearRampToValueAtTime(450, now + 0.3);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
                    osc.start(now);
                    osc.stop(now + 0.3);
                } else if (type === 'crash') {
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(100, now);
                    osc.frequency.linearRampToValueAtTime(30, now + 0.5);
                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                    osc.start(now);
                    osc.stop(now + 0.5);
                }
            } catch (e) {}
        }

        function createExhaustParticles(x, y, isNitroActive) {
            const count = isNitroActive ? 6 : 2;
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: x + (Math.random() - 0.5) * 18,
                    y: y,
                    vx: (Math.random() - 0.5) * 2,
                    vy: Math.random() * 5 + 5,
                    radius: isNitroActive ? Math.random() * 7 + 4 : Math.random() * 3 + 1,
                    color: isNitroActive ? (Math.random() > 0.5 ? '#f43f5e' : '#fbbf24') : '#38bdf8',
                    alpha: 1.0,
                    decay: 0.05
                });
            }
        }

        function spawnObstacle() {
            const lanes = [ROAD_LEFT + 70, ROAD_LEFT + ROAD_WIDTH / 2, ROAD_RIGHT - 70];
            const laneX = lanes[Math.floor(Math.random() * lanes.length)];
            const colors = ['#06b6d4', '#eab308', '#ec4899', '#10b981'];

            obstacles.push({
                x: laneX,
                y: -90,
                w: 44,
                h: 72,
                speed: Math.random() * 3 + 4,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }

        function loop() {
            frame++;
            const input = getInput();

            // Clear Background
            ctx.fillStyle = '#090514';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (!isGameOver) {
                isNitro = input && input.btnA;
                speedMultiplier = isNitro ? 2.2 : 1.0;

                if (isNitro && frame % 5 === 0) playSound('nitro');

                // Read Horizontal Analog Joystick Input (-1.0 to 1.0)
                if (input && Math.abs(input.x) > 0.05) {
                    player.x += input.x * player.speed * 1.3;
                } else if (input && input.left) {
                    player.x -= player.speed;
                } else if (input && input.right) {
                    player.x += player.speed;
                }

                // Clamp Player to Road Boundaries
                const minX = ROAD_LEFT + player.w / 2;
                const maxX = ROAD_RIGHT - player.w / 2;
                player.x = Math.max(minX, Math.min(maxX, player.x));

                // Scroll Road Markings
                roadOffset = (roadOffset + 9 * speedMultiplier) % 40;

                // Spawn Traffic Cars
                const spawnInterval = isNitro ? 22 : 40;
                if (frame % spawnInterval === 0) {
                    spawnObstacle();
                }

                score += Math.round(1 * speedMultiplier);
            }

            // --- DRAW ROAD & NEON GRID ---
            // Road Surface
            ctx.fillStyle = '#121124';
            ctx.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, canvas.height);

            // Outer Neon Road Barriers
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 5;
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.moveTo(ROAD_LEFT, 0);
            ctx.lineTo(ROAD_LEFT, canvas.height);
            ctx.moveTo(ROAD_RIGHT, 0);
            ctx.lineTo(ROAD_RIGHT, canvas.height);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Dashed Center Lanes
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 3;
            ctx.setLineDash([20, 20]);
            ctx.lineDashOffset = -roadOffset;
            ctx.beginPath();
            ctx.moveTo(ROAD_LEFT + ROAD_WIDTH / 3, 0);
            ctx.lineTo(ROAD_LEFT + ROAD_WIDTH / 3, canvas.height);
            ctx.moveTo(ROAD_LEFT + (ROAD_WIDTH * 2) / 3, 0);
            ctx.lineTo(ROAD_LEFT + (ROAD_WIDTH * 2) / 3, canvas.height);
            ctx.stroke();
            ctx.setLineDash([]);

            // --- UPDATE & DRAW PARTICLES ---
            if (!isGameOver) {
                createExhaustParticles(player.x, player.y + player.h / 2, isNitro);
            }

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= p.decay;

                if (p.alpha <= 0) {
                    particles.splice(i, 1);
                    continue;
                }

                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // --- UPDATE & DRAW TRAFFIC OBSTACLES ---
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const obs = obstacles[i];
                if (!isGameOver) {
                    obs.y += obs.speed * speedMultiplier;
                }

                // Draw Traffic Car
                ctx.save();
                ctx.fillStyle = obs.color;
                ctx.shadowColor = obs.color;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.roundRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h, 8);
                ctx.fill();

                // Headlights
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(obs.x - obs.w / 2 + 4, obs.y + obs.h / 2 - 6, 8, 4);
                ctx.fillRect(obs.x + obs.w / 2 - 12, obs.y + obs.h / 2 - 6, 8, 4);
                ctx.restore();

                // Collision Detection (AABB)
                if (!isGameOver) {
                    const px = player.x - player.w / 2;
                    const py = player.y - player.h / 2;
                    const ox = obs.x - obs.w / 2;
                    const oy = obs.y - obs.h / 2;

                    if (px < ox + obs.w && px + player.w > ox && py < oy + obs.h && py + player.h > oy) {
                        isGameOver = true;
                        playSound('crash');
                    }
                }

                if (obs.y > canvas.height + 100) {
                    obstacles.splice(i, 1);
                }
            }

            // --- DRAW PLAYER CAR ---
            if (!isGameOver) {
                ctx.save();
                ctx.fillStyle = '#f43f5e';
                ctx.shadowColor = isNitro ? '#fbbf24' : '#f43f5e';
                ctx.shadowBlur = isNitro ? 22 : 12;

                // Main body
                ctx.beginPath();
                ctx.roundRect(player.x - player.w / 2, player.y - player.h / 2, player.w, player.h, 10);
                ctx.fill();

                // Windshield
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.roundRect(player.x - player.w / 2 + 6, player.y - player.h / 2 + 15, player.w - 12, 18, 4);
                ctx.fill();

                // Taillights
                ctx.fillStyle = isNitro ? '#fbbf24' : '#ef4444';
                ctx.fillRect(player.x - player.w / 2 + 4, player.y + player.h / 2 - 6, 10, 4);
                ctx.fillRect(player.x + player.w / 2 - 14, player.y + player.h / 2 - 6, 10, 4);
                ctx.restore();
            }

            // --- LEFT SIDE PANEL: DASHBOARD GAUGES ---
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(40, 40, 270, 595);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(40, 40, 270, 595);

            ctx.fillStyle = '#f43f5e';
            ctx.font = '800 24px Outfit, sans-serif';
            ctx.fillText('CYBER RACER', 60, 80);

            // Speedometer gauge
            const speedKmh = Math.round(180 * speedMultiplier);
            ctx.fillStyle = '#ffffff';
            ctx.font = '800 48px Outfit, sans-serif';
            ctx.fillText(`${speedKmh}`, 60, 150);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '600 14px Outfit, sans-serif';
            ctx.fillText('KM / H', 160, 150);

            // Nitro Gauge
            ctx.fillStyle = '#d8c3df';
            ctx.font = '600 14px Outfit, sans-serif';
            ctx.fillText('NITRO BOOST', 60, 210);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(60, 225, 230, 20);
            ctx.fillStyle = isNitro ? '#fbbf24' : '#f43f5e';
            ctx.fillRect(60, 225, isNitro ? 230 : 150, 20);

            // --- RIGHT SIDE PANEL: SCORE & MULTIPLIERS ---
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(890, 40, 270, 595);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(890, 40, 270, 595);

            ctx.fillStyle = '#ffffff';
            ctx.font = '600 14px Outfit, sans-serif';
            ctx.fillText('CURRENT SCORE', 910, 80);
            ctx.fillStyle = '#fbbf24';
            ctx.font = '800 40px Outfit, sans-serif';
            ctx.fillText(`${score}`, 910, 130);

            if (isGameOver) {
                ctx.fillStyle = 'rgba(9, 5, 20, 0.75)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
                if (typeof onGameOver === 'function') {
                    onGameOver({
                        title: 'CRASHED!',
                        score: `Final Distance: ${score}m`,
                        icon: '🚗'
                    });
                }
                return;
            }

            animationFrameId = requestAnimationFrame(loop);
        }


        loop();
    }

    function stop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    window.QuantumGames = window.QuantumGames || {};
    window.QuantumGames['cyber-racer'] = {
        start,
        stop
    };
})();

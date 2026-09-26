/**
 * Cyber Turbo Racer Game Module for QuantumPlay
 * Dynamic Screen Size Edition
 */

(function () {
    let animationFrameId = null;

    function start(canvas, ctx, getInput, onGameOver) {
        // Dynamic dimensions based on canvas size
        const scaleX = canvas.width / 1200;
        const scaleY = canvas.height / 675;
        
        const ROAD_LEFT = Math.round(350 * scaleX);
        const ROAD_RIGHT = Math.round(850 * scaleX);
        const ROAD_WIDTH = ROAD_RIGHT - ROAD_LEFT;

        let player = {
            x: canvas.width / 2,
            y: canvas.height - Math.round(110 * scaleY),
            w: Math.round(48 * scaleX),
            h: Math.round(76 * scaleY),
            speed: Math.round(8 * scaleX)
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
                    x: x + (Math.random() - 0.5) * Math.round(18 * scaleX),
                    y: y,
                    vx: (Math.random() - 0.5) * 2,
                    vy: Math.random() * 5 + 5,
                    radius: isNitroActive ? Math.random() * Math.round(7 * scaleX) + Math.round(4 * scaleX) : Math.random() * Math.round(3 * scaleX) + Math.round(1 * scaleX),
                    color: isNitroActive ? (Math.random() > 0.5 ? '#f43f5e' : '#fbbf24') : '#38bdf8',
                    alpha: 1.0,
                    decay: 0.05
                });
            }
        }

        function spawnObstacle() {
            const lanes = [ROAD_LEFT + Math.round(70 * scaleX), ROAD_LEFT + ROAD_WIDTH / 2, ROAD_RIGHT - Math.round(70 * scaleX)];
            const laneX = lanes[Math.floor(Math.random() * lanes.length)];
            const colors = ['#06b6d4', '#eab308', '#ec4899', '#10b981'];

            obstacles.push({
                x: laneX,
                y: -Math.round(90 * scaleY),
                w: Math.round(44 * scaleX),
                h: Math.round(72 * scaleY),
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
                roadOffset = (roadOffset + Math.round(9 * scaleY) * speedMultiplier) % Math.round(40 * scaleY);

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
            ctx.lineWidth = Math.round(5 * scaleX);
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = Math.round(14 * scaleX);
            ctx.beginPath();
            ctx.moveTo(ROAD_LEFT, 0);
            ctx.lineTo(ROAD_LEFT, canvas.height);
            ctx.moveTo(ROAD_RIGHT, 0);
            ctx.lineTo(ROAD_RIGHT, canvas.height);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Dashed Center Lanes
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = Math.round(3 * scaleX);
            ctx.setLineDash([Math.round(20 * scaleY), Math.round(20 * scaleY)]);
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
                ctx.shadowBlur = Math.round(10 * scaleX);
                ctx.beginPath();
                ctx.roundRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h, Math.round(8 * scaleX));
                ctx.fill();

                // Headlights
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(obs.x - obs.w / 2 + Math.round(4 * scaleX), obs.y + obs.h / 2 - Math.round(6 * scaleY), Math.round(8 * scaleX), Math.round(4 * scaleY));
                ctx.fillRect(obs.x + obs.w / 2 - Math.round(12 * scaleX), obs.y + obs.h / 2 - Math.round(6 * scaleY), Math.round(8 * scaleX), Math.round(4 * scaleY));
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

                if (obs.y > canvas.height + Math.round(100 * scaleY)) {
                    obstacles.splice(i, 1);
                }
            }

            // --- DRAW PLAYER CAR ---
            if (!isGameOver) {
                ctx.save();
                ctx.fillStyle = '#f43f5e';
                ctx.shadowColor = isNitro ? '#fbbf24' : '#f43f5e';
                ctx.shadowBlur = isNitro ? Math.round(22 * scaleX) : Math.round(12 * scaleX);

                // Main body
                ctx.beginPath();
                ctx.roundRect(player.x - player.w / 2, player.y - player.h / 2, player.w, player.h, Math.round(10 * scaleX));
                ctx.fill();

                // Windshield
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.roundRect(player.x - player.w / 2 + Math.round(6 * scaleX), player.y - player.h / 2 + Math.round(15 * scaleY), player.w - Math.round(12 * scaleX), Math.round(18 * scaleY), Math.round(4 * scaleX));
                ctx.fill();

                // Taillights
                ctx.fillStyle = isNitro ? '#fbbf24' : '#ef4444';
                ctx.fillRect(player.x - player.w / 2 + Math.round(4 * scaleX), player.y + player.h / 2 - Math.round(6 * scaleY), Math.round(10 * scaleX), Math.round(4 * scaleY));
                ctx.fillRect(player.x + player.w / 2 - Math.round(14 * scaleX), player.y + player.h / 2 - Math.round(6 * scaleY), Math.round(10 * scaleX), Math.round(4 * scaleY));
                ctx.restore();
            }

            // --- LEFT SIDE PANEL: DASHBOARD GAUGES ---
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(Math.round(40 * scaleX), Math.round(40 * scaleY), Math.round(270 * scaleX), Math.round(595 * scaleY));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(Math.round(40 * scaleX), Math.round(40 * scaleY), Math.round(270 * scaleX), Math.round(595 * scaleY));

            ctx.fillStyle = '#f43f5e';
            ctx.font = `800 ${Math.round(24 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('CYBER RACER', Math.round(60 * scaleX), Math.round(80 * scaleY));

            // Speedometer gauge
            const speedKmh = Math.round(180 * speedMultiplier);
            ctx.fillStyle = '#ffffff';
            ctx.font = `800 ${Math.round(48 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText(`${speedKmh}`, Math.round(60 * scaleX), Math.round(150 * scaleY));
            ctx.fillStyle = '#94a3b8';
            ctx.font = `600 ${Math.round(14 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('KM / H', Math.round(160 * scaleX), Math.round(150 * scaleY));

            // Nitro Gauge
            ctx.fillStyle = '#d8c3df';
            ctx.font = `600 ${Math.round(14 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('NITRO BOOST', Math.round(60 * scaleX), Math.round(210 * scaleY));
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(Math.round(60 * scaleX), Math.round(225 * scaleY), Math.round(230 * scaleX), Math.round(20 * scaleY));
            ctx.fillStyle = isNitro ? '#fbbf24' : '#f43f5e';
            ctx.fillRect(Math.round(60 * scaleX), Math.round(225 * scaleY), isNitro ? Math.round(230 * scaleX) : Math.round(150 * scaleX), Math.round(20 * scaleY));

            // --- RIGHT SIDE PANEL: SCORE & MULTIPLIERS ---
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(Math.round(890 * scaleX), Math.round(40 * scaleY), Math.round(270 * scaleX), Math.round(595 * scaleY));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(Math.round(890 * scaleX), Math.round(40 * scaleY), Math.round(270 * scaleX), Math.round(595 * scaleY));

            ctx.fillStyle = '#ffffff';
            ctx.font = `600 ${Math.round(14 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('CURRENT SCORE', Math.round(910 * scaleX), Math.round(80 * scaleY));
            ctx.fillStyle = '#fbbf24';
            ctx.font = `800 ${Math.round(40 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText(`${score}`, Math.round(910 * scaleX), Math.round(130 * scaleY));

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

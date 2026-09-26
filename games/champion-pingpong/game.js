/**
 * Champion Island Table Tennis Game Module for QuantumPlay
 */

(function () {
    let animationFrameId = null;

    function start(canvas, ctx, getInput) {
        const TABLE_TOP_Y = 140;
        const TABLE_BOTTOM_Y = 560;
        const TABLE_LEFT_TOP = 100;
        const TABLE_RIGHT_TOP = canvas.width - 100;
        const TABLE_LEFT_BOTTOM = 40;
        const TABLE_RIGHT_BOTTOM = canvas.width - 40;
        const NET_Y = (TABLE_TOP_Y + TABLE_BOTTOM_Y) / 2;

        let player = { x: canvas.width / 2, y: TABLE_BOTTOM_Y + 40, radius: 30, speed: 8 };
        let opponent = { x: canvas.width / 2, y: TABLE_TOP_Y - 20, radius: 24, speed: 4.5 };
        let ball = {
            x: canvas.width / 2,
            y: TABLE_TOP_Y + 50,
            z: 0,
            vx: 3,
            vy: 5,
            vz: 0,
            radius: 10,
            state: 'TOP_TO_BOTTOM' // 'TOP_TO_BOTTOM' or 'BOTTOM_TO_TOP'
        };

        let playerScore = 0;
        let opponentScore = 0;
        let rallyCount = 0;
        let isSmashActive = false;
        let particles = [];
        let isGameOver = false;

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

                if (type === 'hit') {
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
                    osc.start(now);
                    osc.stop(now + 0.1);
                } else if (type === 'smash') {
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(800, now);
                    osc.frequency.exponentialRampToValueAtTime(200, now + 0.25);
                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
                    osc.start(now);
                    osc.stop(now + 0.25);
                } else if (type === 'point') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523, now);
                    osc.frequency.setValueAtTime(659, now + 0.1);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
                    osc.start(now);
                    osc.stop(now + 0.25);
                }
            } catch (e) {}
        }

        function createSmashParticles(x, y) {
            for (let i = 0; i < 15; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 6 + 3;
                particles.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    radius: Math.random() * 4 + 2,
                    color: Math.random() > 0.5 ? '#f43f5e' : '#fbbf24',
                    alpha: 1.0,
                    decay: 0.04
                });
            }
        }

        function resetBall(servingToPlayer) {
            ball.x = canvas.width / 2;
            ball.y = servingToPlayer ? TABLE_TOP_Y + 40 : TABLE_BOTTOM_Y - 40;
            ball.vx = (Math.random() - 0.5) * 4;
            ball.vy = servingToPlayer ? 5 : -5;
            ball.z = 0;
            ball.state = servingToPlayer ? 'TOP_TO_BOTTOM' : 'BOTTOM_TO_TOP';
            rallyCount = 0;
        }

        function loop() {
            const input = getInput();

            // Clear Canvas
            ctx.fillStyle = '#061a14';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // --- DRAW 2.5D TABLE TENNIS COURT ---
            // Outer Floor
            ctx.fillStyle = '#042f2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Table Surface (Perspective Polygon)
            ctx.fillStyle = '#047857';
            ctx.beginPath();
            ctx.moveTo(TABLE_LEFT_TOP, TABLE_TOP_Y);
            ctx.lineTo(TABLE_RIGHT_TOP, TABLE_TOP_Y);
            ctx.lineTo(TABLE_RIGHT_BOTTOM, TABLE_BOTTOM_Y);
            ctx.lineTo(TABLE_LEFT_BOTTOM, TABLE_BOTTOM_Y);
            ctx.closePath();
            ctx.fill();

            // Table White Border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Center Line
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, TABLE_TOP_Y);
            ctx.lineTo(canvas.width / 2, TABLE_BOTTOM_Y);
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Net Line
            ctx.beginPath();
            ctx.moveTo(TABLE_LEFT_TOP - 15, NET_Y);
            ctx.lineTo(TABLE_RIGHT_TOP + 15, NET_Y);
            ctx.strokeStyle = '#a7f3d0';
            ctx.lineWidth = 6;
            ctx.shadowColor = '#34d399';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;

            if (!isGameOver) {
                // --- PLAYER PADDLE MOVEMENT ---
                if (input && Math.abs(input.x) > 0.05) {
                    player.x += input.x * player.speed * 1.3;
                } else if (input && input.left) {
                    player.x -= player.speed;
                } else if (input && input.right) {
                    player.x += player.speed;
                }

                // Clamp player paddle position
                player.x = Math.max(TABLE_LEFT_BOTTOM + 20, Math.min(TABLE_RIGHT_BOTTOM - 20, player.x));

                // Read Smash Action Button State
                isSmashActive = input && input.btnA;

                // --- OPPONENT AI PADDLE MOVEMENT ---
                let targetX = ball.x;
                if (opponent.x < targetX - 10) opponent.x += opponent.speed;
                else if (opponent.x > targetX + 10) opponent.x -= opponent.speed;
                opponent.x = Math.max(TABLE_LEFT_TOP + 20, Math.min(TABLE_RIGHT_TOP - 20, opponent.x));

                // --- BALL PHYSICS & TRAJECTORY ---
                ball.x += ball.vx;
                ball.y += ball.vy;

                // Ball Bouncing Arc height
                ball.z = Math.sin((ball.y - TABLE_TOP_Y) / (TABLE_BOTTOM_Y - TABLE_TOP_Y) * Math.PI) * 45;

                // Collision with Player Paddle
                if (
                    ball.state === 'TOP_TO_BOTTOM' &&
                    ball.y >= TABLE_BOTTOM_Y - 30 &&
                    ball.y <= TABLE_BOTTOM_Y + 30 &&
                    Math.abs(ball.x - player.x) < player.radius + 15
                ) {
                    ball.state = 'BOTTOM_TO_TOP';
                    const hitOffset = (ball.x - player.x) / player.radius;
                    ball.vx = hitOffset * 6;

                    if (isSmashActive) {
                        ball.vy = -11; // High-speed smash!
                        playSound('smash');
                        createSmashParticles(ball.x, ball.y);
                    } else {
                        ball.vy = -6.5;
                        playSound('hit');
                    }
                    rallyCount++;
                }

                // Collision with Opponent Paddle
                if (
                    ball.state === 'BOTTOM_TO_TOP' &&
                    ball.y <= TABLE_TOP_Y + 20 &&
                    Math.abs(ball.x - opponent.x) < opponent.radius + 15
                ) {
                    ball.state = 'TOP_TO_BOTTOM';
                    ball.vx = (ball.x - opponent.x) * 0.2;
                    ball.vy = 6.5;
                    playSound('hit');
                    rallyCount++;
                }

                // Scoring Check (Ball missed or out of bounds)
                if (ball.y > TABLE_BOTTOM_Y + 70) {
                    opponentScore++;
                    playSound('point');
                    resetBall(true);
                } else if (ball.y < TABLE_TOP_Y - 50) {
                    playerScore++;
                    playSound('point');
                    resetBall(false);
                }

                if (playerScore >= 10 || opponentScore >= 10) {
                    isGameOver = true;
                }
            }

            // --- DRAW BALL SHADOW & BALL ---
            // Shadow on table
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(ball.x, ball.y, ball.radius * 0.8, ball.radius * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Elevated Ball
            const renderY = ball.y - ball.z;
            ctx.save();
            ctx.fillStyle = isSmashActive && ball.state === 'BOTTOM_TO_TOP' ? '#f43f5e' : '#ffffff';
            ctx.shadowColor = isSmashActive && ball.state === 'BOTTOM_TO_TOP' ? '#f43f5e' : '#34d399';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(ball.x, renderY, ball.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // --- DRAW OPPONENT PADDLE ---
            ctx.save();
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(opponent.x, opponent.y, opponent.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // --- DRAW PLAYER PADDLE ---
            ctx.save();
            ctx.fillStyle = isSmashActive ? '#f43f5e' : '#10b981';
            ctx.shadowColor = isSmashActive ? '#f43f5e' : '#10b981';
            ctx.shadowBlur = isSmashActive ? 20 : 10;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();

            // --- DRAW PARTICLES ---
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

            // --- DRAW SCOREBOARD HUD ---
            ctx.fillStyle = '#34d399';
            ctx.font = 'bold 24px Outfit, sans-serif';
            ctx.fillText(`PLAYER: ${playerScore}`, 20, 40);
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(`KAPPA: ${opponentScore}`, canvas.width - 150, 40);

            if (rallyCount > 0) {
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 16px Outfit, sans-serif';
                ctx.fillText(`RALLY: ${rallyCount}`, canvas.width / 2 - 35, 40);
            }

            if (isGameOver) {
                ctx.fillStyle = 'rgba(6, 26, 20, 0.88)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = playerScore >= 10 ? '#34d399' : '#f43f5e';
                ctx.font = 'bold 36px Outfit, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(playerScore >= 10 ? 'YOU WIN!' : 'KAPPA WINS!', canvas.width / 2, canvas.height / 2 - 20);
                ctx.fillStyle = '#ffffff';
                ctx.font = '20px sans-serif';
                ctx.fillText(`Final Score: ${playerScore} - ${opponentScore}`, canvas.width / 2, canvas.height / 2 + 25);
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
    window.QuantumGames['champion-pingpong'] = {
        start,
        stop
    };
})();

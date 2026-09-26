/**
 * Laser Defender Game Module
 */

(function () {
    let animationFrameId = null;

    function start(canvas, ctx, getInput) {
        let player = { x: canvas.width / 2 - 20, y: canvas.height - 60, w: 40, h: 30, speed: 6 };
        let bullets = [];
        let enemies = [];
        let score = 0;
        let frame = 0;
        let lastShot = 0;

        function loop() {
            const input = getInput();
            frame++;

            ctx.fillStyle = '#0b0914';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // --- CONTROLLER INPUT ---
            if (input.left && player.x > 0) player.x -= player.speed;
            if (input.right && player.x < canvas.width - player.w) player.x += player.speed;
            if (input.up && player.y > 100) player.y -= player.speed;
            if (input.down && player.y < canvas.height - player.h) player.y += player.speed;

            // Shoot lasers with Action Button A
            if (input.btnA && frame - lastShot > 10) {
                bullets.push({
                    x: player.x + player.w / 2 - 2,
                    y: player.y,
                    w: 4,
                    h: 14,
                    speed: 9
                });
                lastShot = frame;
            }

            // --- SPAWN ENEMIES ---
            if (frame % 45 === 0) {
                enemies.push({
                    x: Math.random() * (canvas.width - 30),
                    y: -30,
                    w: 30,
                    h: 25,
                    speed: 2 + Math.random() * 2
                });
            }

            // --- DRAW PLAYER ---
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#c084fc';
            ctx.fillStyle = '#a855f7';
            ctx.beginPath();
            ctx.moveTo(player.x + player.w / 2, player.y);
            ctx.lineTo(player.x + player.w, player.y + player.h);
            ctx.lineTo(player.x, player.y + player.h);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;

            // --- UPDATE & DRAW BULLETS ---
            for (let i = bullets.length - 1; i >= 0; i--) {
                let b = bullets[i];
                b.y -= b.speed;
                ctx.fillStyle = '#f0abfc';
                ctx.fillRect(b.x, b.y, b.w, b.h);

                if (b.y < -10) bullets.splice(i, 1);
            }

            // --- UPDATE & DRAW ENEMIES ---
            for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
                let e = enemies[eIdx];
                e.y += e.speed;

                ctx.fillStyle = '#f43f5e';
                ctx.fillRect(e.x, e.y, e.w, e.h);

                // Bullet Collision
                for (let bIdx = bullets.length - 1; bIdx >= 0; bIdx--) {
                    let b = bullets[bIdx];
                    if (
                        b.x < e.x + e.w &&
                        b.x + b.w > e.x &&
                        b.y < e.y + e.h &&
                        b.y + b.h > e.y
                    ) {
                        enemies.splice(eIdx, 1);
                        bullets.splice(bIdx, 1);
                        score += 20;
                        break;
                    }
                }

                if (e.y > canvas.height) {
                    enemies.splice(eIdx, 1);
                }
            }

            // --- DRAW SCORE & CONTROLS HINT ---
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px Segoe UI';
            ctx.fillText(`Score: ${score}`, 20, 35);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px Segoe UI';
            ctx.fillText(`Press [A] to Shoot`, canvas.width - 150, 35);

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
    window.QuantumGames['laser-defender'] = {
        start,
        stop
    };
})();

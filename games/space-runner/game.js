/**
 * Space Neo-Runner Game Module
 */

(function () {
    let animationFrameId = null;

    function start(canvas, ctx, getInput) {
        let player = { x: 380, y: 400, w: 40, h: 40, speed: 6, color: '#6366f1' };
        let obstacles = [];
        let score = 0;
        let frame = 0;

        function loop() {
            const input = getInput();
            frame++;

            ctx.fillStyle = '#090d16';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // --- CONTROLLER INPUT ---
            if (input.left && player.x > 0) player.x -= player.speed;
            if (input.right && player.x < canvas.width - player.w) player.x += player.speed;
            if (input.up && player.y > 0) player.y -= player.speed;
            if (input.down && player.y < canvas.height - player.h) player.y += player.speed;

            // Speed boost when pressing Action A
            player.speed = input.btnA ? 10 : 6;

            // --- SPAWN OBSTACLES ---
            if (frame % 30 === 0) {
                obstacles.push({
                    x: Math.random() * (canvas.width - 30),
                    y: -30,
                    w: 30 + Math.random() * 20,
                    h: 30,
                    speed: 3 + Math.random() * 4
                });
            }

            // --- DRAW PLAYER ---
            ctx.shadowBlur = 15;
            ctx.shadowColor = player.color;
            ctx.fillStyle = player.color;
            ctx.beginPath();
            ctx.moveTo(player.x + player.w / 2, player.y);
            ctx.lineTo(player.x + player.w, player.y + player.h);
            ctx.lineTo(player.x, player.y + player.h);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;

            // --- UPDATE & DRAW OBSTACLES ---
            for (let i = obstacles.length - 1; i >= 0; i--) {
                let obs = obstacles[i];
                obs.y += obs.speed;

                ctx.fillStyle = '#f43f5e';
                ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

                // AABB Collision Detection
                if (
                    player.x < obs.x + obs.w &&
                    player.x + player.w > obs.x &&
                    player.y < obs.y + obs.h &&
                    player.y + player.h > obs.y
                ) {
                    score = 0; // Reset Score on Collision
                }

                // Remove off-screen obstacles
                if (obs.y > canvas.height) {
                    obstacles.splice(i, 1);
                    score += 10;
                }
            }

            // --- DRAW SCORE ---
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px Segoe UI';
            ctx.fillText(`Score: ${score}`, 20, 35);

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
    window.QuantumGames['space-runner'] = {
        start,
        stop
    };
})();

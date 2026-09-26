/**
 * Cyber Pong 2099 Game Module
 */

(function () {
    let animationFrameId = null;

    function start(canvas, ctx, getInput) {
        let paddleWidth = 12, paddleHeight = 90;
        let playerY = canvas.height / 2 - paddleHeight / 2;
        let aiY = canvas.height / 2 - paddleHeight / 2;
        let ball = { x: canvas.width / 2, y: canvas.height / 2, vx: 5, vy: 3, radius: 8 };
        let playerScore = 0, aiScore = 0;

        function loop() {
            const input = getInput();

            ctx.fillStyle = '#060911';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // --- CONTROLLER INPUT ---
            if (input.up && playerY > 0) playerY -= 7;
            if (input.down && playerY < canvas.height - paddleHeight) playerY += 7;

            // --- SIMPLE AI PADDLE ---
            let aiCenter = aiY + paddleHeight / 2;
            if (aiCenter < ball.y - 15 && aiY < canvas.height - paddleHeight) aiY += 4.5;
            else if (aiCenter > ball.y + 15 && aiY > 0) aiY -= 4.5;

            // --- BALL PHYSICS ---
            ball.x += ball.vx;
            ball.y += ball.vy;

            // Top / Bottom Bouncing
            if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= canvas.height) {
                ball.vy *= -1;
            }

            // Player Paddle Collision
            if (
                ball.x - ball.radius <= 30 + paddleWidth &&
                ball.y >= playerY &&
                ball.y <= playerY + paddleHeight
            ) {
                ball.vx = Math.abs(ball.vx) + 0.3; // Speed up
                ball.x = 30 + paddleWidth + ball.radius;
            }

            // AI Paddle Collision
            if (
                ball.x + ball.radius >= canvas.width - 30 - paddleWidth &&
                ball.y >= aiY &&
                ball.y <= aiY + paddleHeight
            ) {
                ball.vx = -Math.abs(ball.vx) - 0.3;
                ball.x = canvas.width - 30 - paddleWidth - ball.radius;
            }

            // Scoring
            if (ball.x < 0) {
                aiScore++;
                resetBall();
            } else if (ball.x > canvas.width) {
                playerScore++;
                resetBall();
            }

            function resetBall() {
                ball.x = canvas.width / 2;
                ball.y = canvas.height / 2;
                ball.vx = (Math.random() > 0.5 ? 1 : -1) * 5;
                ball.vy = (Math.random() > 0.5 ? 1 : -1) * 3;
            }

            // --- RENDER GAME ---
            // Dashed Net
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, 0);
            ctx.lineTo(canvas.width / 2, canvas.height);
            ctx.stroke();
            ctx.setLineDash([]);

            // Player Paddle
            ctx.fillStyle = '#10b981';
            ctx.fillRect(30, playerY, paddleWidth, paddleHeight);

            // AI Paddle
            ctx.fillStyle = '#f43f5e';
            ctx.fillRect(canvas.width - 30 - paddleWidth, aiY, paddleWidth, paddleHeight);

            // Ball
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();

            // Scores
            ctx.font = 'bold 32px Segoe UI';
            ctx.fillStyle = '#10b981';
            ctx.fillText(playerScore, canvas.width / 2 - 60, 50);
            ctx.fillStyle = '#f43f5e';
            ctx.fillText(aiScore, canvas.width / 2 + 40, 50);

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
    window.QuantumGames['cyber-pong'] = {
        start,
        stop
    };
})();

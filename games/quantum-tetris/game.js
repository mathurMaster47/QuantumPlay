/**
 * Neon Cyber Tetris Game Module for QuantumPlay
 * Dynamic Screen Size Edition
 */

(function () {
    let animationFrameId = null;

    function start(canvas, ctx, getInput, onGameOver) {
        // Dynamic dimensions based on canvas size
        const scaleX = canvas.width / 1200;
        const scaleY = canvas.height / 675;
        
        const COLS = 10;
        const ROWS = 20;
        const BLOCK_SIZE = Math.round(28 * Math.min(scaleX, scaleY));
        const BOARD_WIDTH = COLS * BLOCK_SIZE;
        const BOARD_HEIGHT = ROWS * BLOCK_SIZE;
        const OFFSET_X = (canvas.width - BOARD_WIDTH) / 2;
        const OFFSET_Y = (canvas.height - BOARD_HEIGHT) / 2;

        const TETROMINOS = {
            I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#00f0ff' },
            J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: '#3b82f6' },
            L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: '#f97316' },
            O: { shape: [[1,1],[1,1]], color: '#eab308' },
            S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: '#10b981' },
            T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: '#a855f7' },
            Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: '#ef4444' }
        };

        const KEYS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

        let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
        let score = 0;
        let lines = 0;
        let level = 1;
        let isGameOver = false;

        let piece = null;
        let nextPiece = null;
        let dropCounter = 0;
        let dropInterval = 1000;
        let lastTime = 0;

        let lastBtnAState = false;
        let lastBtnBState = false;
        let moveCooldown = 0;

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

                if (type === 'rotate') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(300, now);
                    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
                    osc.start(now);
                    osc.stop(now + 0.08);
                } else if (type === 'drop') {
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(180, now);
                    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
                    osc.start(now);
                    osc.stop(now + 0.12);
                } else if (type === 'clear') {
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(523, now);
                    osc.frequency.setValueAtTime(783, now + 0.1);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
                    osc.start(now);
                    osc.stop(now + 0.3);
                }
            } catch (e) {}
        }

        function createPiece() {
            const key = KEYS[Math.floor(Math.random() * KEYS.length)];
            const t = TETROMINOS[key];
            return {
                shape: t.shape.map(row => [...row]),
                color: t.color,
                x: Math.floor(COLS / 2) - Math.ceil(t.shape[0].length / 2),
                y: 0
            };
        }

        function reset() {
            grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
            score = 0;
            lines = 0;
            level = 1;
            dropInterval = 1000;
            isGameOver = false;
            nextPiece = createPiece();
            spawnNextPiece();
        }

        function spawnNextPiece() {
            piece = nextPiece;
            nextPiece = createPiece();
            if (collide(grid, piece)) {
                isGameOver = true;
            }
        }

        function collide(board, p) {
            for (let r = 0; r < p.shape.length; r++) {
                for (let c = 0; c < p.shape[r].length; c++) {
                    if (p.shape[r][c] !== 0) {
                        const newR = p.y + r;
                        const newC = p.x + c;
                        if (newC < 0 || newC >= COLS || newR >= ROWS) return true;
                        if (newR >= 0 && board[newR][newC] !== 0) return true;
                    }
                }
            }
            return false;
        }

        function rotate(matrix) {
            const N = matrix.length;
            const result = Array.from({ length: N }, () => Array(N).fill(0));
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    result[c][N - 1 - r] = matrix[r][c];
                }
            }
            return result;
        }

        function rotatePiece() {
            const originalShape = piece.shape;
            piece.shape = rotate(piece.shape);
            if (collide(grid, piece)) {
                piece.x += 1;
                if (collide(grid, piece)) {
                    piece.x -= 2;
                    if (collide(grid, piece)) {
                        piece.x += 1;
                        piece.shape = originalShape;
                        return;
                    }
                }
            }
            playSound('rotate');
        }

        function mergePiece() {
            for (let r = 0; r < piece.shape.length; r++) {
                for (let c = 0; c < piece.shape[r].length; c++) {
                    if (piece.shape[r][c] !== 0 && piece.y + r >= 0) {
                        grid[piece.y + r][piece.x + c] = piece.color;
                    }
                }
            }
            clearLines();
            spawnNextPiece();
        }

        function clearLines() {
            let cleared = 0;
            for (let r = ROWS - 1; r >= 0; r--) {
                if (grid[r].every(cell => cell !== 0)) {
                    grid.splice(r, 1);
                    grid.unshift(Array(COLS).fill(0));
                    cleared++;
                    r++;
                }
            }
            if (cleared > 0) {
                playSound('clear');
                lines += cleared;
                score += [0, 100, 300, 500, 800][cleared] * level;
                level = Math.floor(lines / 10) + 1;
                dropInterval = Math.max(100, 1000 - (level - 1) * 80);
            }
        }

        function hardDrop() {
            while (!collide(grid, piece)) {
                piece.y++;
            }
            piece.y--;
            playSound('drop');
            mergePiece();
        }

        function getGhostY() {
            let ghostY = piece.y;
            while (!collide(grid, { ...piece, y: ghostY })) {
                ghostY++;
            }
            return ghostY - 1;
        }

        reset();

        function loop(time = 0) {
            const deltaTime = time - lastTime;
            lastTime = time;

            if (!isGameOver) {
                dropCounter += deltaTime;
                const input = getInput();

                moveCooldown -= deltaTime;
                if (moveCooldown <= 0 && input) {
                    if (input.x < -0.3 || input.left) {
                        piece.x--;
                        if (collide(grid, piece)) piece.x++;
                        moveCooldown = 120;
                    } else if (input.x > 0.3 || input.right) {
                        piece.x++;
                        if (collide(grid, piece)) piece.x--;
                        moveCooldown = 120;
                    }
                }

                if (input && (input.y > 0.4 || input.down)) {
                    dropCounter += deltaTime * 8;
                }

                if (input && input.btnA && !lastBtnAState) {
                    rotatePiece();
                }
                lastBtnAState = input ? input.btnA : false;

                if (input && input.btnB && !lastBtnBState) {
                    hardDrop();
                }
                lastBtnBState = input ? input.btnB : false;

                if (dropCounter > dropInterval) {
                    piece.y++;
                    if (collide(grid, piece)) {
                        piece.y--;
                        mergePiece();
                    }
                    dropCounter = 0;
                }
            }

            // --- CANVAS DRAWING ---
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw Board Container
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(OFFSET_X, OFFSET_Y, BOARD_WIDTH, BOARD_HEIGHT);
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 3;
            ctx.strokeRect(OFFSET_X, OFFSET_Y, BOARD_WIDTH, BOARD_HEIGHT);

            // Draw Static Grid Blocks
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (grid[r][c] !== 0) {
                        ctx.fillStyle = grid[r][c];
                        ctx.fillRect(OFFSET_X + c * BLOCK_SIZE + 1, OFFSET_Y + r * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
                    }
                }
            }

            // Draw Ghost Piece Projection
            if (piece && !isGameOver) {
                const ghostY = getGhostY();
                ctx.save();
                ctx.strokeStyle = piece.color;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 3]);
                for (let r = 0; r < piece.shape.length; r++) {
                    for (let c = 0; c < piece.shape[r].length; c++) {
                        if (piece.shape[r][c] !== 0) {
                            ctx.strokeRect(
                                OFFSET_X + (piece.x + c) * BLOCK_SIZE + 2,
                                OFFSET_Y + (ghostY + r) * BLOCK_SIZE + 2,
                                BLOCK_SIZE - 4,
                                BLOCK_SIZE - 4
                            );
                        }
                    }
                }
                ctx.restore();
            }

            // Draw Active Piece
            if (piece && !isGameOver) {
                ctx.save();
                ctx.fillStyle = piece.color;
                ctx.shadowColor = piece.color;
                ctx.shadowBlur = 10;
                for (let r = 0; r < piece.shape.length; r++) {
                    for (let c = 0; c < piece.shape[r].length; c++) {
                        if (piece.shape[r][c] !== 0) {
                            ctx.fillRect(
                                OFFSET_X + (piece.x + c) * BLOCK_SIZE + 1,
                                OFFSET_Y + (piece.y + r) * BLOCK_SIZE + 1,
                                BLOCK_SIZE - 2,
                                BLOCK_SIZE - 2
                            );
                        }
                    }
                }
                ctx.restore();
            }

            // --- LEFT PANEL: SCOREBOARDS ---
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(60, OFFSET_Y, 320, BOARD_HEIGHT);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(60, OFFSET_Y, 320, BOARD_HEIGHT);

            ctx.fillStyle = '#00f0ff';
            ctx.font = `800 ${Math.round(28 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('CYBER TETRIS', Math.round(90 * scaleX), OFFSET_Y + Math.round(45 * scaleY));

            ctx.fillStyle = '#ffffff';
            ctx.font = `600 ${Math.round(14 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('SCORE', Math.round(90 * scaleX), OFFSET_Y + Math.round(110 * scaleY));
            ctx.fillStyle = '#00f0ff';
            ctx.font = `800 ${Math.round(42 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText(`${score}`, Math.round(90 * scaleX), OFFSET_Y + Math.round(160 * scaleY));

            ctx.fillStyle = '#ffffff';
            ctx.font = `600 ${Math.round(14 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('LEVEL', Math.round(90 * scaleX), OFFSET_Y + Math.round(230 * scaleY));
            ctx.fillStyle = '#a855f7';
            ctx.font = `800 ${Math.round(36 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText(`${level}`, Math.round(90 * scaleX), OFFSET_Y + Math.round(275 * scaleY));

            ctx.fillStyle = '#ffffff';
            ctx.font = `600 ${Math.round(14 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('LINES CLEARED', Math.round(90 * scaleX), OFFSET_Y + Math.round(340 * scaleY));
            ctx.fillStyle = '#10b981';
            ctx.font = `800 ${Math.round(36 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText(`${lines}`, Math.round(90 * scaleX), OFFSET_Y + Math.round(385 * scaleY));

            // --- RIGHT PANEL: NEXT PIECE PREVIEW ---
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(Math.round(820 * scaleX), OFFSET_Y, Math.round(320 * scaleX), BOARD_HEIGHT);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(Math.round(820 * scaleX), OFFSET_Y, Math.round(320 * scaleX), BOARD_HEIGHT);

            ctx.fillStyle = '#ffffff';
            ctx.font = `600 ${Math.round(14 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('NEXT PIECE', Math.round(850 * scaleX), OFFSET_Y + Math.round(45 * scaleY));

            if (nextPiece) {
                ctx.save();
                ctx.fillStyle = nextPiece.color;
                ctx.shadowColor = nextPiece.color;
                ctx.shadowBlur = 10;
                for (let r = 0; r < nextPiece.shape.length; r++) {
                    for (let c = 0; c < nextPiece.shape[r].length; c++) {
                        if (nextPiece.shape[r][c] !== 0) {
                            ctx.fillRect(
                                890 + c * 24,
                                OFFSET_Y + 70 + r * 24,
                                22,
                                22
                            );
                        }
                    }
                }
                ctx.restore();
            }

            // Controls Hint
            ctx.fillStyle = '#94a3b8';
            ctx.font = `600 ${Math.round(14 * scaleX)}px Outfit, sans-serif`;
            ctx.fillText('CONTROLS:', Math.round(850 * scaleX), OFFSET_Y + Math.round(240 * scaleY));
            ctx.font = `${Math.round(13 * scaleX)}px sans-serif`;
            ctx.fillText('• Joystick Left / Right: Move', Math.round(850 * scaleX), OFFSET_Y + Math.round(270 * scaleY));
            ctx.fillText('• Joystick Down: Soft Drop', Math.round(850 * scaleX), OFFSET_Y + Math.round(295 * scaleY));
            ctx.fillText('• Button [ROTATE]: Flip Block', Math.round(850 * scaleX), OFFSET_Y + Math.round(320 * scaleY));
            ctx.fillText('• Button [DROP]: Hard Drop', Math.round(850 * scaleX), OFFSET_Y + Math.round(345 * scaleY));

            // Game Over — trigger overlay
            if (isGameOver) {
                ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
                if (typeof onGameOver === 'function') {
                    onGameOver({
                        title: 'Game Over',
                        score: `Score: ${score}  •  Lines: ${lines}  •  Level: ${level}`,
                        icon: '🟪'
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
    window.QuantumGames['quantum-tetris'] = {
        start,
        stop
    };
})();

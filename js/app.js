/**
 * QuantumPlay - Main Application Logic & View Router
 */

window.QuantumApp = (function () {
    let activeGameId = null;
    let gameStarted = false; // Track if game has been started by controller

    // DOM References
    let dashboardView, gameView, controllerView;
    let hostPeerStatus, gameControllerStatus, qrModal;
    let displayRoomId, currentGameTitle, canvas, ctx;
    let ctrlStatusDot, ctrlStatusText, ctrlGamepadInterface;
    let gameOverOverlay, gameOverTitle, gameOverScore, gameOverIcon;


    function init() {
        dashboardView = document.getElementById('dashboard-view');
        gameView = document.getElementById('game-view');
        controllerView = document.getElementById('controller-view');
        hostPeerStatus = document.getElementById('host-peer-status');
        gameControllerStatus = document.getElementById('game-controller-status');
        qrModal = document.getElementById('qr-modal');
        displayRoomId = document.getElementById('display-room-id');
        currentGameTitle = document.getElementById('current-game-title');
        canvas = document.getElementById('gameCanvas');
        if (canvas) ctx = canvas.getContext('2d');

        ctrlStatusDot = document.getElementById('ctrl-status-dot');
        ctrlStatusText = document.getElementById('ctrl-status-text');
        ctrlGamepadInterface = document.getElementById('ctrl-gamepad-interface');

        gameOverOverlay = document.getElementById('game-over-overlay');
        gameOverTitle = document.getElementById('game-over-title');
        gameOverScore = document.getElementById('game-over-score');
        gameOverIcon = document.getElementById('game-over-icon');


        // Check URL parameters for smartphone controller mode
        const urlParams = new URLSearchParams(window.location.search);
        const targetRoom = urlParams.get('room');

        if (targetRoom) {
            initControllerMode(targetRoom);
        } else {
            initHostMode();
        }
    }

    /**
     * Desktop / Laptop Host View Setup
     */
    function initHostMode() {
        dashboardView.classList.remove('hidden');

        // Load Game Library Grid
        window.QuantumGameLoader.loadLibrary('game-grid');

        // Show loading state
        if (hostPeerStatus) {
            hostPeerStatus.textContent = 'Initializing P2P...';
            if (hostPeerStatus.previousElementSibling) {
                hostPeerStatus.previousElementSibling.className = 'fa-solid fa-spinner fa-spin text-indigo-400 text-xs mr-2';
            }
        }

        // Initialize PeerJS Host Server
        window.QuantumWebRTC.initHostMode({
            onServerReady: (id) => {
                if (hostPeerStatus) {
                    hostPeerStatus.textContent = 'Server Ready';
                    hostPeerStatus.previousElementSibling.className = 'fa-solid fa-signal text-emerald-400 text-xs mr-2';
                }
                if (displayRoomId) displayRoomId.textContent = id;
                if (activeGameId) updateQRCode(id);
            },
            onClientConnected: () => {
                if (qrModal) qrModal.classList.add('hidden');
                if (gameControllerStatus) {
                    gameControllerStatus.innerHTML = '<i class="fa-solid fa-gamepad text-emerald-400"></i><span class="text-emerald-400">Phone Connected - Starting Game</span>';
                    gameControllerStatus.className = 'flex items-center space-x-2 text-sm bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20';
                }
                // Auto-start game when controller connects
                if (activeGameId && !gameStarted) {
                    console.log('Auto-starting game on controller connection');
                    setTimeout(() => startGame(), 500); // Small delay to ensure connection is stable
                }
            },
            onClientDisconnected: () => {
                if (qrModal) qrModal.classList.remove('hidden');
                if (gameControllerStatus) {
                    gameControllerStatus.innerHTML = '<i class="fa-solid fa-qrcode text-yellow-400"></i><span class="text-yellow-400">Awaiting Mobile Connection...</span>';
                    gameControllerStatus.className = 'flex items-center space-x-2 text-sm bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20';
                }
            },
            onError: (err) => {
                console.error('P2P initialization error:', err);
                if (hostPeerStatus) {
                    hostPeerStatus.textContent = 'P2P Failed - Retry';
                    hostPeerStatus.previousElementSibling.className = 'fa-solid fa-triangle-exclamation text-rose-500 text-xs mr-2';
                }
                alert('Failed to initialize P2P connection. Please check your internet connection and try clicking "Retry Connection".');
            }
        }, false); // Don't force reconnection on initial load
    }

    /**
     * Mobile Smartphone View Setup
     */
    function initControllerMode(targetRoom) {
        dashboardView.classList.add('hidden');
        gameView.classList.add('hidden');
        controllerView.classList.remove('hidden');
        controllerView.classList.add('flex');
        document.body.classList.add('no-scroll');

        window.QuantumController.initControllerUI();

        // Show loading state
        if (ctrlStatusText) ctrlStatusText.textContent = 'INITIALIZING P2P...';
        if (ctrlStatusDot) ctrlStatusDot.className = 'w-3 h-3 rounded-full bg-indigo-500 animate-pulse';

        window.QuantumWebRTC.initControllerMode(targetRoom, {
            onStatus: (statusMsg) => {
                if (ctrlStatusText) ctrlStatusText.textContent = statusMsg.toUpperCase();
            },
            onConnected: () => {
                if (ctrlStatusDot) ctrlStatusDot.className = 'w-3 h-3 rounded-full bg-emerald-500 animate-pulse';
                if (ctrlStatusText) {
                    ctrlStatusText.textContent = 'CONNECTED';
                    ctrlStatusText.className = 'text-xs font-semibold text-emerald-400 uppercase tracking-wider';
                }
                if (ctrlGamepadInterface) ctrlGamepadInterface.classList.remove('opacity-40', 'pointer-events-none');
                
                const manualBox = document.getElementById('manual-room-box');
                if (manualBox) manualBox.classList.add('hidden');
            },
            onDisconnected: () => {
                if (ctrlStatusDot) ctrlStatusDot.className = 'w-3 h-3 rounded-full bg-red-500';
                if (ctrlStatusText) {
                    ctrlStatusText.textContent = 'DISCONNECTED';
                    ctrlStatusText.className = 'text-xs font-semibold text-rose-500 uppercase tracking-wider';
                }
                if (ctrlGamepadInterface) ctrlGamepadInterface.classList.add('opacity-40', 'pointer-events-none');
            },
            onError: (err) => {
                console.error('Controller P2P error:', err);
                if (ctrlStatusDot) ctrlStatusDot.className = 'w-3 h-3 rounded-full bg-rose-500';
                if (ctrlStatusText) {
                    ctrlStatusText.textContent = 'P2P FAILED';
                    ctrlStatusText.className = 'text-xs font-semibold text-rose-500 uppercase tracking-wider';
                }
                const manualBox = document.getElementById('manual-room-box');
                if (manualBox) manualBox.classList.remove('hidden');
                alert('Failed to connect to P2P network. Please check your internet connection and try again.');
            }
        });
    }

    function updateQRCode(roomId) {
        if (!roomId) return;
        
        let controllerUrl;
        let origin = window.location.origin;

        if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.startsWith('file')) {
            controllerUrl = `https://mathurmaster47.github.io/QuantumPlay/?room=${roomId}`;
        } else {
            let path = window.location.pathname;
            if (!path.endsWith('/')) path += '/';
            controllerUrl = `${origin}${path}?room=${roomId}`;
        }

        if (displayRoomId) displayRoomId.textContent = roomId;

        // Generate QR code asynchronously to avoid blocking
        setTimeout(() => {
            const qrContainer = document.getElementById('qrcode');
            if (!qrContainer) return;

            if (typeof QRCode !== 'undefined') {
                try {
                    qrContainer.innerHTML = '';
                    new QRCode(qrContainer, {
                        text: controllerUrl,
                        width: 180,
                        height: 180,
                        colorDark: "#0f172a",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                } catch (err) {
                    console.error('Failed to generate QR code:', err);
                    // Fallback: show the URL text if QR generation fails
                    qrContainer.innerHTML = `<div class="text-xs text-gray-400 break-all p-2">${controllerUrl}</div>`;
                }
            } else {
                // QRCode library not loaded yet, show loading message
                qrContainer.innerHTML = '<div class="text-gray-400 text-sm">Loading QR library...</div>';
            }
        }, 100); // Small delay to ensure DOM is ready
    }

    /**
     * Retry Host PeerJS initialization on user request
     */
    function retryHostConnection() {
        if (hostPeerStatus) {
            hostPeerStatus.textContent = 'Connecting...';
            if (hostPeerStatus.previousElementSibling) {
                hostPeerStatus.previousElementSibling.className = 'fa-solid fa-spinner fa-spin text-indigo-400 text-xs mr-2';
            }
        }
        // Force reconnection when user explicitly requests it
        window.QuantumWebRTC.initHostMode({
            onServerReady: (id) => {
                if (hostPeerStatus) {
                    hostPeerStatus.textContent = 'Server Ready';
                    hostPeerStatus.previousElementSibling.className = 'fa-solid fa-signal text-emerald-400 text-xs mr-2';
                }
                if (displayRoomId) displayRoomId.textContent = id;
                if (activeGameId) updateQRCode(id);
            },
            onClientConnected: () => {
                if (qrModal) qrModal.classList.add('hidden');
                if (gameControllerStatus) {
                    gameControllerStatus.innerHTML = '<i class="fa-solid fa-gamepad text-emerald-400"></i><span class="text-emerald-400">Phone Connected - Starting Game</span>';
                    gameControllerStatus.className = 'flex items-center space-x-2 text-sm bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20';
                }
                // Auto-start game when controller connects
                if (activeGameId && !gameStarted) {
                    console.log('Auto-starting game on controller connection (retry)');
                    setTimeout(() => startGame(), 500);
                }
                // Send game controls immediately
                const meta = window.QuantumGameLoader.getGameMeta(activeGameId);
                if (meta) {
                    const controlConfig = (meta && meta.controls) ? meta.controls : {
                        joystickAxis: '2d',
                        buttons: [{ id: 'btnA', label: 'A', color: 'indigo' }, { id: 'btnB', label: 'B', color: 'rose' }]
                    };
                    window.QuantumWebRTC.sendControlConfig({
                        enableInterface: true,
                        ...controlConfig
                    });
                }
            },
            onClientDisconnected: () => {
                if (qrModal) qrModal.classList.remove('hidden');
                if (gameControllerStatus) {
                    gameControllerStatus.innerHTML = '<i class="fa-solid fa-qrcode text-yellow-400"></i><span class="text-yellow-400">Awaiting Mobile Connection...</span>';
                    gameControllerStatus.className = 'flex items-center space-x-2 text-sm bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20';
                }
            },
            onError: (err) => {
                console.error('P2P initialization error:', err);
                if (hostPeerStatus) {
                    hostPeerStatus.textContent = 'P2P Failed - Retry';
                    hostPeerStatus.previousElementSibling.className = 'fa-solid fa-triangle-exclamation text-rose-500 text-xs mr-2';
                }
                alert('Failed to initialize P2P connection. Please check your internet connection and try clicking "Retry Connection".');
            }
        }, true); // Force reconnection
    }

    /**
     * Show game-over overlay with customisable content
     */
    function showGameOver({ title = 'Game Over', score = '', icon = '💥' } = {}) {
        if (gameOverTitle) gameOverTitle.textContent = title;
        if (gameOverScore) gameOverScore.textContent = score;
        if (gameOverIcon) gameOverIcon.textContent = icon;
        if (gameOverOverlay) {
            gameOverOverlay.classList.remove('hidden');
            gameOverOverlay.classList.add('flex');
        }
    }

    function hideGameOver() {
        if (gameOverOverlay) {
            gameOverOverlay.classList.add('hidden');
            gameOverOverlay.classList.remove('flex');
        }
    }

    /**
     * Launch selected game (setup only, doesn't start gameplay)
     */
    async function launchGame(gameId, isControllerConnected = false) {
        activeGameId = gameId;
        gameStarted = false; // Reset game started state
        hideGameOver();
        dashboardView.classList.add('hidden');
        gameView.classList.remove('hidden');

        const roomId = window.QuantumWebRTC.getRoomId();
        if (roomId) {
            // Only update QR code if controller is not already connected
            if (!isControllerConnected) {
                // Show QR modal first, then generate QR code
                if (qrModal) qrModal.classList.remove('hidden');
                updateQRCode(roomId);
            } else {
                // If controller is connected, ensure QR modal is hidden and auto-start
                if (qrModal) qrModal.classList.add('hidden');
                if (gameControllerStatus) {
                    gameControllerStatus.innerHTML = '<i class="fa-solid fa-gamepad text-emerald-400"></i><span class="text-emerald-400">Phone Connected - Starting Game</span>';
                }
                // Auto-start game if controller is already connected
                if (!gameStarted) {
                    console.log('Auto-starting game (controller already connected)');
                    setTimeout(() => startGame(), 500);
                }
            }
        } else if (displayRoomId) {
            displayRoomId.textContent = 'Connecting to server...';
        }

        const meta = window.QuantumGameLoader.getGameMeta(gameId);
        if (currentGameTitle) currentGameTitle.textContent = meta ? meta.title : gameId;

        // Dynamic canvas: fill the wrapper element exactly
        const wrapper = document.getElementById('canvas-wrapper');
        if (wrapper) {
            // Give the DOM a frame to layout before measuring
            await new Promise(r => requestAnimationFrame(r));
            canvas.width = wrapper.clientWidth;
            canvas.height = wrapper.clientHeight;
        }

        // Don't start game immediately - wait for controller connection
        // Show waiting message on canvas
        if (ctx) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Connect controller to start game', canvas.width / 2, canvas.height / 2);
        }
        
        // Send actual game controls (not START button) immediately
        const meta = window.QuantumGameLoader.getGameMeta(activeGameId);
        const controlConfig = (meta && meta.controls) ? meta.controls : {
            joystickAxis: '2d',
            buttons: [{ id: 'btnA', label: 'A', color: 'indigo' }, { id: 'btnB', label: 'B', color: 'rose' }]
        };
        window.QuantumWebRTC.sendControlConfig({
            enableInterface: true,
            ...controlConfig
        });
    }

    /**
     * Actually start the game (called when controller connects)
     */
    async function startGame() {
        console.log('startGame() called, activeGameId:', activeGameId, 'gameStarted:', gameStarted);
        if (!activeGameId || gameStarted) return;
        
        gameStarted = true;

        // Send game controls before starting
        const meta = window.QuantumGameLoader.getGameMeta(activeGameId);
        const controlConfig = (meta && meta.controls) ? meta.controls : {
            joystickAxis: '2d',
            buttons: [{ id: 'btnA', label: 'A', color: 'indigo' }, { id: 'btnB', label: 'B', color: 'rose' }]
        };
        console.log('Sending game controls in startGame:', controlConfig);
        window.QuantumWebRTC.sendControlConfig({
            enableInterface: true,
            ...controlConfig
        });

        // Update status to show game is running
        if (gameControllerStatus) {
            gameControllerStatus.innerHTML = '<i class="fa-solid fa-gamepad text-emerald-400"></i><span class="text-emerald-400">Game Running</span>';
        }

        // Launch game instance — pass onGameOver so games can trigger the overlay
        try {
            await window.QuantumGameLoader.launchGame(
                activeGameId,
                canvas,
                ctx,
                () => window.QuantumWebRTC.getInput(),
                (result) => showGameOver(result)
            );
        } catch (err) {
            console.error(`Failed to start game ${activeGameId}:`, err);
            // Show error to user
            if (currentGameTitle) {
                currentGameTitle.textContent = 'Game Error - Try Again';
            }
        }
    }

    /**
     * Restart the currently active game
     */
    function restartGame() {
        if (activeGameId) {
            window.QuantumGameLoader.stopGame(activeGameId);
            hideGameOver();
            
            // Check if controller is already connected
            const isControllerConnected = gameControllerStatus && 
                (gameControllerStatus.innerHTML.includes('Phone Connected') || 
                 gameControllerStatus.innerHTML.includes('Game Running'));
            
            // Always ensure QR modal is properly handled during restart
            if (isControllerConnected) {
                if (qrModal) qrModal.classList.add('hidden');
                // Auto-start game on restart if controller is connected
                if (gameControllerStatus) {
                    gameControllerStatus.innerHTML = '<i class="fa-solid fa-gamepad text-emerald-400"></i><span class="text-emerald-400">Phone Connected - Restarting</span>';
                }
                // Send game controls for restart
                const meta = window.QuantumGameLoader.getGameMeta(activeGameId);
                const controlConfig = (meta && meta.controls) ? meta.controls : {
                    joystickAxis: '2d',
                    buttons: [{ id: 'btnA', label: 'A', color: 'indigo' }, { id: 'btnB', label: 'B', color: 'rose' }]
                };
                window.QuantumWebRTC.sendControlConfig({
                    enableInterface: true,
                    ...controlConfig
                });
                // Reset game started state and auto-start after short delay
                gameStarted = false;
                setTimeout(() => startGame(), 500);
            } else {
                if (qrModal) qrModal.classList.remove('hidden');
                gameStarted = false;
            }
            
            // Setup canvas with waiting message
            if (ctx) {
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 24px Outfit, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Connect controller to restart', canvas.width / 2, canvas.height / 2);
            }
        }
    }

    /**
     * Connect manually using Room Code from mobile phone screen
     */
    function joinRoomManually() {
        const inputEl = document.getElementById('manual-room-input');
        if (inputEl && inputEl.value.trim()) {
            const roomCode = inputEl.value.trim();
            initControllerMode(roomCode);
        }
    }

    /**
     * Exit active game and return to dashboard
     */
    function closeGame() {
        if (activeGameId) {
            window.QuantumGameLoader.stopGame(activeGameId);
            activeGameId = null;
        }
        gameView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
    }

    // Auto-initialize on DOM ready
    window.addEventListener('DOMContentLoaded', init);

    return {
        launchGame,
        closeGame,
        joinRoomManually,
        retryHostConnection,
        restartGame
    };

})();

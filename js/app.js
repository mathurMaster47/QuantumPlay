/**
 * QuantumPlay - Main Application Logic & View Router
 */

window.QuantumApp = (function () {
    let activeGameId = null;

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
                    gameControllerStatus.innerHTML = '<i class="fa-solid fa-gamepad text-emerald-400"></i><span class="text-emerald-400">Phone Connected</span>';
                    gameControllerStatus.className = 'flex items-center space-x-2 text-sm bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20';
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
                if (hostPeerStatus) {
                    hostPeerStatus.textContent = 'Connection Error';
                    hostPeerStatus.previousElementSibling.className = 'fa-solid fa-triangle-exclamation text-rose-500 text-xs mr-2';
                }
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
                if (ctrlStatusDot) ctrlStatusDot.className = 'w-3 h-3 rounded-full bg-rose-500';
                if (ctrlStatusText) {
                    ctrlStatusText.textContent = 'ERROR CONNECTING';
                    ctrlStatusText.className = 'text-xs font-semibold text-rose-500 uppercase tracking-wider';
                }
                const manualBox = document.getElementById('manual-room-box');
                if (manualBox) manualBox.classList.remove('hidden');
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

        // Only generate QR code if container exists and QRCode library is loaded
        const qrContainer = document.getElementById('qrcode');
        if (qrContainer && typeof QRCode !== 'undefined') {
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
        } else if (qrContainer) {
            // QRCode library not loaded yet, show loading message
            qrContainer.innerHTML = '<div class="text-gray-400 text-sm">Loading QR library...</div>';
        }
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
                    gameControllerStatus.innerHTML = '<i class="fa-solid fa-gamepad text-emerald-400"></i><span class="text-emerald-400">Phone Connected</span>';
                    gameControllerStatus.className = 'flex items-center space-x-2 text-sm bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20';
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
                if (hostPeerStatus) {
                    hostPeerStatus.textContent = 'Connection Error';
                    hostPeerStatus.previousElementSibling.className = 'fa-solid fa-triangle-exclamation text-rose-500 text-xs mr-2';
                }
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
     * Launch selected game
     */
    async function launchGame(gameId, isControllerConnected = false) {
        activeGameId = gameId;
        hideGameOver();
        dashboardView.classList.add('hidden');
        gameView.classList.remove('hidden');

        const roomId = window.QuantumWebRTC.getRoomId();
        if (roomId) {
            // Only update QR code if controller is not already connected
            if (!isControllerConnected) {
                updateQRCode(roomId);
            }
        } else if (displayRoomId) {
            displayRoomId.textContent = 'Connecting to server...';
        }

        const meta = window.QuantumGameLoader.getGameMeta(gameId);
        if (currentGameTitle) currentGameTitle.textContent = meta ? meta.title : gameId;

        // Broadcast active control configuration to mobile controller
        const controlConfig = (meta && meta.controls) ? meta.controls : {
            joystickAxis: '2d',
            buttons: [{ id: 'btnA', label: 'A', color: 'indigo' }, { id: 'btnB', label: 'B', color: 'rose' }]
        };
        window.QuantumWebRTC.sendControlConfig(controlConfig);

        // Dynamic canvas: fill the wrapper element exactly
        const wrapper = document.getElementById('canvas-wrapper');
        if (wrapper) {
            // Give the DOM a frame to layout before measuring
            await new Promise(r => requestAnimationFrame(r));
            canvas.width = wrapper.clientWidth;
            canvas.height = wrapper.clientHeight;
        }

        // Launch game instance — pass onGameOver so games can trigger the overlay
        try {
            await window.QuantumGameLoader.launchGame(
                gameId,
                canvas,
                ctx,
                () => window.QuantumWebRTC.getInput(),
                (result) => showGameOver(result)
            );
        } catch (err) {
            console.error(`Failed to launch game ${gameId}:`, err);
        }
    }

    /**
     * Restart the currently active game
     */
    function restartGame() {
        if (activeGameId) {
            window.QuantumGameLoader.stopGame(activeGameId);
            hideGameOver();
            
            // Check if controller is already connected to avoid reshown QR modal
            const isControllerConnected = gameControllerStatus && 
                gameControllerStatus.innerHTML.includes('Phone Connected');
            
            // If controller is connected, hide QR modal temporarily during restart
            if (isControllerConnected && qrModal) {
                qrModal.classList.add('hidden');
            }
            
            launchGame(activeGameId, isControllerConnected);
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

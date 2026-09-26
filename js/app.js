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
        const roomId = window.QuantumWebRTC.initHostMode({
            onServerReady: () => {
                if (hostPeerStatus) {
                    hostPeerStatus.textContent = 'Server Ready';
                    hostPeerStatus.previousElementSibling.className = 'fa-solid fa-signal text-emerald-400 text-xs mr-2';
                }
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
        });
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
            onConnected: () => {
                if (ctrlStatusDot) ctrlStatusDot.className = 'w-3 h-3 rounded-full bg-emerald-500 animate-pulse';
                if (ctrlStatusText) {
                    ctrlStatusText.textContent = 'CONNECTED';
                    ctrlStatusText.className = 'text-xs font-semibold text-emerald-400 uppercase tracking-wider';
                }
                if (ctrlGamepadInterface) ctrlGamepadInterface.classList.remove('opacity-40', 'pointer-events-none');
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
                if (ctrlStatusText) ctrlStatusText.textContent = 'ERROR CONNECTING';
            }
        });
    }

    /**
     * Launch selected game
     */
    async function launchGame(gameId) {
        activeGameId = gameId;
        dashboardView.classList.add('hidden');
        gameView.classList.remove('hidden');

        const roomId = window.QuantumWebRTC.getRoomId();
        const controllerUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

        // Render QR Code
        const qrContainer = document.getElementById('qrcode');
        if (qrContainer) {
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: controllerUrl,
                width: 180,
                height: 180,
                colorDark: "#0f172a",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }

        if (displayRoomId) displayRoomId.textContent = roomId;

        const meta = window.QuantumGameLoader.getGameMeta(gameId);
        if (currentGameTitle) currentGameTitle.textContent = meta ? meta.title : gameId;

        // Broadcast active control configuration to mobile controller
        const controlConfig = (meta && meta.controls) ? meta.controls : {
            joystickAxis: '2d',
            buttons: [{ id: 'btnA', label: 'A', color: 'indigo' }, { id: 'btnB', label: 'B', color: 'rose' }]
        };
        window.QuantumWebRTC.sendControlConfig(controlConfig);

        // Set Canvas Dimensions
        canvas.width = 450;
        canvas.height = 700;

        // Launch game instance
        try {
            await window.QuantumGameLoader.launchGame(
                gameId,
                canvas,
                ctx,
                () => window.QuantumWebRTC.getInput()
            );
        } catch (err) {
            console.error(`Failed to launch game ${gameId}:`, err);
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
        closeGame
    };
})();

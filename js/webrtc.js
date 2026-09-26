/**
 * QuantumPlay - Serverless WebRTC Controller Connection Manager
 * Powered by Trystero Multi-Tracker P2P Engine
 */

(function () {
    let trysteroModule = null;
    let room = null;
    let roomId = null;
    let activeControlConfig = null;
    let isHost = false;

    let sendInputFn = null;
    let sendConfigFn = null;

    const controllerInput = {
        x: 0,
        y: 0,
        up: false,
        down: false,
        left: false,
        right: false,
        btnA: false,
        btnB: false,
        btnStart: false
    };

    let onStartGameRequest = null;

    function generateRoomId() {
        return 'qp-' + Math.random().toString(36).substring(2, 8);
    }

    async function getTrystero() {
        if (!trysteroModule) {
            try {
                trysteroModule = await import('https://cdn.jsdelivr.net/npm/trystero@0.25.4/+esm');
            } catch (err) {
                console.warn('Primary Trystero CDN failed, trying backup...', err);
                try {
                    trysteroModule = await import('https://esm.sh/@trystero-p2p/nostr@0.25.4');
                } catch (err2) {
                    console.error('All Trystero WebRTC imports failed:', err2);
                    throw err2;
                }
            }
        }
        return trysteroModule;
    }

    /**
     * Helper to safely bind actions regardless of Trystero version:
     * In Trystero < 0.20: room.makeAction(name) returns [sendFn, getFn]
     * In Trystero >= 0.25: room.makeAction(name) returns { send, onMessage, ... }
     */
    function bindAction(roomInstance, name, onMessage) {
        let actionResult = null;
        try {
            actionResult = roomInstance.makeAction(name);
        } catch (e) {
            console.error(`makeAction("${name}") failed:`, e);
            return () => {};
        }

        // Trystero legacy [send, get]
        if (Array.isArray(actionResult)) {
            const [sendFn, getFn] = actionResult;
            if (typeof getFn === 'function' && onMessage) {
                getFn((data, peerId) => onMessage(data, peerId));
            }
            return (payload) => {
                try { sendFn(payload); } catch (e) {}
            };
        }

        // Trystero modern (0.25+): returns { send, onMessage, ... }
        if (actionResult && typeof actionResult === 'object') {
            if (onMessage) {
                actionResult.onMessage = (data, meta) => {
                    const peerId = meta && typeof meta === 'object' ? meta.peerId : meta;
                    onMessage(data, peerId);
                };
            }
            return (payload) => {
                if (typeof actionResult.send === 'function') {
                    actionResult.send(payload).catch(() => {});
                }
            };
        }

        return () => {};
    }

    /**
     * Helper to bind peer join & leave handlers regardless of Trystero version:
     * In Trystero < 0.20: room.onPeerJoin(fn) (function call)
     * In Trystero >= 0.25: room.onPeerJoin = fn (property setter)
     */
    function bindPeerEvents(roomInstance, onJoin, onLeave) {
        if (!roomInstance) return;

        // Peer Join
        if (typeof roomInstance.onPeerJoin === 'function') {
            roomInstance.onPeerJoin(onJoin);
        } else {
            roomInstance.onPeerJoin = onJoin;
        }

        // Peer Leave
        if (typeof roomInstance.onPeerLeave === 'function') {
            roomInstance.onPeerLeave(onLeave);
        } else {
            roomInstance.onPeerLeave = onLeave;
        }
    }

    /**
     * Initialize Host Mode (Desktop / Laptop)
     */
    async function initHostMode(callbacks, forceReconnect = false) {
        // Only recreate room if it doesn't exist or if explicitly requested
        if (!forceReconnect && room && roomId && isHost) {
            console.log('Reusing existing WebRTC room:', roomId);
            if (callbacks && callbacks.onServerReady) {
                callbacks.onServerReady(roomId);
            }
            return roomId;
        }

        if (room) {
            try { room.leave(); } catch (e) {}
            room = null;
        }

        isHost = true;
        roomId = generateRoomId();

        console.log('Initializing Serverless P2P Host Room:', roomId);

        try {
            const { joinRoom } = await getTrystero();
            room = joinRoom({ appId: 'quantumplay-arcade' }, roomId);

            // Bind actions
            sendConfigFn = bindAction(room, 'CONFIG', () => {});
            sendInputFn = bindAction(room, 'INPUT', (data) => {
                if (data) Object.assign(controllerInput, data);
                // Check for start game request from controller
                if (data.btnStart && onStartGameRequest) {
                    onStartGameRequest();
                }
            });

            // Bind peer connectivity
            bindPeerEvents(
                room,
                (peerId) => {
                    console.log('Mobile Controller P2P Peer Joined:', peerId);
                    if (activeControlConfig && sendConfigFn) {
                        try { sendConfigFn(activeControlConfig); } catch (e) {}
                    }
                    if (callbacks && callbacks.onClientConnected) {
                        callbacks.onClientConnected();
                    }
                },
                (peerId) => {
                    console.log('Mobile Controller P2P Peer Left:', peerId);
                    if (callbacks && callbacks.onClientDisconnected) {
                        callbacks.onClientDisconnected();
                    }
                }
            );

            if (callbacks && callbacks.onServerReady) {
                callbacks.onServerReady(roomId);
            }
        } catch (err) {
            console.error('Failed to create serverless WebRTC room:', err);
            if (callbacks && callbacks.onError) callbacks.onError(err);
        }

        return roomId;
    }

    /**
     * Initialize Controller Mode (Smartphone)
     */
    async function initControllerMode(targetRoom, callbacks) {
        if (!targetRoom) return;

        if (room) {
            try { room.leave(); } catch (e) {}
            room = null;
        }

        isHost = false;
        roomId = targetRoom;

        if (callbacks && callbacks.onStatus) {
            callbacks.onStatus(`Connecting to room ${targetRoom}...`);
        }

        console.log('Joining Serverless P2P Room:', targetRoom);

        try {
            const { joinRoom } = await getTrystero();
            room = joinRoom({ appId: 'quantumplay-arcade' }, targetRoom);

            // Bind actions
            sendConfigFn = bindAction(room, 'CONFIG', (data) => {
                if (data && window.QuantumController) {
                    window.QuantumController.applyControlConfig(data);
                }
            });
            sendInputFn = bindAction(room, 'INPUT', () => {});

            // Bind peer connectivity
            bindPeerEvents(
                room,
                (peerId) => {
                    console.log('Connected to Host Peer:', peerId);
                    if (callbacks && callbacks.onConnected) callbacks.onConnected();
                },
                (peerId) => {
                    console.log('Host Peer Left:', peerId);
                    if (callbacks && callbacks.onDisconnected) callbacks.onDisconnected();
                }
            );
        } catch (err) {
            console.error('Failed to join WebRTC room:', err);
            if (callbacks && callbacks.onError) callbacks.onError(err);
        }
    }

    function sendControlConfig(config) {
        activeControlConfig = config;
        if (sendConfigFn) {
            try { sendConfigFn(config); } catch (e) {}
        }
    }

    function sendInputState() {
        if (sendInputFn && !isHost) {
            try { sendInputFn(controllerInput); } catch (e) {}
        }
    }

    function getInput() {
        return controllerInput;
    }

    function getRoomId() {
        return roomId;
    }

    function setOnStartGameRequest(callback) {
        onStartGameRequest = callback;
    }

    window.QuantumWebRTC = {
        initHostMode,
        initControllerMode,
        sendInputState,
        sendControlConfig,
        getInput,
        getRoomId,
        setOnStartGameRequest,
        controllerInput
    };
})();

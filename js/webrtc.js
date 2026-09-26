/**
 * QuantumPlay - WebRTC & PeerJS Controller Connection Manager
 */

window.QuantumWebRTC = (function () {
    let peer = null;
    let hostConn = null;
    let roomId = null;
    let activeControlConfig = null;

    const controllerInput = {
        x: 0,
        y: 0,
        up: false,
        down: false,
        left: false,
        right: false,
        btnA: false,
        btnB: false
    };

    const peerOptions = {
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        },
        debug: 1
    };

    /**
     * Initialize Host Mode (Desktop/Laptop)
     */
    function initHostMode(callbacks) {
        if (peer && !peer.destroyed) {
            peer.destroy();
        }

        // Initialize PeerJS letting the server generate & register a clean unique peer ID
        peer = new Peer(peerOptions);

        peer.on('open', (id) => {
            roomId = id;
            if (callbacks.onServerReady) callbacks.onServerReady(id);
        });

        peer.on('connection', (conn) => {
            hostConn = conn;
            setupHostListeners(callbacks);
        });

        peer.on('disconnected', () => {
            console.warn('Host disconnected from PeerJS signaling server. Auto-reconnecting...');
            if (peer && !peer.destroyed) {
                peer.reconnect();
            }
        });

        peer.on('error', (err) => {
            console.error('PeerJS Host Error:', err);
            // Auto-recover on connection loss
            if (err.type === 'network' || err.type === 'disconnected' || err.type === 'socket-error') {
                if (peer && !peer.destroyed) {
                    setTimeout(() => peer.reconnect(), 1000);
                }
            } else if (callbacks.onError) {
                callbacks.onError(err);
            }
        });

        return roomId;
    }

    function setupHostListeners(callbacks) {
        hostConn.on('open', () => {
            if (activeControlConfig) {
                sendControlConfig(activeControlConfig);
            }
            if (callbacks.onClientConnected) callbacks.onClientConnected();
        });

        hostConn.on('data', (data) => {
            if (data && data.type === 'INPUT') {
                Object.assign(controllerInput, data.payload);
            }
        });

        hostConn.on('close', () => {
            if (callbacks.onClientDisconnected) callbacks.onClientDisconnected();
        });

        hostConn.on('error', (err) => {
            console.error('Host connection error:', err);
            if (callbacks.onClientDisconnected) callbacks.onClientDisconnected();
        });
    }

    /**
     * Send game control rules from Host to Mobile Controller
     */
    function sendControlConfig(config) {
        activeControlConfig = config;
        if (hostConn && hostConn.open) {
            hostConn.send({
                type: 'CONFIG',
                payload: config
            });
        }
    }

    /**
     * Initialize Controller Mode (Smartphone) with Automatic Retry Logic
     */
    function initControllerMode(targetRoom, callbacks, attempt = 1) {
        if (!targetRoom) return;

        if (callbacks.onStatus) {
            callbacks.onStatus(`Connecting to room ${targetRoom}...`);
        }

        if (peer && !peer.destroyed) {
            peer.destroy();
        }

        peer = new Peer(peerOptions);

        peer.on('open', () => {
            hostConn = peer.connect(targetRoom, { reliable: true });

            hostConn.on('open', () => {
                if (callbacks.onConnected) callbacks.onConnected();
            });

            hostConn.on('data', (data) => {
                if (data && data.type === 'CONFIG') {
                    if (window.QuantumController) {
                        window.QuantumController.applyControlConfig(data.payload);
                    }
                }
            });

            hostConn.on('close', () => {
                if (callbacks.onDisconnected) callbacks.onDisconnected();
            });

            hostConn.on('error', (err) => {
                console.warn('Controller connection error:', err);
                if (attempt < 4) {
                    if (callbacks.onStatus) callbacks.onStatus(`Retrying connection (${attempt}/3)...`);
                    setTimeout(() => initControllerMode(targetRoom, callbacks, attempt + 1), 1500);
                } else if (callbacks.onError) {
                    callbacks.onError(err);
                }
            });
        });

        peer.on('disconnected', () => {
            if (peer && !peer.destroyed) {
                peer.reconnect();
            }
        });

        peer.on('error', (err) => {
            console.error(`PeerJS Controller Error (Attempt ${attempt}):`, err);

            if (attempt < 4) {
                if (callbacks.onStatus) callbacks.onStatus(`Retrying (${attempt}/3)...`);
                setTimeout(() => initControllerMode(targetRoom, callbacks, attempt + 1), 1500);
            } else if (callbacks.onError) {
                callbacks.onError(err);
            }
        });
    }

    /**
     * Transmit gamepad input state from phone to host
     */
    function sendInputState() {
        if (hostConn && hostConn.open) {
            hostConn.send({
                type: 'INPUT',
                payload: controllerInput
            });
        }
    }

    function getInput() {
        return controllerInput;
    }

    function getRoomId() {
        return roomId;
    }

    return {
        initHostMode,
        initControllerMode,
        sendInputState,
        sendControlConfig,
        getInput,
        getRoomId,
        controllerInput
    };
})();

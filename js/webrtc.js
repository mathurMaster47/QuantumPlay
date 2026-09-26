/**
 * QuantumPlay - WebRTC & PeerJS Controller Connection Manager
 */

window.QuantumWebRTC = (function () {
    let peer = null;
    let hostConn = null;
    let roomId = null;
    let activeControlConfig = null;

    let hasBeenOpened = false;
    let isReconnecting = false;
    let reconnectTimer = null;
    let hostAttempts = 0;
    const MAX_ATTEMPTS = 4;

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
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        pingInterval: 5000,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' }
            ]
        },
        debug: 1
    };

    /**
     * Initialize Host Mode (Desktop/Laptop)
     */
    function initHostMode(callbacks) {
        if (peer) {
            try { peer.destroy(); } catch (e) {}
            peer = null;
        }

        hasBeenOpened = false;
        isReconnecting = false;
        if (reconnectTimer) clearTimeout(reconnectTimer);

        try {
            peer = new Peer(peerOptions);
        } catch (err) {
            console.error('Failed to instantiate PeerJS:', err);
            if (callbacks.onError) callbacks.onError(err);
            return;
        }

        peer.on('open', (id) => {
            roomId = id;
            hasBeenOpened = true;
            hostAttempts = 0;
            isReconnecting = false;
            console.log('Host registered on PeerJS server with ID:', id);
            if (callbacks.onServerReady) callbacks.onServerReady(id);
        });

        peer.on('connection', (conn) => {
            console.log('New mobile controller connected:', conn.peer);
            hostConn = conn;
            setupHostListeners(callbacks);
        });

        peer.on('disconnected', () => {
            console.warn('Host disconnected from PeerJS signaling server.');
            // Guard against calling reconnect() if never opened or already reconnecting
            if (hasBeenOpened && peer && !peer.destroyed && !isReconnecting) {
                isReconnecting = true;
                reconnectTimer = setTimeout(() => {
                    isReconnecting = false;
                    if (peer && !peer.destroyed && peer.disconnected) {
                        try {
                            peer.reconnect();
                        } catch (e) {
                            console.warn('Host reconnect attempt failed:', e);
                        }
                    }
                }, 3000);
            }
        });

        peer.on('error', (err) => {
            console.error('PeerJS Host Error:', err);

            // If initial server registration failed before 'open', destroy and recreate
            if (!hasBeenOpened) {
                if (hostAttempts < MAX_ATTEMPTS) {
                    hostAttempts++;
                    console.log(`Initial host connection failed. Retrying creation in 3s (Attempt ${hostAttempts}/${MAX_ATTEMPTS})...`);
                    if (reconnectTimer) clearTimeout(reconnectTimer);
                    reconnectTimer = setTimeout(() => {
                        initHostMode(callbacks);
                    }, 3000);
                } else if (callbacks.onError) {
                    callbacks.onError(err);
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

        if (peer) {
            try { peer.destroy(); } catch (e) {}
            peer = null;
        }

        if (reconnectTimer) clearTimeout(reconnectTimer);

        let ctrlOpened = false;

        try {
            peer = new Peer(peerOptions);
        } catch (err) {
            console.error('Failed to create PeerJS for controller:', err);
            if (callbacks.onError) callbacks.onError(err);
            return;
        }

        peer.on('open', () => {
            ctrlOpened = true;
            try {
                hostConn = peer.connect(targetRoom, { reliable: true });
            } catch (e) {
                console.error('Peer connect error:', e);
            }

            if (!hostConn) return;

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
                if (attempt < MAX_ATTEMPTS) {
                    if (callbacks.onStatus) callbacks.onStatus(`Retrying connection (${attempt}/${MAX_ATTEMPTS-1})...`);
                    reconnectTimer = setTimeout(() => initControllerMode(targetRoom, callbacks, attempt + 1), 2500);
                } else if (callbacks.onError) {
                    callbacks.onError(err);
                }
            });
        });

        peer.on('disconnected', () => {
            console.warn('Controller disconnected from signaling server.');
            if (ctrlOpened && peer && !peer.destroyed && !isReconnecting) {
                isReconnecting = true;
                reconnectTimer = setTimeout(() => {
                    isReconnecting = false;
                    if (peer && !peer.destroyed && peer.disconnected) {
                        try { peer.reconnect(); } catch (e) {}
                    }
                }, 3000);
            }
        });

        peer.on('error', (err) => {
            console.error(`PeerJS Controller Error (Attempt ${attempt}):`, err);

            if (!ctrlOpened) {
                if (attempt < MAX_ATTEMPTS) {
                    if (callbacks.onStatus) callbacks.onStatus(`Retrying (${attempt}/${MAX_ATTEMPTS-1})...`);
                    reconnectTimer = setTimeout(() => initControllerMode(targetRoom, callbacks, attempt + 1), 2500);
                } else if (callbacks.onError) {
                    callbacks.onError(err);
                }
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

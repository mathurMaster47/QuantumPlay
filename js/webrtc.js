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

    /**
     * Initialize Host Mode (Desktop/Laptop)
     */
    function initHostMode(callbacks) {
        roomId = 'nexus-' + Math.random().toString(36).substring(2, 9);
        peer = new Peer(roomId);

        peer.on('open', (id) => {
            if (callbacks.onServerReady) callbacks.onServerReady(id);
        });

        peer.on('connection', (conn) => {
            hostConn = conn;
            setupHostListeners(callbacks);
        });

        peer.on('error', (err) => {
            console.error('PeerJS Host Error:', err);
            if (callbacks.onError) callbacks.onError(err);
        });

        return roomId;
    }

    function setupHostListeners(callbacks) {
        hostConn.on('open', () => {
            // Send current active game control configuration to newly connected controller
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
     * Initialize Controller Mode (Smartphone)
     */
    function initControllerMode(targetRoom, callbacks) {
        peer = new Peer();

        peer.on('open', () => {
            hostConn = peer.connect(targetRoom);

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
        });

        peer.on('error', (err) => {
            console.error('PeerJS Controller Error:', err);
            if (callbacks.onError) callbacks.onError(err);
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

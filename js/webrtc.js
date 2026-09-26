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
        btnB: false
    };

    function generateRoomId() {
        return 'qp-' + Math.random().toString(36).substring(2, 8);
    }

    async function getTrystero() {
        if (!trysteroModule) {
            try {
                trysteroModule = await import('https://cdn.jsdelivr.net/npm/trystero@0.25.4/+esm');
            } catch (err) {
                console.error('Failed to load Trystero WebRTC library:', err);
                throw err;
            }
        }
        return trysteroModule;
    }

    /**
     * Initialize Host Mode (Desktop / Laptop)
     */
    async function initHostMode(callbacks) {
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

            const [sendConfig, getConfig] = room.makeAction('CONFIG');
            const [sendInput, getInput] = room.makeAction('INPUT');

            sendConfigFn = sendConfig;
            sendInputFn = sendInput;

            getInput((data, peerId) => {
                if (data) Object.assign(controllerInput, data);
            });

            room.onPeerJoin((peerId) => {
                console.log('Mobile Controller P2P Peer Joined:', peerId);
                if (activeControlConfig && sendConfigFn) {
                    try { sendConfigFn(activeControlConfig); } catch (e) {}
                }
                if (callbacks.onClientConnected) callbacks.onClientConnected();
            });

            room.onPeerLeave((peerId) => {
                console.log('Mobile Controller P2P Peer Left:', peerId);
                if (callbacks.onClientDisconnected) callbacks.onClientDisconnected();
            });

            if (callbacks.onServerReady) {
                callbacks.onServerReady(roomId);
            }
        } catch (err) {
            console.error('Failed to create serverless WebRTC room:', err);
            if (callbacks.onError) callbacks.onError(err);
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

        if (callbacks.onStatus) {
            callbacks.onStatus(`Connecting to room ${targetRoom}...`);
        }

        console.log('Joining Serverless P2P Room:', targetRoom);

        try {
            const { joinRoom } = await getTrystero();
            room = joinRoom({ appId: 'quantumplay-arcade' }, targetRoom);

            const [sendConfig, getConfig] = room.makeAction('CONFIG');
            const [sendInput, getInput] = room.makeAction('INPUT');

            sendConfigFn = sendConfig;
            sendInputFn = sendInput;

            getConfig((data, peerId) => {
                if (data && window.QuantumController) {
                    window.QuantumController.applyControlConfig(data);
                }
            });

            room.onPeerJoin((peerId) => {
                console.log('Connected to Host Peer:', peerId);
                if (callbacks.onConnected) callbacks.onConnected();
            });

            room.onPeerLeave((peerId) => {
                console.log('Host Peer Left:', peerId);
                if (callbacks.onDisconnected) callbacks.onDisconnected();
            });
        } catch (err) {
            console.error('Failed to join WebRTC room:', err);
            if (callbacks.onError) callbacks.onError(err);
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

    window.QuantumWebRTC = {
        initHostMode,
        initControllerMode,
        sendInputState,
        sendControlConfig,
        getInput,
        getRoomId,
        controllerInput
    };
})();

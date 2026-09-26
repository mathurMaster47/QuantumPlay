/**
 * QuantumPlay - Mobile Gamepad Touch Input Handler
 */

window.QuantumController = (function () {
    function setupTouchListeners() {
        const buttons = [
            { id: 'btn-up', key: 'up' },
            { id: 'btn-down', key: 'down' },
            { id: 'btn-left', key: 'left' },
            { id: 'btn-right', key: 'right' },
            { id: 'btn-a', key: 'btnA' },
            { id: 'btn-b', key: 'btnB' }
        ];

        buttons.forEach(btnInfo => {
            const el = document.getElementById(btnInfo.id);
            if (!el) return;

            const handleStart = (e) => {
                e.preventDefault();
                window.QuantumWebRTC.controllerInput[btnInfo.key] = true;
                if (navigator.vibrate) navigator.vibrate(20);
                window.QuantumWebRTC.sendInputState();
            };

            const handleEnd = (e) => {
                e.preventDefault();
                window.QuantumWebRTC.controllerInput[btnInfo.key] = false;
                window.QuantumWebRTC.sendInputState();
            };

            el.addEventListener('touchstart', handleStart, { passive: false });
            el.addEventListener('touchend', handleEnd, { passive: false });
            el.addEventListener('mousedown', handleStart);
            el.addEventListener('mouseup', handleEnd);
        });
    }

    return {
        setupTouchListeners
    };
})();

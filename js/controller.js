/**
 * QuantumPlay - Mobile Dynamic Virtual Joystick & Action Controller
 */

window.QuantumController = (function () {
    let joystickBase = null;
    let joystickKnob = null;
    let activeTouchId = null;
    let currentConfig = {
        joystickAxis: '2d',
        buttons: [{ id: 'btnA', label: 'A', color: 'indigo' }, { id: 'btnB', label: 'B', color: 'rose' }]
    };

    function initControllerUI() {
        joystickBase = document.getElementById('joystick-base');
        joystickKnob = document.getElementById('joystick-knob');

        setupJoystickListeners();
    }

    /**
     * Update controller UI dynamically based on active game configuration
     */
    function applyControlConfig(config) {
        if (!config) return;
        currentConfig = config;

        // Enable interface if requested
        if (config.enableInterface && ctrlGamepadInterface) {
            ctrlGamepadInterface.classList.remove('opacity-40', 'pointer-events-none');
        }

        // 1. Configure Joystick Axis
        const joystickContainer = document.getElementById('joystick-container');
        const axisHint = document.getElementById('joystick-axis-hint');

        if (config.joystickAxis === 'none') {
            if (joystickContainer) joystickContainer.classList.add('hidden');
        } else {
            if (joystickContainer) joystickContainer.classList.remove('hidden');
            if (axisHint) {
                if (config.joystickAxis === 'horizontal') {
                    axisHint.innerHTML = '<i class="fa-solid fa-left-right text-indigo-400"></i><span class="ml-1 text-xs">LEFT / RIGHT</span>';
                } else if (config.joystickAxis === 'vertical') {
                    axisHint.innerHTML = '<i class="fa-solid fa-up-down text-indigo-400"></i><span class="ml-1 text-xs">UP / DOWN</span>';
                } else {
                    axisHint.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right text-indigo-400"></i><span class="ml-1 text-xs">ANALOG JOYSTICK</span>';
                }
            }
        }

        // 2. Configure Action Buttons
        const actionArea = document.getElementById('ctrl-action-area');
        if (actionArea) {
            actionArea.innerHTML = '';

            if (config.showStartButton) {
                // Show special START button for game launch
                const startButton = document.createElement('button');
                startButton.className = 'btn-action bg-emerald-600 border-emerald-400 text-white font-extrabold shadow-2xl border-2 text-lg active:scale-90 transition-all';
                startButton.textContent = 'START';
                
                // Add simple click handler for START button
                startButton.onclick = () => {
                    // Send start signal through WebRTC
                    window.QuantumWebRTC.controllerInput.btnStart = true;
                    window.QuantumWebRTC.sendInputState();
                    setTimeout(() => {
                        window.QuantumWebRTC.controllerInput.btnStart = false;
                        window.QuantumWebRTC.sendInputState();
                    }, 100);
                    if (navigator.vibrate) navigator.vibrate(50);
                };
                
                actionArea.appendChild(startButton);
            } else if (Array.isArray(config.buttons) && config.buttons.length > 0) {
                config.buttons.forEach(btn => {
                    const buttonEl = document.createElement('button');
                    const colorClass = btn.color === 'purple' ? 'bg-purple-600 border-purple-400' :
                                       btn.color === 'rose' ? 'bg-rose-600 border-rose-400' :
                                       btn.color === 'emerald' ? 'bg-emerald-600 border-emerald-400' :
                                       'bg-indigo-600 border-indigo-400';

                    buttonEl.id = btn.id || 'btnA';
                    buttonEl.className = `btn-action ${colorClass} text-white font-extrabold shadow-2xl border-2 text-lg active:scale-90 transition-all`;
                    buttonEl.textContent = btn.label || (btn.id === 'btnB' ? 'B' : 'A');

                    setupActionButtonListeners(buttonEl, btn.id || 'btnA');
                    actionArea.appendChild(buttonEl);
                });
            }
        }
    }

    /**
     * Setup Analog Touch Joystick
     */
    function setupJoystickListeners() {
        if (!joystickBase || !joystickKnob) return;

        const handleStart = (e) => {
            e.preventDefault();
            const touch = e.changedTouches ? e.changedTouches[0] : e;
            activeTouchId = touch.identifier !== undefined ? touch.identifier : 'mouse';
            updateJoystickPosition(touch.clientX, touch.clientY);
        };

        const handleMove = (e) => {
            if (activeTouchId === null) return;
            let touch = null;

            if (e.changedTouches) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === activeTouchId) {
                        touch = e.changedTouches[i];
                        break;
                    }
                }
            } else {
                touch = e;
            }

            if (touch) {
                e.preventDefault();
                updateJoystickPosition(touch.clientX, touch.clientY);
            }
        };

        const handleEnd = (e) => {
            if (activeTouchId === null) return;

            if (e.changedTouches) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === activeTouchId) {
                        resetJoystick();
                        break;
                    }
                }
            } else {
                resetJoystick();
            }
        };

        joystickBase.addEventListener('touchstart', handleStart, { passive: false });
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd, { passive: false });
        window.addEventListener('touchcancel', handleEnd, { passive: false });

        joystickBase.addEventListener('mousedown', handleStart);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
    }

    function updateJoystickPosition(clientX, clientY) {
        const rect = joystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let dx = clientX - centerX;
        let dy = clientY - centerY;

        // Enforce Directional Constraints based on active game rules
        if (currentConfig.joystickAxis === 'horizontal') dy = 0;
        if (currentConfig.joystickAxis === 'vertical') dx = 0;

        const maxRadius = rect.width / 2 - 24;
        const distance = Math.hypot(dx, dy);

        if (distance > maxRadius) {
            const angle = Math.atan2(dy, dx);
            dx = Math.cos(angle) * maxRadius;
            dy = Math.sin(angle) * maxRadius;
        }

        const normX = parseFloat((dx / maxRadius).toFixed(2));
        const normY = parseFloat((dy / maxRadius).toFixed(2));

        joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

        // Update WebRTC Transmitter Input State
        const inputState = window.QuantumWebRTC.controllerInput;
        inputState.x = normX;
        inputState.y = normY;
        inputState.left = normX < -0.3;
        inputState.right = normX > 0.3;
        inputState.up = normY < -0.3;
        inputState.down = normY > 0.3;

        window.QuantumWebRTC.sendInputState();
    }

    function resetJoystick() {
        activeTouchId = null;
        if (joystickKnob) joystickKnob.style.transform = `translate(0px, 0px)`;

        const inputState = window.QuantumWebRTC.controllerInput;
        inputState.x = 0;
        inputState.y = 0;
        inputState.left = false;
        inputState.right = false;
        inputState.up = false;
        inputState.down = false;

        window.QuantumWebRTC.sendInputState();
    }

    /**
     * Attach Touch Listeners for Action Buttons
     */
    function setupActionButtonListeners(el, keyId) {
        const handleStart = (e) => {
            e.preventDefault();
            window.QuantumWebRTC.controllerInput[keyId] = true;
            if (navigator.vibrate) navigator.vibrate(25);
            window.QuantumWebRTC.sendInputState();
        };

        const handleEnd = (e) => {
            e.preventDefault();
            window.QuantumWebRTC.controllerInput[keyId] = false;
            window.QuantumWebRTC.sendInputState();
        };

        el.addEventListener('touchstart', handleStart, { passive: false });
        el.addEventListener('touchend', handleEnd, { passive: false });
        el.addEventListener('mousedown', handleStart);
        el.addEventListener('mouseup', handleEnd);
    }

    return {
        initControllerUI,
        applyControlConfig
    };
})();

# 🎮 QuantumPlay Arcade

**QuantumPlay** is a modular web arcade where your smartphone becomes a wireless WebRTC gamepad controller for games running on your desktop/laptop browser screen.

---

## 📁 Repository Organization

```
QuantumPlay/
├── index.html                  # Main application layout & router
├── css/
│   └── style.css               # Glassmorphism UI & controller styling
├── js/
│   ├── app.js                  # App orchestration & view state routing
│   ├── webrtc.js               # WebRTC PeerJS host/controller connection manager
│   ├── controller.js           # Smartphone D-Pad & Action touch input handlers
│   └── game-loader.js         # Dynamic game loader & registry manager
└── games/                      # 🎮 Game Library Folder
    ├── games.json              # Active games list registry
    ├── space-runner/           # Game 1: Space Neo-Runner
    │   ├── game.json           # Metadata (title, description, icon, thumbnail)
    │   ├── thumbnail.svg       # Custom SVG thumbnail image
    │   └── game.js             # Game code implementation
    ├── cyber-pong/             # Game 2: Cyber Pong 2099
    │   ├── game.json
    │   ├── thumbnail.svg
    │   └── game.js
    └── laser-defender/          # Game 3: Laser Defender
        ├── game.json
        ├── thumbnail.svg
        └── game.js
```

---

## 🚀 How to Add a New Game

Adding a new game to QuantumPlay requires just **3 simple steps**:

### Step 1: Create a Folder for Your Game
Inside the `games/` directory, create a new folder named after your game ID (e.g. `games/my-custom-game/`).

### Step 2: Add `game.json` and `game.js`

**`games/my-custom-game/game.json`**:
```json
{
  "id": "my-custom-game",
  "title": "My Custom Game",
  "description": "Short description of how to play the game.",
  "icon": "fa-solid fa-gamepad",
  "thumbnail": "games/my-custom-game/thumbnail.svg",
  "themeColor": "indigo",
  "script": "games/my-custom-game/game.js"
}
```

**`games/my-custom-game/game.js`**:
```javascript
(function () {
    let animationFrameId = null;

    function start(canvas, ctx, getInput) {
        // Main game loop
        function loop() {
            const input = getInput(); // { up, down, left, right, btnA, btnB }

            // Clear canvas
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw game elements based on input...

            animationFrameId = requestAnimationFrame(loop);
        }

        loop();
    }

    function stop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    window.QuantumGames = window.QuantumGames || {};
    window.QuantumGames['my-custom-game'] = {
        start: start,
        stop: stop
    };
})();
```

*(Optional)* You can also place a `thumbnail.svg` or `thumbnail.jpg` in your game folder!

### Step 3: Register in `games/games.json`
Add your game folder ID to `games/games.json`:

```json
[
  "space-runner",
  "cyber-pong",
  "laser-defender",
  "my-custom-game"
]
```

QuantumPlay will automatically render the new game card on the dashboard and handle launching it when selected!

---

## 🏃 Running Locally

Serve the directory with any local static HTTP server:

```bash
# Using Node.js npx serve
npx serve .

# Or using Python 3
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

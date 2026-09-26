/**
 * QuantumPlay - Dynamic Game Loader & Library Manager
 * Scans games/ folder registry and renders available game cards.
 */

window.QuantumGames = window.QuantumGames || {};

window.QuantumGameLoader = (function () {
    const loadedScripts = new Set();
    const gameRegistry = new Map();

    // Default fallback registry if fetch() is restricted (e.g., file:// protocol)
    const fallbackGames = [
        {
            id: 'sukuna-game',
            title: 'Sukuna - Magical Physics Puzzle',
            description: 'Drop celestial items into the container. Merge identical items to evolve into higher tier celestial spheres!',
            icon: 'fa-solid fa-gem',
            thumbnail: 'games/sukuna-game/thumbnail.svg',
            themeColor: 'purple',
            script: 'games/sukuna-game/game.js',
            controls: {
                joystickAxis: 'horizontal',
                buttons: [
                    { id: 'btnA', label: 'DROP', color: 'purple' }
                ]
            }
        }
    ];

    /**
     * Load game library from games/games.json
     */
    async function loadLibrary(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500">Loading game library...</div>`;

        let gamesToLoad = [];

        try {
            const response = await fetch('games/games.json');
            if (response.ok) {
                const gameList = await response.json();
                for (const gameId of gameList) {
                    try {
                        const metaRes = await fetch(`games/${gameId}/game.json`);
                        if (metaRes.ok) {
                            const meta = await metaRes.json();
                            meta.script = meta.script || `games/${gameId}/game.js`;
                            gamesToLoad.push(meta);
                        }
                    } catch (e) {
                        console.warn(`Could not load metadata for game ${gameId}:`, e);
                    }
                }
            }
        } catch (err) {
            console.warn('Could not fetch games/games.json directly. Using fallback library.', err);
        }

        if (gamesToLoad.length === 0) {
            gamesToLoad = fallbackGames;
        }

        container.innerHTML = '';
        gameRegistry.clear();

        gamesToLoad.forEach(game => {
            gameRegistry.set(game.id, game);
            const card = createGameCard(game);
            container.appendChild(card);
        });
    }

    /**
     * Create HTML element for a game card
     */
    function createGameCard(game) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'game-card glass-card rounded-2xl overflow-hidden flex flex-col border border-gray-800';

        const colorClasses = {
            indigo: { bg: 'from-indigo-900 via-slate-900 to-purple-900', btn: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30', text: 'text-indigo-400' },
            emerald: { bg: 'from-emerald-900 via-slate-900 to-teal-900', btn: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30', text: 'text-emerald-400' },
            purple: { bg: 'from-purple-900 via-slate-900 to-fuchsia-900', btn: 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30', text: 'text-purple-400' },
            rose: { bg: 'from-rose-900 via-slate-900 to-red-900', btn: 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30', text: 'text-rose-400' },
            amber: { bg: 'from-amber-900 via-slate-900 to-yellow-900', btn: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30', text: 'text-amber-400' }
        };

        const theme = colorClasses[game.themeColor] || colorClasses.purple;

        let thumbnailHtml = '';
        if (game.thumbnail) {
            thumbnailHtml = `
                <img src="${game.thumbnail}" alt="${game.title}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110" 
                     onerror="this.onerror=null; this.outerHTML='<i class=\\'${game.icon || 'fa-solid fa-gamepad'} text-7xl ${theme.text} drop-shadow-lg\\'></i>';" />
            `;
        } else {
            thumbnailHtml = `<i class="${game.icon || 'fa-solid fa-gamepad'} text-7xl ${theme.text} drop-shadow-lg"></i>`;
        }

        cardDiv.innerHTML = `
            <div class="h-48 bg-gradient-to-tr ${theme.bg} relative flex items-center justify-center overflow-hidden">
                ${thumbnailHtml}
                <span class="absolute top-4 right-4 bg-gray-900/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-emerald-400 border border-emerald-500/30">Ready to Play</span>
            </div>
            <div class="p-6 flex-1 flex flex-col justify-between">
                <div>
                    <h3 class="text-xl font-bold text-white">${game.title}</h3>
                    <p class="text-gray-400 text-sm mt-2">${game.description}</p>
                </div>
                <button onclick="QuantumApp.launchGame('${game.id}')" class="mt-6 w-full py-3 px-4 ${theme.btn} text-white font-semibold rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all">
                    <i class="fa-solid fa-play"></i>
                    <span>Launch Game</span>
                </button>
            </div>
        `;

        return cardDiv;
    }

    /**
     * Dynamically load game script and start game
     */
    async function launchGame(gameId, canvas, ctx, getInput) {
        const gameMeta = gameRegistry.get(gameId);
        if (!gameMeta) {
            console.error(`Game '${gameId}' not found in registry.`);
            return null;
        }

        const scriptPath = gameMeta.script || `games/${gameId}/game.js`;

        if (!loadedScripts.has(scriptPath)) {
            await loadScript(scriptPath);
            loadedScripts.add(scriptPath);
        }

        const gameObject = window.QuantumGames[gameId];
        if (!gameObject || typeof gameObject.start !== 'function') {
            throw new Error(`Game module window.QuantumGames['${gameId}'] is invalid or missing start() method.`);
        }

        gameObject.start(canvas, ctx, getInput);
        return gameObject;
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = (err) => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    function stopGame(gameId) {
        const gameObject = window.QuantumGames[gameId];
        if (gameObject && typeof gameObject.stop === 'function') {
            gameObject.stop();
        }
    }

    function getGameMeta(gameId) {
        return gameRegistry.get(gameId);
    }

    return {
        loadLibrary,
        launchGame,
        stopGame,
        getGameMeta
    };
})();

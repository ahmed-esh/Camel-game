/**
 * Camel Drop Game — Full Redesign
 * Physics-based incremental game with time progression, caravans, farms, and more.
 * Preserves: camel falling physics, shovel mechanic.
 */

/* ============================================================
   CONFIGURATION
   ============================================================ */
const SECONDS_PER_GAME_DAY = 120;
const CAMEL_SPAWN_INTERVAL = 6;
const CARAVAN_COST = 100;
const FIRST_CARAVAN_DURATION = 3;
const CARAVAN_DURATION_MIN = 5;
const CARAVAN_DURATION_MAX = 11;
const FARM_COST_SILVER = 99;
const FARM_COST_GOLD = 1;
const FARM_UPKEEP_SILVER = 50;
const FARM_UPKEEP_GOLD = 2;
const FARM_UPKEEP_INTERVAL = 30;
const SILVER_MINE_COST_CAMELS = 1000;
const GOLD_MINE_COST_CAMELS = 5000;
const SILVER_MINE_SILVER_PER_DAY = 5;
const GOLD_MINE_GOLD_PER_DAY = 1;
const BANQUET_COST = 10000;
const BANQUET_DURATION = 10;
const BANQUET_REWARD_HOTDOGS = 4;
const RACE_COST = 25000;
const RACE_DURATION = 25;
const RACE_REWARD_HOTDOGS = 1;
const RACE_REWARD_WARRIORS = 3;
const UNIVERSITY_COST_GOLD = 100;
const CONVERSION_DURATION = 100;
const HUNT_COST_SILVER = 3;
const HUNT_REWARD_CAMELS = 50;
const MAX_VISUAL_CAMELS = 400;
const MAX_LOG_ENTRIES = 5;
const GAME_EPOCH = new Date(2014, 9, 24);
const SLOW_UI_INTERVAL = 500;
const FARM_NAME_POOL = [
    'Ibil', 'Jamal', 'Ba’eer', 'Naqa', 'Fahl', 'Dhawd', 'Wabar', 'Rahl',
    'Al-Hawar', 'Al-Makhlool', 'Al-Mufroud', 'Al-Faseel', 'Al-Luqai', 'Al-Haq',
    'Al-Jathaa', 'Ath-Thinee', 'Ar-Rabaa', 'As-Sudsis', 'Al-Fatir', 'An-Nab',
    'Al-Awd', 'Ath-Thilb'
];
const MINE_NAME_POOL = [
    'Mahd adh-Dhahab', 'Ad Duwayhi Gold', 'Al Shamal', 'Bulghah', 'Al-Amar',
    'Az-Zabirah', 'Sukari Gold', 'Ghar Djebilet', 'El Gedida', 'Wadi Al-Shati',
    'Khor Khuwair Limestone Quarry'
];

/* ============================================================
   CANVAS / PHYSICS STATE
   ============================================================ */
let canvas, ctx;
let visualCamels = [];
let camelImage;
let gravity = 0.5;
let groundY;
let groundColliderEnabled = true;
let shovelActive = false;

/* ============================================================
   AUDIO STATE
   ============================================================ */
let backgroundMusic, camelSound;
let audioUnlocked = false;
let musicEnabled = true;
let sfxEnabled = true;
let interactionSfx = {};

/* ============================================================
   GAME STATE
   ============================================================ */
let gs = null;

function freshState() {
    return {
        currentGameDay: 0,
        camelCount: 0,
        silver: 0,
        gold: 0,
        hotdogs: 0,
        warriorCamels: 0,
        spawnTimer: 0,
        caravans: [],
        farms: [],
        silverMines: [],
        goldMines: [],
        mineSilverProgress: 0,
        mineGoldProgress: 0,
        banquets: [],
        races: [],
        universityBuilt: false,
        conversions: [],
        shovelUnlocked: false,
        caravanUnlocked: false,
        banquetEverAffordable: false,
        raceEverAffordable: false,
        farmEverAffordable: false,
        universityEverAffordable: false,
        huntUnlocked: false,
        mineSilverUnlocked: false,
        mineGoldUnlocked: false,
        firstCaravanSent: false,
        silverEverCollected: false,
        goldEverCollected: false,
        hotdogsEverCollected: false,
        warriorCamelsEverCollected: false,
        log: []
    };
}

function normalizeState() {
    if (Array.isArray(gs.silverMines)) {
        gs.silverMines = gs.silverMines;
    } else {
        const count = Number.isFinite(gs.silverMines) ? gs.silverMines : 0;
        gs.silverMines = Array.from({ length: count }, () => ({ name: pickRandomName(MINE_NAME_POOL) }));
    }
    if (Array.isArray(gs.goldMines)) {
        gs.goldMines = gs.goldMines;
    } else {
        const count = Number.isFinite(gs.goldMines) ? gs.goldMines : 0;
        gs.goldMines = Array.from({ length: count }, () => ({ name: pickRandomName(MINE_NAME_POOL) }));
    }
    gs.mineSilverProgress = Number.isFinite(gs.mineSilverProgress) ? gs.mineSilverProgress : 0;
    gs.mineGoldProgress = Number.isFinite(gs.mineGoldProgress) ? gs.mineGoldProgress : 0;
    gs.mineSilverUnlocked = Boolean(gs.mineSilverUnlocked) || gs.camelCount >= SILVER_MINE_COST_CAMELS || gs.silverMines.length > 0;
    gs.mineGoldUnlocked = Boolean(gs.mineGoldUnlocked) || gs.camelCount >= GOLD_MINE_COST_CAMELS || gs.goldMines.length > 0;

    if (!Array.isArray(gs.farms)) {
        gs.farms = [];
    }

    gs.farms = gs.farms.map(farm => {
        const upkeepRemainingDays = Number.isFinite(farm.upkeepRemainingDays)
            ? farm.upkeepRemainingDays
            : Number.isFinite(farm.nextUpkeepDay)
                ? Math.max(0, farm.nextUpkeepDay - gs.currentGameDay)
                : FARM_UPKEEP_INTERVAL;
        return {
            active: farm.active !== false,
            enabled: farm.enabled !== false,
            upkeepRemainingDays,
            name: typeof farm.name === 'string' && farm.name ? farm.name : pickRandomName(FARM_NAME_POOL),
            payMode: farm.payMode === 'gold' ? 'gold' : 'silver'
        };
    });
}

function pickRandomName(pool) {
    return pool[Math.floor(Math.random() * pool.length)];
}

/* ============================================================
   CHEAT STATE
   ============================================================ */
let keysHeld = {};
let cheatMultiplier = 1;
let manualSpeedMultiplier = 1;

/* ============================================================
   UI STATE
   ============================================================ */
let inventoryOpen = false;
let menuOpen = false;
let lastFrameTime = 0;
let lastSlowUITime = 0;
let logDirty = false;
let dom = {};
let lastWallTime = 0;
let logicInterval = null;
let ownershipView = '';

/* ============================================================
   INITIALIZATION
   ============================================================ */
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();

    loadCamelImage();
    setupAudio();

    gs = freshState();
    normalizeState();

    cacheDOMRefs();
    setupEventListeners();
    setupTooltips();
    updateUI();
    updateSpeedButton();

    lastWallTime = Date.now();

    logicInterval = setInterval(backgroundLogicTick, 1000);

    requestAnimationFrame(renderLoop);
}

function cacheDOMRefs() {
    dom.spawnBtn = document.getElementById('spawnButton');
    dom.shovelBtn = document.getElementById('shovelButton');
    dom.caravanBtn = document.getElementById('caravanButton');
    dom.banquetBtn = document.getElementById('banquetButton');
    dom.raceBtn = document.getElementById('raceButton');
    dom.huntBtn = document.getElementById('huntButton');
    dom.chestBtn = document.getElementById('chestButton');
    dom.camelDisplay = document.getElementById('camelCountDisplay');
    dom.inventoryPanel = document.getElementById('inventoryPanel');
    dom.closeInventoryBtn = document.getElementById('closeInventory');
    dom.gameDateDisplay = document.getElementById('gameDateDisplay');
    dom.speedToggleBtn = document.getElementById('speedToggleBtn');
    dom.camelCounterIcon = document.getElementById('camelCounterIcon');
    dom.resourceList = document.getElementById('resourceList');
    dom.buildingActions = document.getElementById('buildingActions');
    dom.activeProcesses = document.getElementById('activeProcesses');
    dom.ownershipPanel = document.getElementById('ownershipPanel');
    dom.ownershipTitle = document.getElementById('ownershipTitle');
    dom.ownershipContent = document.getElementById('ownershipContent');
    dom.closeOwnershipPanel = document.getElementById('closeOwnershipPanel');
    dom.logPanel = document.getElementById('logPanel');
    dom.menuBtn = document.getElementById('menuButton');
    dom.menuPanel = document.getElementById('menuPanel');
    dom.closeMenuBtn = document.getElementById('closeMenu');
    dom.newGameBtn = document.getElementById('newGameBtn');
    dom.saveGameBtn = document.getElementById('saveGameBtn');
    dom.loadGameBtn = document.getElementById('loadGameBtn');
    dom.toggleMusicBtn = document.getElementById('toggleMusicBtn');
    dom.toggleSfxBtn = document.getElementById('toggleSfxBtn');
    dom.hotdogBtn = document.getElementById('hotdogBtn');
    dom.saveLoadArea = document.getElementById('saveLoadArea');
    dom.saveLoadText = document.getElementById('saveLoadText');
    dom.saveLoadConfirm = document.getElementById('saveLoadConfirm');
    dom.tooltip = document.getElementById('tooltip');
}

function setupEventListeners() {
    dom.spawnBtn.addEventListener('click', handleSpawnClick);
    dom.shovelBtn.addEventListener('click', handleShovelClick);
    dom.caravanBtn.addEventListener('click', handleCaravanClick);
    dom.banquetBtn.addEventListener('click', handleBanquetClick);
    dom.raceBtn.addEventListener('click', handleRaceClick);
    dom.huntBtn.addEventListener('click', handleHuntClick);
    dom.chestBtn.addEventListener('click', toggleInventory);
    dom.closeInventoryBtn.addEventListener('click', toggleInventory);
    dom.speedToggleBtn.addEventListener('click', toggleSpeedMode);
    dom.menuBtn.addEventListener('click', toggleMenu);
    dom.closeMenuBtn.addEventListener('click', toggleMenu);
    dom.newGameBtn.addEventListener('click', handleNewGame);
    dom.saveGameBtn.addEventListener('click', handleSaveGame);
    dom.loadGameBtn.addEventListener('click', handleLoadGame);
    dom.toggleMusicBtn.addEventListener('click', toggleMusic);
    dom.toggleSfxBtn.addEventListener('click', toggleSfx);
    dom.hotdogBtn.addEventListener('click', openHotdogPage);
    dom.saveLoadConfirm.addEventListener('click', confirmLoad);
    dom.closeOwnershipPanel.addEventListener('click', closeOwnershipPanel);

    dom.buildingActions.addEventListener('click', handleBuildingClick);
    dom.ownershipContent.addEventListener('click', handleOwnedPanelClick);

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', e => {
        keysHeld[e.key.toLowerCase()] = true;
        updateCheatMultiplier();
    });
    window.addEventListener('keyup', e => {
        keysHeld[e.key.toLowerCase()] = false;
        updateCheatMultiplier();
    });
}

function handleBuildingClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    if (action === 'farmSilver') buyFarmWithSilver();
    else if (action === 'farmGold') buyFarmWithGold();
    else if (action === 'mineSilver') buildSilverMine();
    else if (action === 'mineGold') buildGoldMine();
    else if (action === 'manageFarms') openOwnershipPanel('farms');
    else if (action === 'manageMines') openOwnershipPanel('mines');
    else if (action === 'farmToggle') toggleFarmState(Number(btn.dataset.farmIndex));
    else if (action === 'university') buildUniversity();
    else if (action === 'convert') startConversion();
}

function openOwnershipPanel(type) {
    ownershipView = type;
    dom.ownershipPanel.classList.remove('hidden');
    renderOwnershipPanel();
}

function closeOwnershipPanel() {
    ownershipView = '';
    dom.ownershipPanel.classList.add('hidden');
}

function renderOwnershipPanel() {
    if (!ownershipView) return;

    if (ownershipView === 'farms') {
        dom.ownershipTitle.textContent = 'Owned Farms';
        if (gs.farms.length === 0) {
            dom.ownershipContent.innerHTML = '<div class="proc-row faded">No farms built yet.</div>';
            return;
        }
        dom.ownershipContent.innerHTML = gs.farms.map((farm, index) => {
            const status = farm.enabled
                ? (farm.active ? 'ON' : 'UPKEEP FAILED')
                : 'OFF';
            return '<div class="owned-row">' +
                '<div class="owned-title">🏡 ' + farm.name + '</div>' +
                '<div class="owned-sub">Status: ' + status + ' · upkeep in ' + Math.ceil(farm.upkeepRemainingDays) + ' days</div>' +
                '<div class="owned-controls">' +
                '<button class="inv-btn" data-owned-action="farmToggle" data-farm-index="' + index + '">' + (farm.enabled ? 'Turn OFF' : 'Turn ON') + '</button>' +
                '<span class="owned-sub no-margin">Pay with</span>' +
                '<button class="pay-switch" data-owned-action="farmPayToggle" data-farm-index="' + index + '"' + (farm.enabled ? '' : ' disabled') + '>' +
                '<span class="pay-option' + (farm.payMode === 'silver' ? ' active' : '') + '">Silver</span>' +
                '<span class="pay-option' + (farm.payMode === 'gold' ? ' active' : '') + '">Gold</span>' +
                '</button>' +
                '</div></div>';
        }).join('');
        return;
    }

    dom.ownershipTitle.textContent = 'Owned Mines';
    const allMines = [
        ...gs.silverMines.map(mine => ({ type: 'Silver Mine', rate: `${SILVER_MINE_SILVER_PER_DAY} silver/day`, name: mine.name })),
        ...gs.goldMines.map(mine => ({ type: 'Gold Mine', rate: `${GOLD_MINE_GOLD_PER_DAY} gold/day`, name: mine.name }))
    ];
    if (allMines.length === 0) {
        dom.ownershipContent.innerHTML = '<div class="proc-row faded">No mines built yet.</div>';
        return;
    }
    dom.ownershipContent.innerHTML = allMines.map(mine =>
        '<div class="owned-row">' +
        '<div class="owned-title">⛏️ ' + mine.name + '</div>' +
        '<div class="owned-sub">' + mine.type + ' · ' + mine.rate + '</div>' +
        '</div>'
    ).join('');
}

function handleOwnedPanelClick(e) {
    const btn = e.target.closest('[data-owned-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.ownedAction;
    if (action === 'farmToggle') {
        toggleFarmState(Number(btn.dataset.farmIndex));
        renderOwnershipPanel();
    } else if (action === 'farmPayToggle') {
        const index = Number(btn.dataset.farmIndex);
        if (Number.isFinite(index) && gs.farms[index]) {
            gs.farms[index].payMode = gs.farms[index].payMode === 'silver' ? 'gold' : 'silver';
            renderOwnershipPanel();
        }
    }
}

/* ============================================================
   ASSET LOADING
   ============================================================ */
function loadCamelImage() {
    camelImage = new Image();
    camelImage.onload = () => console.log('Camel image loaded');
    camelImage.onerror = () => console.error('Failed to load camel image');
    camelImage.src = 'assets/camel-png-4.png';
}

function setupAudio() {
    backgroundMusic = document.getElementById('backgroundMusic');
    camelSound = document.getElementById('camelSound');
    backgroundMusic.volume = 0.3;
    camelSound.volume = 0.7;
    setupInteractionSfx();
}

function setupInteractionSfx() {
    interactionSfx = {
        caravan: new Audio('assets/sfx/carvans.mp3'),
        farm: new Audio('assets/sfx/farms.wav'),
        mine: new Audio('assets/sfx/mines ready.wav'),
        banquet: new Audio('assets/sfx/partysoundd.wav'),
        race: new Audio('assets/sfx/race.wav'),
        shovel: new Audio('assets/sfx/shovel.mp3'),
        hunt: new Audio('assets/sfx/ES_Arrows, Shot 34, Bow, 8070 - Epidemic Sound.mp3')
    };
    Object.values(interactionSfx).forEach(sound => {
        sound.volume = 0.75;
    });
}

function playSfx(key) {
    if (!sfxEnabled || !interactionSfx[key]) return;
    unlockAudio();
    const sound = interactionSfx[key];
    sound.currentTime = 0;
    sound.play().catch(() => {});
}

function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    if (musicEnabled) {
        backgroundMusic.play().catch(() => {});
    }
}

/* ============================================================
   CAMEL SPAWNING
   ============================================================ */
function spawnCamel(playSound) {
    gs.camelCount++;

    spawnVisualCamel();

    if (playSound && audioUnlocked && sfxEnabled) {
        camelSound.currentTime = 0;
        camelSound.play().catch(() => {});
    }
}

function spawnVisualCamel() {
    if (visualCamels.length >= MAX_VISUAL_CAMELS) {
        const idx = visualCamels.findIndex(c =>
            Math.abs(c.velocityY) < 0.5 && c.y >= groundY - c.height - 5
        );
        if (idx >= 0) visualCamels.splice(idx, 1);
    }
    createCamelEntity();
}

function createCamelEntity() {
    visualCamels.push({
        x: Math.random() * (canvas.width - 100) + 50,
        y: 50,
        width: 80,
        height: 100,
        velocityX: (Math.random() - 0.5) * 2,
        velocityY: 0,
        rotation: (Math.random() - 0.5) * 0.5,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        scale: 0.8 + Math.random() * 0.4,
        color: `hsl(${Math.random() * 60 + 30}, 70%, 60%)`,
        anchorX: Math.random() * 80,
        anchorY: Math.random() * 100
    });
}

function handleSpawnClick() {
    unlockAudio();
    if (!camelImage.complete) return;
    spawnCamel(true);
}

/* ============================================================
   PHYSICS ENGINE (preserved)
   ============================================================ */
function checkCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

function handleCollision(c1, c2) {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;

    const overlap = (c1.width + c2.width) / 2 - dist;
    if (overlap > 0) {
        c1.x -= nx * overlap * 0.5;
        c1.y -= ny * overlap * 0.5;
        c2.x += nx * overlap * 0.5;
        c2.y += ny * overlap * 0.5;
    }

    const rvx = c2.velocityX - c1.velocityX;
    const rvy = c2.velocityY - c1.velocityY;
    const velNormal = rvx * nx + rvy * ny;
    if (velNormal > 0) return;

    const restitution = 0.6;
    const impulse = -(1 + restitution) * velNormal / 2;

    c1.velocityX -= impulse * nx;
    c1.velocityY -= impulse * ny;
    c2.velocityX += impulse * nx;
    c2.velocityY += impulse * ny;

    c1.rotationSpeed += (Math.random() - 0.5) * 0.05;
    c2.rotationSpeed += (Math.random() - 0.5) * 0.05;
}

function updatePhysics() {
    for (let i = visualCamels.length - 1; i >= 0; i--) {
        const c = visualCamels[i];

        c.velocityY += gravity;
        c.x += c.velocityX;
        c.y += c.velocityY;
        c.rotation += c.rotationSpeed;
        c.rotationSpeed *= 0.95;
        c.velocityX *= 0.99;
        c.velocityY *= 0.999;

        if (c.x <= 0 || c.x >= canvas.width - c.width) {
            c.velocityX *= -0.7;
            c.x = Math.max(0, Math.min(canvas.width - c.width, c.x));
        }

        if (groundColliderEnabled && c.y >= groundY - c.height) {
            c.y = groundY - c.height;
            c.velocityY *= -0.3;
            c.velocityX *= 0.8;
            c.rotationSpeed *= 0.9;
        }

        if (groundColliderEnabled && Math.abs(c.velocityY) < 0.1 && c.y >= groundY - c.height - 5) {
            c.velocityY = 0;
            c.rotationSpeed *= 0.8;
        }

        if (Math.abs(c.rotationSpeed) < 0.001) c.rotationSpeed = 0;

        if (c.y > canvas.height + 100) {
            visualCamels.splice(i, 1);
        }
    }

    for (let i = 0; i < visualCamels.length; i++) {
        for (let j = i + 1; j < visualCamels.length; j++) {
            if (checkCollision(visualCamels[i], visualCamels[j])) {
                handleCollision(visualCamels[i], visualCamels[j]);
            }
        }
    }
}

/* ============================================================
   RENDERING
   ============================================================ */
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGround();
    renderCamels();
}

function drawGround() {
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
    ctx.fillStyle = '#A0522D';
    for (let i = 0; i < canvas.width; i += 20) {
        ctx.fillRect(i, groundY, 10, 10);
    }
}

function renderCamels() {
    visualCamels.forEach(c => {
        ctx.save();
        ctx.translate(c.x + c.anchorX, c.y + c.anchorY);
        ctx.rotate(c.rotation);
        ctx.scale(c.scale, c.scale);

        if (camelImage.complete) {
            ctx.drawImage(camelImage, -c.anchorX, -c.anchorY, c.width, c.height);
        } else {
            ctx.fillStyle = c.color;
            ctx.fillRect(-c.anchorX, -c.anchorY, c.width, c.height);
        }

        ctx.restore();
    });
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    groundY = canvas.height - 100;
}

/* ============================================================
   SHOVEL (preserved)
   ============================================================ */
function handleShovelClick() {
    if (shovelActive) return;
    playSfx('shovel');
    shovelActive = true;
    groundColliderEnabled = false;

    dom.shovelBtn.classList.add('active');

    const savedGravity = gravity;
    gravity = 2;

    visualCamels.forEach(c => { c.velocityY += 5; });

    setTimeout(() => {
        gravity = savedGravity;
        groundColliderEnabled = true;
        shovelActive = false;
        dom.shovelBtn.classList.remove('active');
    }, 3000);
}

/* ============================================================
   GAME TIME
   ============================================================ */
function advanceGameTime(deltaSec) {
    gs.currentGameDay += deltaSec / SECONDS_PER_GAME_DAY;
}

function getTimeMultiplier() {
    return cheatMultiplier > 1 ? cheatMultiplier : manualSpeedMultiplier;
}

function toggleSpeedMode() {
    manualSpeedMultiplier = manualSpeedMultiplier === 2 ? 1 : 2;
    updateSpeedButton();
}

function updateSpeedButton() {
    if (!dom.speedToggleBtn) return;
    const modeText = manualSpeedMultiplier === 2 ? 'ON' : 'OFF';
    dom.speedToggleBtn.textContent = `⏩ 2x: ${modeText}`;
}

function getCalendarDate() {
    const d = new Date(GAME_EPOCH);
    d.setDate(d.getDate() + Math.floor(gs.currentGameDay));
    return d;
}

function formatDate(d) {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function daysRemaining(endDay) {
    return Math.max(0, Math.ceil(endDay - gs.currentGameDay));
}

/* ============================================================
   AUTO PRODUCTION (real-time, NOT affected by cheat)
   Handles large deltas from background tabs gracefully.
   ============================================================ */
function updateAutoProduction(deltaSec) {
    gs.spawnTimer += deltaSec;
    const intervals = Math.floor(gs.spawnTimer / CAMEL_SPAWN_INTERVAL);
    if (intervals <= 0) return;
    gs.spawnTimer -= intervals * CAMEL_SPAWN_INTERVAL;

    const activeFarms = gs.farms.filter(f => f.active && f.enabled).length;
    const camelsPerInterval = 1 + activeFarms;
    const totalCamels = intervals * camelsPerInterval;

    gs.camelCount += totalCamels;

    const visualToSpawn = Math.min(totalCamels, 15);
    for (let i = 0; i < visualToSpawn; i++) {
        createCamelEntity();
    }

    while (visualCamels.length > MAX_VISUAL_CAMELS) {
        const idx = visualCamels.findIndex(c =>
            Math.abs(c.velocityY) < 0.5 && c.y >= groundY - c.height - 5
        );
        if (idx >= 0) visualCamels.splice(idx, 1);
        else break;
    }
}

/* ============================================================
   CARAVAN SYSTEM
   ============================================================ */
function handleCaravanClick() {
    if (gs.camelCount < CARAVAN_COST) return;
    playSfx('caravan');
    gs.camelCount -= CARAVAN_COST;

    let duration;
    if (!gs.firstCaravanSent) {
        duration = FIRST_CARAVAN_DURATION;
        gs.firstCaravanSent = true;
    } else {
        duration = CARAVAN_DURATION_MIN + Math.floor(Math.random() * (CARAVAN_DURATION_MAX - CARAVAN_DURATION_MIN + 1));
    }

    gs.caravans.push({
        departDay: gs.currentGameDay,
        returnDay: gs.currentGameDay + duration
    });
    addLog('Caravan dispatched! Returns in ' + duration + ' days.');
}

function checkCaravanCompletions() {
    for (let i = gs.caravans.length - 1; i >= 0; i--) {
        if (gs.currentGameDay >= gs.caravans[i].returnDay) {
            gs.caravans.splice(i, 1);
            resolveCaravanLoot();
        }
    }
}

function resolveCaravanLoot() {
    const roll = Math.random();
    let msg;
    if (roll < 0.01) {
        gs.hotdogs += 1;
        gs.silver += 4;
        gs.hotdogsEverCollected = true;
        gs.silverEverCollected = true;
        msg = 'Caravan returned with 1 🌭 Hotdog + 4 🥈 Silver!';
    } else if (roll < 0.12) {
        gs.gold += 1;
        gs.silver += 4;
        gs.goldEverCollected = true;
        gs.silverEverCollected = true;
        msg = 'Caravan returned with 1 🥇 Gold + 4 🥈 Silver!';
    } else {
        gs.silver += 5;
        gs.silverEverCollected = true;
        msg = 'Caravan returned with 5 🥈 Silver.';
    }
    addLog(msg);
}

/* ============================================================
   HUNT SYSTEM
   ============================================================ */
function handleHuntClick() {
    if (gs.silver < HUNT_COST_SILVER) return;
    playSfx('hunt');
    gs.silver -= HUNT_COST_SILVER;
    gs.camelCount += HUNT_REWARD_CAMELS;

    const visualToSpawn = Math.min(HUNT_REWARD_CAMELS, 15);
    for (let i = 0; i < visualToSpawn; i++) {
        createCamelEntity();
    }

    addLog('Hunt successful! Captured ' + HUNT_REWARD_CAMELS + ' 🐪 camels.');
}

/* ============================================================
   FARM SYSTEM
   ============================================================ */
function buyFarmWithSilver() {
    if (gs.silver < FARM_COST_SILVER) return;
    playSfx('farm');
    gs.silver -= FARM_COST_SILVER;
    gs.farms.push({
        active: true,
        enabled: true,
        upkeepRemainingDays: FARM_UPKEEP_INTERVAL,
        name: pickRandomName(FARM_NAME_POOL),
        payMode: 'silver'
    });
    addLog('Farm built! Worker is producing camels.');
}

function buyFarmWithGold() {
    if (gs.gold < FARM_COST_GOLD) return;
    playSfx('farm');
    gs.gold -= FARM_COST_GOLD;
    gs.farms.push({
        active: true,
        enabled: true,
        upkeepRemainingDays: FARM_UPKEEP_INTERVAL,
        name: pickRandomName(FARM_NAME_POOL),
        payMode: 'silver'
    });
    addLog('Farm built! Worker is producing camels.');
}

function checkFarmUpkeep(elapsedGameDays) {
    gs.farms.forEach((farm, index) => {
        if (!farm.enabled) {
            return;
        }

        farm.upkeepRemainingDays -= elapsedGameDays;
        while (farm.upkeepRemainingDays <= 0) {
            if (farm.payMode === 'silver' && gs.silver >= FARM_UPKEEP_SILVER) {
                gs.silver -= FARM_UPKEEP_SILVER;
                farm.active = true;
                farm.upkeepRemainingDays += FARM_UPKEEP_INTERVAL;
                addLog('Farm #' + (index + 1) + ' upkeep paid (' + FARM_UPKEEP_SILVER + ' 🥈).');
            } else if (farm.payMode === 'gold' && gs.gold >= FARM_UPKEEP_GOLD) {
                gs.gold -= FARM_UPKEEP_GOLD;
                farm.active = true;
                farm.upkeepRemainingDays += FARM_UPKEEP_INTERVAL;
                addLog('Farm #' + (index + 1) + ' upkeep paid (' + FARM_UPKEEP_GOLD + ' 🥇).');
            } else {
                farm.active = false;
                farm.upkeepRemainingDays = 0;
                addLog('Farm #' + (index + 1) + ' upkeep failed! Worker idle.');
                break;
            }
        }
    });
}

function toggleFarmState(index) {
    if (!Number.isFinite(index) || index < 0 || index >= gs.farms.length) return;
    const farm = gs.farms[index];
    farm.enabled = !farm.enabled;
    if (!farm.enabled) {
        addLog('Farm #' + (index + 1) + ' turned OFF. Upkeep timer frozen at ' + Math.ceil(farm.upkeepRemainingDays) + ' days.');
    } else {
        addLog('Farm #' + (index + 1) + ' turned ON.');
    }
}

function buildSilverMine() {
    if (gs.camelCount < SILVER_MINE_COST_CAMELS) return;
    playSfx('mine');
    gs.camelCount -= SILVER_MINE_COST_CAMELS;
    gs.silverMines.push({ name: pickRandomName(MINE_NAME_POOL) });
    addLog('Silver mine built! Produces ' + SILVER_MINE_SILVER_PER_DAY + ' silver/day.');
}

function buildGoldMine() {
    if (gs.camelCount < GOLD_MINE_COST_CAMELS) return;
    playSfx('mine');
    gs.camelCount -= GOLD_MINE_COST_CAMELS;
    gs.goldMines.push({ name: pickRandomName(MINE_NAME_POOL) });
    addLog('Gold mine built! Produces ' + GOLD_MINE_GOLD_PER_DAY + ' gold/day.');
}

function updateMineProduction(elapsedGameDays) {
    if (gs.silverMines.length > 0) {
        gs.mineSilverProgress += gs.silverMines.length * SILVER_MINE_SILVER_PER_DAY * elapsedGameDays;
        const wholeSilver = Math.floor(gs.mineSilverProgress);
        if (wholeSilver > 0) {
            gs.silver += wholeSilver;
            gs.mineSilverProgress -= wholeSilver;
            gs.silverEverCollected = true;
        }
    }
    if (gs.goldMines.length > 0) {
        gs.mineGoldProgress += gs.goldMines.length * GOLD_MINE_GOLD_PER_DAY * elapsedGameDays;
        const wholeGold = Math.floor(gs.mineGoldProgress);
        if (wholeGold > 0) {
            gs.gold += wholeGold;
            gs.mineGoldProgress -= wholeGold;
            gs.goldEverCollected = true;
        }
    }
}

/* ============================================================
   BANQUET SYSTEM
   ============================================================ */
function handleBanquetClick() {
    if (gs.camelCount < BANQUET_COST) return;
    playSfx('banquet');
    gs.camelCount -= BANQUET_COST;
    gs.banquets.push({
        startDay: gs.currentGameDay,
        endDay: gs.currentGameDay + BANQUET_DURATION
    });
    addLog('Banquet started! Finishes in ' + BANQUET_DURATION + ' days.');
}

function checkBanquetCompletions() {
    for (let i = gs.banquets.length - 1; i >= 0; i--) {
        if (gs.currentGameDay >= gs.banquets[i].endDay) {
            gs.banquets.splice(i, 1);
            gs.hotdogs += BANQUET_REWARD_HOTDOGS;
            gs.hotdogsEverCollected = true;
            addLog('Banquet complete! Received ' + BANQUET_REWARD_HOTDOGS + ' 🌭 Hotdogs.');
        }
    }
}

/* ============================================================
   RACE SYSTEM
   ============================================================ */
function handleRaceClick() {
    if (gs.camelCount < RACE_COST) return;
    playSfx('race');
    gs.camelCount -= RACE_COST;
    gs.races.push({
        startDay: gs.currentGameDay,
        endDay: gs.currentGameDay + RACE_DURATION
    });
    addLog('Race started! Finishes in ' + RACE_DURATION + ' days.');
}

function checkRaceCompletions() {
    for (let i = gs.races.length - 1; i >= 0; i--) {
        if (gs.currentGameDay >= gs.races[i].endDay) {
            gs.races.splice(i, 1);
            gs.hotdogs += RACE_REWARD_HOTDOGS;
            gs.warriorCamels += RACE_REWARD_WARRIORS;
            gs.hotdogsEverCollected = true;
            gs.warriorCamelsEverCollected = true;
            addLog('Race finished! +' + RACE_REWARD_HOTDOGS + ' 🌭, +' + RACE_REWARD_WARRIORS + ' ⚔️ Warriors.');
        }
    }
}

/* ============================================================
   UNIVERSITY SYSTEM
   ============================================================ */
function buildUniversity() {
    if (gs.universityBuilt || gs.gold < UNIVERSITY_COST_GOLD) return;
    if (!confirm('Build University for ' + UNIVERSITY_COST_GOLD + ' Gold?')) return;
    gs.gold -= UNIVERSITY_COST_GOLD;
    gs.universityBuilt = true;
    addLog('University built! Convert Hotdogs to Warrior Camels.');
}

function startConversion() {
    if (!gs.universityBuilt || gs.hotdogs < 1) return;
    gs.hotdogs -= 1;
    gs.conversions.push({
        startDay: gs.currentGameDay,
        endDay: gs.currentGameDay + CONVERSION_DURATION
    });
    addLog('Conversion started. Warrior Camel in ' + CONVERSION_DURATION + ' days.');
}

function checkConversionCompletions() {
    for (let i = gs.conversions.length - 1; i >= 0; i--) {
        if (gs.currentGameDay >= gs.conversions[i].endDay) {
            gs.conversions.splice(i, 1);
            gs.warriorCamels += 1;
            gs.warriorCamelsEverCollected = true;
            addLog('Conversion complete! +1 ⚔️ Warrior Camel.');
        }
    }
}

/* ============================================================
   UNLOCK SYSTEM
   ============================================================ */
function checkUnlocks() {
    if (!gs.shovelUnlocked && gs.camelCount >= 10) {
        gs.shovelUnlocked = true;
        addLog('🪣 Shovel unlocked! Sweep camels off the screen.');
    }

    if (!gs.caravanUnlocked && gs.camelCount >= 100) {
        gs.caravanUnlocked = true;
        addLog('🏕️ Caravan unlocked! Spend 100 camels to trade.');
    }

    if (!gs.huntUnlocked && gs.silver >= HUNT_COST_SILVER) {
        gs.huntUnlocked = true;
        addLog('🏹 Hunt unlocked! Spend 3 silver to capture 50 wild camels.');
    }

    if (!gs.mineSilverUnlocked && gs.camelCount >= SILVER_MINE_COST_CAMELS) {
        gs.mineSilverUnlocked = true;
        addLog('⛏️ Silver Mine unlocked! Build for 1000 camels.');
    }

    if (!gs.mineGoldUnlocked && gs.camelCount >= GOLD_MINE_COST_CAMELS) {
        gs.mineGoldUnlocked = true;
        addLog('⛏️ Gold Mine unlocked! Build for 5000 camels.');
    }

    if (!gs.farmEverAffordable && (gs.silver >= FARM_COST_SILVER || gs.gold >= FARM_COST_GOLD)) {
        gs.farmEverAffordable = true;
        addLog('🏡 Farms available! Check the inventory to build one.');
    }

    if (!gs.banquetEverAffordable && gs.camelCount >= BANQUET_COST) {
        gs.banquetEverAffordable = true;
        addLog('🎉 Banquet unlocked! Host a grand feast.');
    }

    if (!gs.raceEverAffordable && gs.camelCount >= RACE_COST) {
        gs.raceEverAffordable = true;
        addLog('🏁 Race unlocked! Enter camels in a grand race.');
    }

    if (!gs.universityEverAffordable && gs.gold >= UNIVERSITY_COST_GOLD) {
        gs.universityEverAffordable = true;
        addLog('🎓 University available! Check the inventory.');
    }
}

/* ============================================================
   LOG SYSTEM
   ============================================================ */
function addLog(text) {
    gs.log.push({ text, day: Math.floor(gs.currentGameDay) });
    while (gs.log.length > MAX_LOG_ENTRIES) gs.log.shift();
    logDirty = true;
}

/* ============================================================
   UI UPDATES
   ============================================================ */
function updateUI() {
    dom.camelDisplay.textContent = fmtNum(gs.camelCount);
    updateSpeedButton();

    const activeFarmWorkers = gs.farms.filter(f => f.active && f.enabled).length;
    const productionPerSixSeconds = 1 + activeFarmWorkers;
    dom.camelCounterIcon.dataset.tooltip =
        `Camel production: ${productionPerSixSeconds} camel(s) every 6 real seconds (base 1 + ${activeFarmWorkers} farm workers).`;

    dom.shovelBtn.classList.toggle('hidden', !gs.shovelUnlocked);
    dom.caravanBtn.classList.toggle('hidden', !gs.caravanUnlocked);
    dom.huntBtn.classList.toggle('hidden', !gs.huntUnlocked);
    dom.banquetBtn.classList.toggle('hidden', !gs.banquetEverAffordable);
    dom.raceBtn.classList.toggle('hidden', !gs.raceEverAffordable);

    dom.caravanBtn.classList.toggle('disabled', gs.camelCount < CARAVAN_COST);
    dom.huntBtn.classList.toggle('disabled', gs.silver < HUNT_COST_SILVER);
    dom.banquetBtn.classList.toggle('disabled', gs.camelCount < BANQUET_COST);
    dom.raceBtn.classList.toggle('disabled', gs.camelCount < RACE_COST);

    const hotdogUnlocked = gs.hotdogsEverCollected || gs.hotdogs >= 10;
    dom.hotdogBtn.disabled = !hotdogUnlocked;
    if (hotdogUnlocked) {
        dom.hotdogBtn.textContent = '🌭 Hotdog';
        dom.hotdogBtn.dataset.tooltip = 'hotdog!';
    } else {
        dom.hotdogBtn.textContent = '🌭 Hotdog (Locked)';
        dom.hotdogBtn.dataset.tooltip = 'Unlocks when you get 1 hotdog.';
    }
}

function updateSlowUI(timestamp) {
    if (timestamp - lastSlowUITime < SLOW_UI_INTERVAL) return;
    lastSlowUITime = timestamp;

    if (logDirty) {
        updateLogPanel();
        logDirty = false;
    }

    if (inventoryOpen) {
        updateInventoryContent();
        if (ownershipView) {
            renderOwnershipPanel();
        }
    }
}

function updateLogPanel() {
    dom.logPanel.innerHTML = gs.log.map(e =>
        '<div class="log-entry"><span class="log-day">Day ' + e.day + '</span> ' + e.text + '</div>'
    ).join('');
}

function fmtNum(n) {
    return Math.floor(n).toLocaleString();
}

/* ============================================================
   INVENTORY PANEL
   ============================================================ */
function toggleInventory() {
    inventoryOpen = !inventoryOpen;
    dom.inventoryPanel.classList.toggle('open', inventoryOpen);
    if (inventoryOpen) {
        updateInventoryContent();
    } else {
        closeOwnershipPanel();
    }
}

function updateInventoryContent() {
    dom.gameDateDisplay.innerHTML =
        '📅 <strong>Day ' + Math.floor(gs.currentGameDay) + '</strong> — ' + formatDate(getCalendarDate());

    let resHTML = resRow('assets/camel icon.png', true, 'Camels', gs.camelCount);
    if (gs.silverEverCollected) resHTML += resRow('🥈', false, 'Silver', gs.silver);
    if (gs.goldEverCollected) resHTML += resRow('assets/gold sign.png', true, 'Gold', gs.gold);
    if (gs.hotdogsEverCollected) resHTML += resRow('🌭', false, 'Hotdogs', gs.hotdogs);
    if (gs.warriorCamelsEverCollected) resHTML += resRow('⚔️', false, 'Warrior Camels', gs.warriorCamels);
    dom.resourceList.innerHTML = resHTML;

    let bld = '';
    if (gs.mineSilverUnlocked || gs.mineGoldUnlocked) {
        bld += '<div class="build-row">' +
            '<div class="build-head"><span class="build-title">⛏️ Mining Grounds</span>' +
            '<button class="manage-btn" data-action="manageMines"' + ((gs.silverMines.length + gs.goldMines.length) === 0 ? ' disabled' : '') + '>Manage</button></div>' +
            '<div class="build-btns">';

        if (gs.mineSilverUnlocked) {
            bld += '<button class="inv-btn" data-action="mineSilver"' +
                (gs.camelCount < SILVER_MINE_COST_CAMELS ? ' disabled' : '') +
                ' data-tooltip="Build a silver mine for ' + SILVER_MINE_COST_CAMELS + ' camels. Produces ' + SILVER_MINE_SILVER_PER_DAY + ' silver per game day.">' +
                'Silver Mine (' + SILVER_MINE_COST_CAMELS + ' 🐪)</button>';
        }

        if (gs.mineGoldUnlocked) {
            bld += '<button class="inv-btn" data-action="mineGold"' +
                (gs.camelCount < GOLD_MINE_COST_CAMELS ? ' disabled' : '') +
                ' data-tooltip="Build a gold mine for ' + GOLD_MINE_COST_CAMELS + ' camels. Produces ' + GOLD_MINE_GOLD_PER_DAY + ' gold per game day.">' +
                'Gold Mine (' + GOLD_MINE_COST_CAMELS + ' 🐪)</button>';
        }

        bld += '</div></div>';
    }

    if (gs.farmEverAffordable) {
        bld += '<div class="build-row">' +
            '<div class="build-head"><span class="build-title">🏡 Farms</span>' +
            '<button class="manage-btn" data-action="manageFarms"' + (gs.farms.length === 0 ? ' disabled' : '') + '>Manage</button></div>' +
            '<div class="build-btns">' +
            '<button class="inv-btn" data-action="farmSilver"' +
            (gs.silver < FARM_COST_SILVER ? ' disabled' : '') +
            ' data-tooltip="Buy a farm for ' + FARM_COST_SILVER + ' Silver. Produces 1 camel every 6 seconds. Worker upkeep: ' + FARM_UPKEEP_SILVER + ' Silver or ' + FARM_UPKEEP_GOLD + ' Gold every ' + FARM_UPKEEP_INTERVAL + ' days.">' +
            'Buy (' + FARM_COST_SILVER + ' 🥈)</button>' +
            '<button class="inv-btn" data-action="farmGold"' +
            (gs.gold < FARM_COST_GOLD ? ' disabled' : '') +
            ' data-tooltip="Buy a farm for ' + FARM_COST_GOLD + ' Gold. Produces 1 camel every 6 seconds. Worker upkeep: ' + FARM_UPKEEP_SILVER + ' Silver or ' + FARM_UPKEEP_GOLD + ' Gold every ' + FARM_UPKEEP_INTERVAL + ' days.">' +
            'Buy (' + FARM_COST_GOLD + ' 🥇)</button>' +
            '</div></div>';
    }
    if (gs.universityEverAffordable && !gs.universityBuilt) {
        bld += '<div class="build-row">' +
            '<span class="build-title">🎓 University</span>' +
            '<button class="inv-btn" data-action="university"' +
            (gs.gold < UNIVERSITY_COST_GOLD ? ' disabled' : '') +
            ' data-tooltip="Build a university for ' + UNIVERSITY_COST_GOLD + ' Gold. Allows converting Hotdogs into Warrior Camels (100 game days each).">' +
            'Build (' + UNIVERSITY_COST_GOLD + ' 🥇)</button></div>';
    }
    if (gs.universityBuilt) {
        bld += '<div class="build-row">' +
            '<span class="build-title">🎓 University <small>(built)</small></span>' +
            '<button class="inv-btn" data-action="convert"' +
            (gs.hotdogs < 1 ? ' disabled' : '') +
            ' data-tooltip="Convert 1 Hotdog into 1 Warrior Camel. Takes ' + CONVERSION_DURATION + ' game days.">' +
            'Convert 🌭 → ⚔️ (' + CONVERSION_DURATION + ' days)</button></div>';
    }
    dom.buildingActions.innerHTML = bld;

    let proc = '';
    if (gs.silverMines.length > 0) {
        proc += '<div class="proc-row">⛏️ Silver Mines: ' + gs.silverMines.length + ' (+' + (gs.silverMines.length * SILVER_MINE_SILVER_PER_DAY) + ' silver/day)</div>';
    }
    if (gs.goldMines.length > 0) {
        proc += '<div class="proc-row">⛏️ Gold Mines: ' + gs.goldMines.length + ' (+' + (gs.goldMines.length * GOLD_MINE_GOLD_PER_DAY) + ' gold/day)</div>';
    }
    gs.caravans.forEach((c, i) => {
        proc += '<div class="proc-row">🏕️ Caravan #' + (i + 1) + ': returning in ' + daysRemaining(c.returnDay) + ' days</div>';
    });
    gs.farms.forEach((f, i) => {
        const upIn = Math.ceil(f.upkeepRemainingDays);
        const st = f.enabled
            ? (f.active ? 'Active (upkeep in ' + upIn + ' days)' : 'Idle (needs upkeep)')
            : 'Off (frozen at ' + upIn + ' days)';
        const farmName = f.name || ('Farm #' + (i + 1));
        proc += '<div class="proc-row">🏡 ' + farmName + ': ' + st + '</div>';
    });
    gs.banquets.forEach(b => {
        proc += '<div class="proc-row">🎉 Banquet: ' + daysRemaining(b.endDay) + ' days remaining</div>';
    });
    gs.races.forEach(r => {
        proc += '<div class="proc-row">🏁 Race: ' + daysRemaining(r.endDay) + ' days remaining</div>';
    });
    gs.conversions.forEach(c => {
        proc += '<div class="proc-row">🎓 Converting: ' + daysRemaining(c.endDay) + ' days remaining</div>';
    });
    if (!proc) proc = '<div class="proc-row faded">No active processes.</div>';
    dom.activeProcesses.innerHTML = proc;
}

function resRow(icon, isImg, label, value) {
    const iconHTML = isImg
        ? '<img src="' + icon + '" class="res-img" alt="' + label + '">'
        : '<span class="res-emoji">' + icon + '</span>';
    return '<div class="res-row"><span class="res-icon">' + iconHTML +
        '</span><span class="res-label">' + label +
        '</span><span class="res-val">' + fmtNum(value) + '</span></div>';
}

/* ============================================================
   MENU
   ============================================================ */
function toggleMenu() {
    menuOpen = !menuOpen;
    dom.menuPanel.classList.toggle('open', menuOpen);
    dom.saveLoadArea.classList.add('hidden');
}

function handleNewGame() {
    if (!confirm('Start a new game? All unsaved progress will be lost.')) return;
    gs = freshState();
    normalizeState();
    manualSpeedMultiplier = 1;
    visualCamels = [];
    audioUnlocked = false;
    logDirty = true;
    lastWallTime = Date.now();
    menuOpen = false;
    dom.menuPanel.classList.remove('open');
    updateUI();
}

function handleSaveGame() {
    dom.saveLoadArea.classList.remove('hidden');
    dom.saveLoadText.value = encodeSave(gs);
    dom.saveLoadText.readOnly = true;
    dom.saveLoadConfirm.classList.add('hidden');
    dom.saveLoadText.select();
    try { navigator.clipboard.writeText(dom.saveLoadText.value); } catch (_) { /* noop */ }
}

function handleLoadGame() {
    dom.saveLoadArea.classList.remove('hidden');
    dom.saveLoadText.value = '';
    dom.saveLoadText.readOnly = false;
    dom.saveLoadConfirm.classList.remove('hidden');
    dom.saveLoadText.placeholder = 'Paste save code here...';
}

function confirmLoad() {
    try {
        const loaded = decodeSave(dom.saveLoadText.value.trim());
        gs = Object.assign(freshState(), loaded);
        normalizeState();
        visualCamels = [];
        lastWallTime = Date.now();
        addLog('Game loaded successfully!');
        menuOpen = false;
        dom.menuPanel.classList.remove('open');
        updateUI();
    } catch (e) {
        alert('Invalid save code!');
    }
}

function encodeSave(state) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

function decodeSave(str) {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
}

function toggleMusic() {
    musicEnabled = !musicEnabled;
    if (musicEnabled && audioUnlocked) {
        backgroundMusic.play().catch(() => {});
    } else {
        backgroundMusic.pause();
    }
    dom.toggleMusicBtn.textContent = musicEnabled ? '🎵 Music: ON' : '🎵 Music: OFF';
}

function toggleSfx() {
    sfxEnabled = !sfxEnabled;
    dom.toggleSfxBtn.textContent = sfxEnabled ? '🔊 SFX: ON' : '🔊 SFX: OFF';
}

function openHotdogPage() {
    if (!(gs.hotdogsEverCollected || gs.hotdogs >= 10)) {
        return;
    }
    const photos = [
        'hotdogs/Beatings10.webp',
        'hotdogs/Camel-dragged-egypt-camel-investigation.webp',
        'hotdogs/Camel-market-5.webp',
        'hotdogs/camel-unique-knee-pain-dbf39741.jpeg',
        'hotdogs/default.avif',
        'hotdogs/df3cc22c-86af-4f54-ae9c-3d4a13ab1135_16x9_1200x676.webp',
        'hotdogs/e9a773d70f4673cc8b5a39538be1146c.jpeg',
        'hotdogs/images (2).jpeg',
        'hotdogs/images (3).jpeg',
        'hotdogs/images (4).jpeg',
        'hotdogs/Man-beating-camel-with-stick.webp',
        'hotdogs/merlin_150570327_717f499f-c841-49e7-af12-03fdb47a5ed0-articleLarge.webp'
    ];
    const base = window.location.href.replace(/[^/]*$/, '');
    const imgs = photos.map(p =>
        '<img src="' + base + p + '" style="width:100%;max-width:700px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.4);">'
    ).join('');
    const w = window.open('', '_blank');
    if (w) {
        w.document.write(
            '<!DOCTYPE html><html><head><title>🌭 Hotdog</title></head>' +
            '<body style="margin:0;padding:40px 20px;background:#1a1410;font-family:Arial,sans-serif;' +
            'display:flex;flex-direction:column;align-items:center;gap:24px;">' +
            '<h1 style="color:#FFD700;font-size:2em;margin:0;">🌭 Hotdog 🌭</h1>' +
            '<p style="margin-top:-12px;color:#d8c49a;font-size:14px;">think of what you did in pursuit of hotdogs</p>' +
            imgs +
            '</body></html>'
        );
        w.document.close();
    }
}

/* ============================================================
   TOOLTIP SYSTEM
   ============================================================ */
function setupTooltips() {
    document.addEventListener('pointerenter', e => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;
        dom.tooltip.textContent = target.dataset.tooltip;
        dom.tooltip.classList.remove('hidden');
        positionTooltip(target);
    }, true);

    document.addEventListener('pointerleave', e => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;
        dom.tooltip.classList.add('hidden');
    }, true);
}

function positionTooltip(anchor) {
    const rect = anchor.getBoundingClientRect();
    const tt = dom.tooltip;
    tt.style.top = (rect.bottom + 8) + 'px';
    tt.style.left = rect.left + 'px';

    requestAnimationFrame(() => {
        const ttRect = tt.getBoundingClientRect();
        if (ttRect.right > window.innerWidth - 8) {
            tt.style.left = Math.max(8, window.innerWidth - ttRect.width - 8) + 'px';
        }
        if (ttRect.bottom > window.innerHeight - 8) {
            tt.style.top = (rect.top - ttRect.height - 8) + 'px';
        }
    });
}

/* ============================================================
   CHEAT SYSTEM (hold Shift = 4x game speed)
   ============================================================ */
function updateCheatMultiplier() {
    cheatMultiplier = keysHeld['shift'] ? 4 : 1;
}

/* ============================================================
   GAME LOGIC TICK (runs via setInterval — works in background tabs)
   ============================================================ */
function backgroundLogicTick() {
    const now = Date.now();
    const deltaSec = Math.min((now - lastWallTime) / 1000, 3600);
    lastWallTime = now;
    if (deltaSec <= 0) return;

    const simulationDeltaSec = deltaSec * getTimeMultiplier();
    const previousDay = gs.currentGameDay;

    advanceGameTime(simulationDeltaSec);
    const elapsedGameDays = gs.currentGameDay - previousDay;
    updateAutoProduction(simulationDeltaSec);
    updateMineProduction(elapsedGameDays);

    checkCaravanCompletions();
    checkBanquetCompletions();
    checkRaceCompletions();
    checkConversionCompletions();
    checkFarmUpkeep(elapsedGameDays);
    checkUnlocks();
}

/* ============================================================
   RENDER LOOP (rAF — only when tab is visible)
   ============================================================ */
function renderLoop(timestamp) {
    updatePhysics();
    render();
    updateUI();
    updateSlowUI(timestamp);

    requestAnimationFrame(renderLoop);
}

/* ============================================================
   START
   ============================================================ */
window.addEventListener('load', init);

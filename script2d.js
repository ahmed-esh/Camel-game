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
const FIRST_CARAVAN_DURATION = 1;
const CARAVAN_DURATION_MIN = 3;
const CARAVAN_DURATION_MAX = 7;
const FARM_COST_SILVER = 99;
const FARM_COST_GOLD = 1;
const FARM_WORKER_GRASS_PER_DAY = 100;
const FARM_WORKER_SALARY_SILVER_PER_DAY = 1;
const SILVER_MINE_COST_CAMELS = 1000;
const GOLD_MINE_COST_CAMELS = 5000;
const SILVER_MINE_UPGRADE_ONE_COST = 10000;
const SILVER_MINE_UPGRADE_TWO_COST = 25000;
const GOLD_MINE_UPGRADE_ONE_COST = 10000;
const GOLD_MINE_UPGRADE_TWO_COST = 25000;
const SILVER_MINE_BASE_CAPACITY = 100;
const SILVER_MINE_CAPACITY_L1 = 1000;
const SILVER_MINE_CAPACITY_L2 = 10000;
const GOLD_MINE_BASE_CAPACITY = 50;
const GOLD_MINE_CAPACITY_L1 = 500;
const GOLD_MINE_CAPACITY_L2 = 1000;
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
const BUTTON_SMASHER_COST_CAMELS = 500;
const BUTTON_SMASHER_PRESSES_PER_DAY = 20;
const SCOUT_COST_GOLD = 5;
const SCOUT_DURATION_MIN = 5;
const SCOUT_DURATION_MAX = 8;
const SCOUT_WORKERS_MIN = 1;
const SCOUT_WORKERS_MAX = 3;
const MAX_VISUAL_CAMELS = 400;
const MAX_LOG_ENTRIES = 5;
const GAME_EPOCH = new Date(2014, 9, 24);
const SLOW_UI_INTERVAL = 500;
const STORAGE_KEY = 'camel-management-autosave-v1';
const AUTOSAVE_INTERVAL_MS = 15000;
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
        grass: 0,
        workers: 0,
        hotdogs: 0,
        warriorCamels: 0,
        spawnTimer: 0,
        buttonSmashers: 0,
        buttonSmasherProgress: 0,
        caravans: [],
        scouts: [],
        farm: {
            owned: false,
            name: '',
            enabled: true,
            payMode: 'silver',
            upkeepProgress: 0,
            assignedWorkers: 0
        },
        silverMine: {
            owned: false,
            name: '',
            upgradeLevel: 0,
            assignedCamels: 0,
            progress: 0,
            digEndAtMs: 0
        },
        goldMine: {
            owned: false,
            name: '',
            upgradeLevel: 0,
            assignedCamels: 0,
            progress: 0
        },
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
        scoutUnlocked: false,
        mineSilverUnlocked: false,
        mineGoldUnlocked: false,
        firstCamelAudioPromptShown: false,
        princeMineRewardGiven: false,
        princeWorkerGiftGiven: false,
        firstCaravanSent: false,
        hotdogPageUnlocked: false,
        marketItems: [],
        silverEverCollected: false,
        goldEverCollected: false,
        grassEverCollected: false,
        workersEverCollected: false,
        hotdogsEverCollected: false,
        warriorCamelsEverCollected: false,
        log: []
    };
}

function normalizeState() {
    // Legacy migration from previous saves
    if ((!gs.farm || !gs.farm.owned) && Array.isArray(gs.farms) && gs.farms.length > 0) {
        gs.farm = {
            owned: true,
            name: gs.farms[0].name || pickRandomName(FARM_NAME_POOL),
            enabled: gs.farms[0].enabled !== false,
            payMode: gs.farms[0].payMode === 'gold' ? 'gold' : 'silver',
            upkeepProgress: 0
        };
    }
    if ((!gs.silverMine || !gs.silverMine.owned) && Array.isArray(gs.silverMines) && gs.silverMines.length > 0) {
        gs.silverMine = {
            owned: true,
            name: gs.silverMines[0].name || pickRandomName(MINE_NAME_POOL),
            upgradeLevel: 0,
            assignedCamels: 0,
            progress: Number.isFinite(gs.mineSilverProgress) ? gs.mineSilverProgress : 0
        };
    }
    if ((!gs.goldMine || !gs.goldMine.owned) && Array.isArray(gs.goldMines) && gs.goldMines.length > 0) {
        gs.goldMine = {
            owned: true,
            name: gs.goldMines[0].name || pickRandomName(MINE_NAME_POOL),
            upgradeLevel: 0,
            assignedCamels: 0,
            progress: Number.isFinite(gs.mineGoldProgress) ? gs.mineGoldProgress : 0
        };
    }

    gs.grass = Number.isFinite(gs.grass) ? gs.grass : 0;
    gs.workers = Number.isFinite(gs.workers) ? gs.workers : 0;
    gs.buttonSmashers = Number.isFinite(gs.buttonSmashers) ? gs.buttonSmashers : 0;
    gs.buttonSmasherProgress = Number.isFinite(gs.buttonSmasherProgress) ? gs.buttonSmasherProgress : 0;
    gs.scouts = Array.isArray(gs.scouts) ? gs.scouts : [];

    gs.farm = gs.farm && typeof gs.farm === 'object' ? gs.farm : {
        owned: false,
        name: '',
        enabled: true,
        payMode: 'silver',
        upkeepProgress: 0
    };
    gs.farm.owned = Boolean(gs.farm.owned);
    gs.farm.name = gs.farm.name || pickRandomName(FARM_NAME_POOL);
    gs.farm.enabled = gs.farm.enabled !== false;
    gs.farm.payMode = gs.farm.payMode === 'gold' ? 'gold' : 'silver';
    gs.farm.upkeepProgress = Number.isFinite(gs.farm.upkeepProgress) ? gs.farm.upkeepProgress : 0;
    gs.farm.assignedWorkers = Number.isFinite(gs.farm.assignedWorkers) ? Math.max(0, gs.farm.assignedWorkers) : 0;

    gs.silverMine = gs.silverMine && typeof gs.silverMine === 'object' ? gs.silverMine : { owned: false, name: '', upgradeLevel: 0, assignedCamels: 0, progress: 0 };
    gs.silverMine.owned = Boolean(gs.silverMine.owned);
    gs.silverMine.name = gs.silverMine.name || pickRandomName(MINE_NAME_POOL);
    gs.silverMine.upgradeLevel = Number.isFinite(gs.silverMine.upgradeLevel) ? Math.max(0, Math.min(2, gs.silverMine.upgradeLevel)) : 0;
    gs.silverMine.assignedCamels = Number.isFinite(gs.silverMine.assignedCamels) ? Math.max(0, gs.silverMine.assignedCamels) : 0;
    gs.silverMine.progress = Number.isFinite(gs.silverMine.progress) ? gs.silverMine.progress : 0;
    gs.silverMine.digEndAtMs = Number.isFinite(gs.silverMine.digEndAtMs) ? gs.silverMine.digEndAtMs : 0;

    gs.goldMine = gs.goldMine && typeof gs.goldMine === 'object' ? gs.goldMine : { owned: false, name: '', upgradeLevel: 0, assignedCamels: 0, progress: 0 };
    gs.goldMine.owned = Boolean(gs.goldMine.owned);
    gs.goldMine.name = gs.goldMine.name || pickRandomName(MINE_NAME_POOL);
    gs.goldMine.upgradeLevel = Number.isFinite(gs.goldMine.upgradeLevel) ? Math.max(0, Math.min(2, gs.goldMine.upgradeLevel)) : 0;
    gs.goldMine.assignedCamels = Number.isFinite(gs.goldMine.assignedCamels) ? Math.max(0, gs.goldMine.assignedCamels) : 0;
    gs.goldMine.progress = Number.isFinite(gs.goldMine.progress) ? gs.goldMine.progress : 0;

    gs.mineSilverUnlocked = Boolean(gs.mineSilverUnlocked) || gs.camelCount >= SILVER_MINE_COST_CAMELS || gs.silverMine.owned;
    gs.mineGoldUnlocked = Boolean(gs.mineGoldUnlocked) || gs.camelCount >= GOLD_MINE_COST_CAMELS || gs.goldMine.owned;
    gs.grassEverCollected = Boolean(gs.grassEverCollected) || gs.grass > 0;
    gs.workersEverCollected = Boolean(gs.workersEverCollected) || gs.workers > 0;
    gs.firstCamelAudioPromptShown = Boolean(gs.firstCamelAudioPromptShown);
    gs.princeMineRewardGiven = Boolean(gs.princeMineRewardGiven);
    gs.princeWorkerGiftGiven = Boolean(gs.princeWorkerGiftGiven);
    gs.hotdogPageUnlocked = Boolean(gs.hotdogPageUnlocked) || gs.hotdogs >= 10;
    if (!Array.isArray(gs.marketItems) || gs.marketItems.length === 0) {
        gs.marketItems = createInitialMarketItems();
    }
    if (gs.farm.assignedWorkers > gs.workers) {
        gs.farm.assignedWorkers = gs.workers;
    }
}

function pickRandomName(pool) {
    return pool[Math.floor(Math.random() * pool.length)];
}

function createInitialMarketItems() {
    const labels = ['Salt Bundle', 'Desert Rope', 'Caravan Wheel', 'Water Skin', 'Fine Saddle', 'Spice Box'];
    return labels.map((name, index) => ({
        id: `market-${index}`,
        name,
        goldPrice: 1 + Math.floor(Math.random() * 12),
        silverPrice: 5 + Math.floor(Math.random() * 80)
    }));
}

function saveToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            gs,
            musicEnabled,
            sfxEnabled,
            manualSpeedMultiplier
        }));
    } catch (error) {
        console.warn('Autosave failed:', error);
    }
}

function loadAutosaveState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.gs) {
            musicEnabled = parsed.musicEnabled !== false;
            sfxEnabled = parsed.sfxEnabled !== false;
            manualSpeedMultiplier = parsed.manualSpeedMultiplier === 2 ? 2 : 1;
            return Object.assign(freshState(), parsed.gs);
        }
    } catch (error) {
        console.warn('Autosave load failed:', error);
    }
    return null;
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
let autosaveInterval = null;
let smasherVisuals = [];
let lastManualSpawnClickMs = 0;
let pendingSmasherHitBursts = 0;
let activePrinceEvent = null;
let princeMessageShown = false;

/* ============================================================
   INITIALIZATION
   ============================================================ */
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();

    loadCamelImage();
    setupAudio();

    gs = loadAutosaveState() || freshState();
    normalizeState();

    cacheDOMRefs();
    setupEventListeners();
    setupTooltips();
    updateUI();
    updateSpeedButton();
    dom.toggleMusicBtn.textContent = musicEnabled ? '🎵 Music: ON' : '🎵 Music: OFF';
    dom.toggleSfxBtn.textContent = sfxEnabled ? '🔊 SFX: ON' : '🔊 SFX: OFF';
    rebuildSmasherVisuals();

    lastWallTime = Date.now();

    logicInterval = setInterval(backgroundLogicTick, 1000);
    autosaveInterval = setInterval(() => saveToLocalStorage(), AUTOSAVE_INTERVAL_MS);

    requestAnimationFrame(renderLoop);
}

function cacheDOMRefs() {
    dom.spawnBtn = document.getElementById('spawnButton');
    dom.shovelBtn = document.getElementById('shovelButton');
    dom.smasherLayer = document.getElementById('smasherLayer');
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
    dom.audioChoiceOverlay = document.getElementById('audioChoiceOverlay');
    dom.keepAudioBtn = document.getElementById('keepAudioBtn');
    dom.disableAudioBtn = document.getElementById('disableAudioBtn');
    dom.princeEvent = document.getElementById('princeEvent');
    dom.princeBubble = document.getElementById('princeBubble');
}

function setupEventListeners() {
    dom.spawnBtn.addEventListener('click', handleSpawnClick);
    dom.shovelBtn.addEventListener('click', handleShovelClick);
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
    dom.keepAudioBtn.addEventListener('click', () => handleAudioChoice(true));
    dom.disableAudioBtn.addEventListener('click', () => handleAudioChoice(false));
    dom.princeEvent.addEventListener('click', handlePrinceClick);

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
    if (action === 'caravan') handleCaravanClick();
    else if (action === 'hunt') handleHuntClick();
    else if (action === 'banquet') handleBanquetClick();
    else if (action === 'race') handleRaceClick();
    else if (action === 'buySmasher') buyButtonSmasher();
    else if (action === 'scout') launchScout();
    else if (action === 'farmAddWorker') adjustFarmWorkers(1);
    else if (action === 'farmRemoveWorker') adjustFarmWorkers(-1);
    else if (action === 'farmPayToggle') gs.farm.payMode = gs.farm.payMode === 'silver' ? 'gold' : 'silver';
    else if (action === 'farmSilver') buyFarmWithSilver();
    else if (action === 'farmGold') buyFarmWithGold();
    else if (action === 'mineSilver') buildSilverMine();
    else if (action === 'mineGold') buildGoldMine();
    else if (action === 'upgradeSilverMine') upgradeSilverMine();
    else if (action === 'upgradeGoldMine') upgradeGoldMine();
    else if (action === 'assignSilverMinePlus') adjustMineAssignment('silver', 1);
    else if (action === 'assignSilverMineMinus') adjustMineAssignment('silver', -1);
    else if (action === 'assignGoldMinePlus') adjustMineAssignment('gold', 1);
    else if (action === 'assignGoldMineMinus') adjustMineAssignment('gold', -1);
    else if (action === 'silverMineDig') startSilverMineDig();
    else if (action === 'marketClick') triggerMarketReaction(btn);
    else if (action === 'university') buildUniversity();
    else if (action === 'convert') startConversion();
    saveToLocalStorage();
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
        dom.ownershipTitle.textContent = 'Farm Management';
        if (!gs.farm.owned) {
            dom.ownershipContent.innerHTML = '<div class="proc-row faded">No farms built yet.</div>';
            return;
        }
        const farmStatus = gs.farm.enabled ? 'ON' : 'OFF';
        dom.ownershipContent.innerHTML = '<div class="owned-row">' +
            '<div class="owned-title">🏡 ' + gs.farm.name + '</div>' +
            '<div class="owned-sub">Status: ' + farmStatus + ' · Workers: ' + gs.workers + '</div>' +
            '<div class="owned-controls">' +
            '<button class="inv-btn" data-owned-action="farmToggle">' + (gs.farm.enabled ? 'Turn OFF' : 'Turn ON') + '</button>' +
            '<span class="owned-sub no-margin">Pay with</span>' +
            '<button class="pay-switch" data-owned-action="farmPayToggle"' + (gs.farm.enabled ? '' : ' disabled') + '>' +
            '<span class="pay-option' + (gs.farm.payMode === 'silver' ? ' active' : '') + '">Silver</span>' +
            '<span class="pay-option' + (gs.farm.payMode === 'gold' ? ' active' : '') + '">Gold</span>' +
            '</button>' +
            '</div></div>';
        return;
    }

    dom.ownershipTitle.textContent = 'Mine Management';
    const allMines = [];
    if (gs.silverMine.owned) {
        allMines.push({
            key: 'silver',
            type: 'Silver Mine',
            rate: '5 camels -> 1 silver/day',
            name: gs.silverMine.name,
            assigned: gs.silverMine.assignedCamels,
            capacity: getSilverMineCapacity()
        });
    }
    if (gs.goldMine.owned) {
        allMines.push({
            key: 'gold',
            type: 'Gold Mine',
            rate: '1 camel -> 1 gold/10 days',
            name: gs.goldMine.name,
            assigned: gs.goldMine.assignedCamels,
            capacity: getGoldMineCapacity()
        });
    }
    if (allMines.length === 0) {
        dom.ownershipContent.innerHTML = '<div class="proc-row faded">No mines built yet.</div>';
        return;
    }
    dom.ownershipContent.innerHTML = allMines.map(mine =>
        '<div class="owned-row">' +
        '<div class="owned-title">⛏️ ' + mine.name + '</div>' +
        '<div class="owned-sub">' + mine.type + ' · ' + mine.rate + ' · Assigned: ' + mine.assigned + '/' + mine.capacity + '</div>' +
        '<div class="owned-controls">' +
        '<button class="inv-btn" data-owned-action="mineAssignMinus" data-mine-kind="' + mine.key + '">-1 Camel</button>' +
        '<button class="inv-btn" data-owned-action="mineAssignPlus" data-mine-kind="' + mine.key + '">+1 Camel</button>' +
        '</div>' +
        '</div>'
    ).join('');
}

function handleOwnedPanelClick(e) {
    const btn = e.target.closest('[data-owned-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.ownedAction;
    if (action === 'farmToggle') toggleFarmState();
    else if (action === 'farmPayToggle') gs.farm.payMode = gs.farm.payMode === 'silver' ? 'gold' : 'silver';
    else if (action === 'mineAssignPlus') adjustMineAssignment(btn.dataset.mineKind, 1);
    else if (action === 'mineAssignMinus') adjustMineAssignment(btn.dataset.mineKind, -1);
    renderOwnershipPanel();
    saveToLocalStorage();
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
    lastManualSpawnClickMs = Date.now();
    if (!gs.firstCamelAudioPromptShown) {
        gs.firstCamelAudioPromptShown = true;
        dom.audioChoiceOverlay.classList.remove('hidden');
    }
    unlockAudio();
    if (!camelImage.complete) return;
    spawnCamel(true);
    saveToLocalStorage();
}

function handleAudioChoice(keepAudio) {
    dom.audioChoiceOverlay.classList.add('hidden');
    if (keepAudio) {
        musicEnabled = true;
        sfxEnabled = true;
        if (audioUnlocked) {
            backgroundMusic.play().catch(() => {});
        }
    } else {
        musicEnabled = false;
        sfxEnabled = false;
        backgroundMusic.pause();
    }
    dom.toggleMusicBtn.textContent = musicEnabled ? '🎵 Music: ON' : '🎵 Music: OFF';
    dom.toggleSfxBtn.textContent = sfxEnabled ? '🔊 SFX: ON' : '🔊 SFX: OFF';
    saveToLocalStorage();
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
    let totalCamels = 0;
    if (intervals > 0) {
        gs.spawnTimer -= intervals * CAMEL_SPAWN_INTERVAL;
        totalCamels += intervals; // Base production only
    }

    const smasherCap = gs.camelCount >= 100000 ? 50 : 5;
    const effectiveSmashers = Math.min(gs.buttonSmashers, smasherCap);

    // Button smashers auto-click Drop button
    gs.buttonSmasherProgress += effectiveSmashers * BUTTON_SMASHER_PRESSES_PER_DAY * (deltaSec / SECONDS_PER_GAME_DAY);
    const smasherPresses = Math.floor(gs.buttonSmasherProgress);
    if (smasherPresses > 0) {
        gs.buttonSmasherProgress -= smasherPresses;
        totalCamels += smasherPresses;
        if (Date.now() - lastManualSpawnClickMs > 800) {
            pendingSmasherHitBursts += smasherPresses;
        }
    }

    if (totalCamels > 0) {
        gs.camelCount += totalCamels;
        const visualToSpawn = Math.min(totalCamels, 15);
        for (let i = 0; i < visualToSpawn; i++) {
            createCamelEntity();
        }
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
    if (gs.farm.owned || gs.silver < FARM_COST_SILVER) return;
    playSfx('farm');
    gs.silver -= FARM_COST_SILVER;
    gs.farm.owned = true;
    gs.farm.enabled = true;
    gs.farm.payMode = 'silver';
    gs.farm.name = pickRandomName(FARM_NAME_POOL);
    gs.scoutUnlocked = true;
    addLog('Farm built! It now produces grass with workers.');

    if (!gs.princeWorkerGiftGiven) {
        gs.princeWorkerGiftGiven = true;
        gs.workers += 1;
        gs.workersEverCollected = true;
        queuePrinceEvent('The prince, impressed by your ambition, gifts you a worker to help your farm.');
    }
}

function buyFarmWithGold() {
    if (gs.farm.owned || gs.gold < FARM_COST_GOLD) return;
    playSfx('farm');
    gs.gold -= FARM_COST_GOLD;
    gs.farm.owned = true;
    gs.farm.enabled = true;
    gs.farm.payMode = 'silver';
    gs.farm.name = pickRandomName(FARM_NAME_POOL);
    gs.scoutUnlocked = true;
    addLog('Farm built! It now produces grass with workers.');

    if (!gs.princeWorkerGiftGiven) {
        gs.princeWorkerGiftGiven = true;
        gs.workers += 1;
        gs.workersEverCollected = true;
        queuePrinceEvent('The prince, impressed by your ambition, gifts you a worker to help your farm.');
    }
}

function checkFarmProduction(elapsedGameDays) {
    if (!gs.farm.owned || gs.farm.assignedWorkers <= 0) return;

    gs.farm.upkeepProgress += gs.farm.assignedWorkers * FARM_WORKER_SALARY_SILVER_PER_DAY * elapsedGameDays;
    const payableUnits = Math.floor(gs.farm.upkeepProgress);

    if (payableUnits > 0) {
        if (gs.farm.payMode === 'silver') {
            const paid = Math.min(payableUnits, Math.floor(gs.silver));
            gs.silver -= paid;
            gs.farm.upkeepProgress -= paid;
        } else {
            const paid = Math.min(payableUnits, Math.floor(gs.gold));
            gs.gold -= paid;
            gs.farm.upkeepProgress -= paid;
        }
    }

    // If the required payable upkeep remains, workers stop until debt clears
    const hasDebt = gs.farm.upkeepProgress >= 1;
    if (hasDebt) {
        return;
    }

    gs.grass += gs.farm.assignedWorkers * FARM_WORKER_GRASS_PER_DAY * elapsedGameDays;
    gs.grassEverCollected = true;
}

function toggleFarmState() {
    if (!gs.farm.owned) return;
    gs.farm.enabled = !gs.farm.enabled;
    if (!gs.farm.enabled) {
        addLog(gs.farm.name + ' turned OFF. Worker salaries are paused.');
    } else {
        addLog(gs.farm.name + ' turned ON.');
    }
}

function adjustFarmWorkers(delta) {
    if (!gs.farm.owned) return;
    gs.farm.assignedWorkers = Math.max(0, Math.min(gs.workers, gs.farm.assignedWorkers + delta));
}

function buildSilverMine() {
    if (gs.silverMine.owned || gs.camelCount < SILVER_MINE_COST_CAMELS) return;
    playSfx('mine');
    gs.camelCount -= SILVER_MINE_COST_CAMELS;
    gs.silverMine.owned = true;
    gs.silverMine.name = pickRandomName(MINE_NAME_POOL);
    gs.silverMine.upgradeLevel = 0;
    gs.silverMine.assignedCamels = 0;
    gs.silverMine.digEndAtMs = 0;
    addLog('Silver mine built! Assign camels in Mine Management.');
}

function buildGoldMine() {
    if (gs.goldMine.owned || gs.camelCount < GOLD_MINE_COST_CAMELS) return;
    playSfx('mine');
    gs.camelCount -= GOLD_MINE_COST_CAMELS;
    gs.goldMine.owned = true;
    gs.goldMine.name = pickRandomName(MINE_NAME_POOL);
    gs.goldMine.upgradeLevel = 0;
    gs.goldMine.assignedCamels = 0;
    addLog('Gold mine built! Assign camels in Mine Management.');
}

function getSilverMineCapacity() {
    if (!gs.silverMine.owned) return 0;
    if (gs.silverMine.upgradeLevel >= 2) return SILVER_MINE_CAPACITY_L2;
    if (gs.silverMine.upgradeLevel >= 1) return SILVER_MINE_CAPACITY_L1;
    return SILVER_MINE_BASE_CAPACITY;
}

function getGoldMineCapacity() {
    if (!gs.goldMine.owned) return 0;
    if (gs.goldMine.upgradeLevel >= 2) return GOLD_MINE_CAPACITY_L2;
    if (gs.goldMine.upgradeLevel >= 1) return GOLD_MINE_CAPACITY_L1;
    return GOLD_MINE_BASE_CAPACITY;
}

function upgradeSilverMine() {
    if (!gs.silverMine.owned) return;
    if (gs.silverMine.upgradeLevel === 0 && gs.camelCount >= SILVER_MINE_UPGRADE_ONE_COST) {
        gs.camelCount -= SILVER_MINE_UPGRADE_ONE_COST;
        gs.silverMine.upgradeLevel = 1;
        addLog(gs.silverMine.name + ' upgraded to capacity ' + SILVER_MINE_CAPACITY_L1 + '.');
    } else if (gs.silverMine.upgradeLevel === 1 && gs.camelCount >= SILVER_MINE_UPGRADE_TWO_COST) {
        gs.camelCount -= SILVER_MINE_UPGRADE_TWO_COST;
        gs.silverMine.upgradeLevel = 2;
        addLog(gs.silverMine.name + ' upgraded to capacity ' + SILVER_MINE_CAPACITY_L2 + '.');
    }
}

function upgradeGoldMine() {
    if (!gs.goldMine.owned) return;
    if (gs.goldMine.upgradeLevel === 0 && gs.camelCount >= GOLD_MINE_UPGRADE_ONE_COST) {
        gs.camelCount -= GOLD_MINE_UPGRADE_ONE_COST;
        gs.goldMine.upgradeLevel = 1;
        addLog(gs.goldMine.name + ' upgraded to capacity ' + GOLD_MINE_CAPACITY_L1 + '.');
    } else if (gs.goldMine.upgradeLevel === 1 && gs.camelCount >= GOLD_MINE_UPGRADE_TWO_COST) {
        gs.camelCount -= GOLD_MINE_UPGRADE_TWO_COST;
        gs.goldMine.upgradeLevel = 2;
        addLog(gs.goldMine.name + ' upgraded to capacity ' + GOLD_MINE_CAPACITY_L2 + '.');
    }
}

function adjustMineAssignment(kind, delta) {
    const mine = kind === 'gold' ? gs.goldMine : gs.silverMine;
    if (!mine.owned) return;
    const capacity = kind === 'gold' ? getGoldMineCapacity() : getSilverMineCapacity();
    if (delta > 0) {
        if (gs.grass <= 0) return;
        if (mine.assignedCamels >= capacity) return;
        if (gs.camelCount <= 0) return;
        mine.assignedCamels += 1;
        gs.camelCount -= 1;
    } else if (delta < 0) {
        if (mine.assignedCamels <= 0) return;
        mine.assignedCamels -= 1;
        gs.camelCount += 1;
    }
}

function updateMineProduction(elapsedGameDays) {
    const totalAssigned = gs.silverMine.assignedCamels + gs.goldMine.assignedCamels;
    if (totalAssigned <= 0 || elapsedGameDays <= 0) return;

    const grassNeeded = totalAssigned * elapsedGameDays;
    const grassUsed = Math.min(gs.grass, grassNeeded);
    gs.grass -= grassUsed;
    const efficiency = grassNeeded > 0 ? (grassUsed / grassNeeded) : 0;

    const effectiveSilverCamels = gs.silverMine.assignedCamels * efficiency;
    const effectiveGoldCamels = gs.goldMine.assignedCamels * efficiency;

    if (gs.silverMine.owned && effectiveSilverCamels > 0) {
        gs.silverMine.progress += (effectiveSilverCamels / 5) * elapsedGameDays;
        const wholeSilver = Math.floor(gs.silverMine.progress);
        if (wholeSilver > 0) {
            gs.silver += wholeSilver;
            gs.silverMine.progress -= wholeSilver;
            gs.silverEverCollected = true;
        }
    }

    if (gs.goldMine.owned && effectiveGoldCamels > 0) {
        gs.goldMine.progress += (effectiveGoldCamels / 10) * elapsedGameDays;
        const wholeGold = Math.floor(gs.goldMine.progress);
        if (wholeGold > 0) {
            gs.gold += wholeGold;
            gs.goldMine.progress -= wholeGold;
            gs.goldEverCollected = true;
        }
    }
}

function startSilverMineDig() {
    if (!gs.silverMine.owned) return;
    if (Date.now() < gs.silverMine.digEndAtMs) return;
    gs.silverMine.digEndAtMs = Date.now() + 15000;
}

function checkSilverMineDigCompletion() {
    if (!gs.silverMine.owned || gs.silverMine.digEndAtMs <= 0) return;
    if (Date.now() >= gs.silverMine.digEndAtMs) {
        gs.silverMine.digEndAtMs = 0;
        gs.silver += 1;
        gs.silverEverCollected = true;
        addLog('Silver mine DIG completed. +1 silver.');
    }
}

function triggerMarketReaction(buttonEl) {
    if (!buttonEl) return;
    buttonEl.classList.add('react');
    setTimeout(() => buttonEl.classList.remove('react'), 300);
}

function launchScout() {
    if (!gs.scoutUnlocked || gs.gold < SCOUT_COST_GOLD) return;
    gs.gold -= SCOUT_COST_GOLD;
    const duration = SCOUT_DURATION_MIN + Math.floor(Math.random() * (SCOUT_DURATION_MAX - SCOUT_DURATION_MIN + 1));
    gs.scouts.push({
        returnDay: gs.currentGameDay + duration
    });
    addLog('Scout sent out. Returns in ' + duration + ' days.');
}

function checkScoutReturns() {
    for (let i = gs.scouts.length - 1; i >= 0; i--) {
        if (gs.currentGameDay >= gs.scouts[i].returnDay) {
            gs.scouts.splice(i, 1);
            const hired = SCOUT_WORKERS_MIN + Math.floor(Math.random() * (SCOUT_WORKERS_MAX - SCOUT_WORKERS_MIN + 1));
            gs.workers += hired;
            gs.workersEverCollected = true;
            addLog('Scout returned with ' + hired + ' worker(s).');
        }
    }
}

function buyButtonSmasher() {
    if (gs.camelCount < BUTTON_SMASHER_COST_CAMELS) return;
    gs.camelCount -= BUTTON_SMASHER_COST_CAMELS;
    gs.buttonSmashers += 1;
    rebuildSmasherVisuals();
    addLog('Button smasher deployed. Auto-pressing the drop button.');
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

    if (!gs.princeMineRewardGiven && gs.camelCount >= 250) {
        gs.princeMineRewardGiven = true;
        gs.mineSilverUnlocked = true;
        if (!gs.silverMine.owned) {
            gs.silverMine.owned = true;
            gs.silverMine.name = pickRandomName(MINE_NAME_POOL);
        }
        queuePrinceEvent('You are doing great work! A prince wanted to award you a mine!');
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
    saveToLocalStorage();
}

function queuePrinceEvent(message) {
    activePrinceEvent = message;
    princeMessageShown = false;
    dom.princeBubble.classList.add('hidden');
    dom.princeBubble.textContent = message;
    dom.princeEvent.classList.remove('hidden');
    requestAnimationFrame(() => dom.princeEvent.classList.add('visible'));
}

function handlePrinceClick() {
    if (!activePrinceEvent) return;
    if (!princeMessageShown) {
        princeMessageShown = true;
        dom.princeBubble.classList.remove('hidden');
        return;
    }
    dom.princeEvent.classList.remove('visible');
    dom.princeBubble.classList.add('hidden');
    const message = activePrinceEvent;
    activePrinceEvent = null;
    setTimeout(() => {
        dom.princeEvent.classList.add('hidden');
    }, 350);
    addLog(message);
}

/* ============================================================
   UI UPDATES
   ============================================================ */
function updateUI() {
    dom.camelDisplay.textContent = fmtNum(gs.camelCount);
    updateSpeedButton();
    const smasherCap = gs.camelCount >= 100000 ? 50 : 5;
    const desiredSmasherVisuals = Math.min(gs.buttonSmashers, smasherCap);
    if (smasherVisuals.length !== desiredSmasherVisuals) {
        rebuildSmasherVisuals();
    }

    const productionPerSixSeconds = 1 + Math.floor(gs.buttonSmashers * BUTTON_SMASHER_PRESSES_PER_DAY * (CAMEL_SPAWN_INTERVAL / SECONDS_PER_GAME_DAY));
    dom.camelCounterIcon.dataset.tooltip =
        `Camel production: ${productionPerSixSeconds} camel(s) every 6 real seconds (base + button smashers).`;

    dom.shovelBtn.classList.toggle('hidden', !gs.shovelUnlocked);

    if (!gs.hotdogPageUnlocked && gs.hotdogs >= 10) {
        gs.hotdogPageUnlocked = true;
    }
    const hotdogUnlocked = gs.hotdogPageUnlocked;
    dom.hotdogBtn.disabled = !hotdogUnlocked;
    if (hotdogUnlocked) {
        dom.hotdogBtn.textContent = '🌭 Hotdog';
        dom.hotdogBtn.dataset.tooltip = 'hotdog!';
    } else {
        dom.hotdogBtn.textContent = '🌭 Hotdog (Locked)';
        dom.hotdogBtn.dataset.tooltip = 'Unlocks when you get 10 hotdog.';
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

function rebuildSmasherVisuals() {
    if (!dom.smasherLayer) return;
    dom.smasherLayer.innerHTML = '';
    smasherVisuals = [];
    const smasherCap = gs.camelCount >= 100000 ? 50 : 5;
    const visibleSmashers = Math.min(gs.buttonSmashers, smasherCap);
    for (let i = 0; i < visibleSmashers; i++) {
        const el = document.createElement('div');
        el.className = 'smasher-camel';
        el.textContent = '🐪';
        dom.smasherLayer.appendChild(el);
        smasherVisuals.push({ el, phase: Math.random() * Math.PI * 2 });
    }
}

function updateSmasherVisuals(timestamp) {
    if (smasherVisuals.length === 0 || !dom.spawnBtn) return;
    const rect = dom.spawnBtn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const baseRadius = Math.max(rect.width, rect.height) * 0.7;
    const hitMode = pendingSmasherHitBursts > 0 && (Date.now() - lastManualSpawnClickMs > 800);
    smasherVisuals.forEach((item, index) => {
        const angle = item.phase + (timestamp / 1000) * 1.5 + index * 0.8;
        const radius = baseRadius + (index % 3) * 12;
        if (hitMode && index === 0) {
            item.el.style.left = `${cx}px`;
            item.el.style.top = `${cy}px`;
        } else {
            item.el.style.left = `${cx + Math.cos(angle) * radius}px`;
            item.el.style.top = `${cy + Math.sin(angle) * radius}px`;
        }
    });
    if (hitMode) {
        pendingSmasherHitBursts = Math.max(0, pendingSmasherHitBursts - 1);
        animateDropButtonPress();
    }
}

function animateDropButtonPress() {
    dom.spawnBtn.classList.add('smasher-press');
    setTimeout(() => dom.spawnBtn.classList.remove('smasher-press'), 120);
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
    if (gs.grassEverCollected) resHTML += resRow('🌿', false, 'Grass', Math.floor(gs.grass));
    if (gs.workersEverCollected) resHTML += resRow('🧑‍🌾', false, 'Workers', gs.workers);
    if (gs.hotdogsEverCollected) resHTML += resRow('🌭', false, 'Hotdogs', gs.hotdogs);
    if (gs.warriorCamelsEverCollected) resHTML += resRow('⚔️', false, 'Warrior Camels', gs.warriorCamels);
    dom.resourceList.innerHTML = resHTML;

    let bld = '';
    const actionButtons = [];
    if (gs.caravanUnlocked) {
        actionButtons.push('<button class="inv-btn action-emoji-btn" data-action="caravan"' + (gs.camelCount < CARAVAN_COST ? ' disabled' : '') + ' data-tooltip="Send a caravan for rewards. Cost: ' + CARAVAN_COST + ' camels.">🏕️</button>');
    }
    if (gs.huntUnlocked) {
        actionButtons.push('<button class="inv-btn action-emoji-btn" data-action="hunt"' + (gs.silver < HUNT_COST_SILVER ? ' disabled' : '') + ' data-tooltip="Hunt wild camels. Cost: ' + HUNT_COST_SILVER + ' silver.">🏹</button>');
    }
    if (gs.camelCount >= BUTTON_SMASHER_COST_CAMELS || gs.buttonSmashers > 0) {
        actionButtons.push('<button class="inv-btn action-emoji-btn" data-action="buySmasher"' + (gs.camelCount < BUTTON_SMASHER_COST_CAMELS ? ' disabled' : '') + ' data-tooltip="Deploy a button smasher. Cost: ' + BUTTON_SMASHER_COST_CAMELS + ' camels.">🐪</button>');
    }
    if (gs.scoutUnlocked) {
        actionButtons.push('<button class="inv-btn action-emoji-btn" data-action="scout"' + (gs.gold < SCOUT_COST_GOLD ? ' disabled' : '') + ' data-tooltip="Scout for workers. Cost: ' + SCOUT_COST_GOLD + ' gold.">🧭</button>');
    }
    if (gs.banquetEverAffordable) {
        actionButtons.push('<button class="inv-btn action-emoji-btn" data-action="banquet"' + (gs.camelCount < BANQUET_COST ? ' disabled' : '') + ' data-tooltip="Host a banquet. Cost: ' + BANQUET_COST + ' camels.">🎉</button>');
    }
    if (gs.raceEverAffordable) {
        actionButtons.push('<button class="inv-btn action-emoji-btn" data-action="race"' + (gs.camelCount < RACE_COST ? ' disabled' : '') + ' data-tooltip="Start a race. Cost: ' + RACE_COST + ' camels.">🏁</button>');
    }
    bld += '<div class="build-row"><div class="build-head"><span class="build-title">Actions</span></div><div class="build-btns">' +
        (actionButtons.length > 0 ? actionButtons.join('') : '<div class="proc-row faded">Nothing to do here yet.</div>') +
        '</div></div>';

    if (gs.mineSilverUnlocked || gs.mineGoldUnlocked) {
        bld += '<div class="build-row">' +
            '<div class="build-head"><span class="build-title">⛏️ Mining Grounds</span></div>' +
            '<div class="build-btns">';

        if (gs.mineSilverUnlocked) {
            if (!gs.silverMine.owned) {
                bld += '<button class="inv-btn" data-action="mineSilver"' +
                    (gs.camelCount < SILVER_MINE_COST_CAMELS ? ' disabled' : '') +
                    ' data-tooltip="Build a silver mine for ' + SILVER_MINE_COST_CAMELS + ' camels. 5 camels -> 1 silver/day.">' +
                    'Silver Mine (' + SILVER_MINE_COST_CAMELS + ' 🐪)</button>';
            }
            if (gs.silverMine.owned && gs.silverMine.upgradeLevel < 2) {
                const cost = gs.silverMine.upgradeLevel === 0 ? SILVER_MINE_UPGRADE_ONE_COST : SILVER_MINE_UPGRADE_TWO_COST;
                bld += '<button class="inv-btn" data-action="upgradeSilverMine"' + (gs.camelCount < cost ? ' disabled' : '') + '>Upgrade Silver Mine (' + cost + ' 🐪)</button>';
            }
            if (gs.silverMine.owned) {
                const digActive = gs.silverMine.digEndAtMs > Date.now();
                const digRemaining = Math.max(0, gs.silverMine.digEndAtMs - Date.now());
                const digPct = digActive ? (1 - (digRemaining / 15000)) * 100 : 0;
                bld += '<div class="owned-row" style="width:100%">' +
                    '<div class="owned-title">⛏️ ' + gs.silverMine.name + '</div>' +
                    '<div class="owned-sub">Assigned camels: ' + gs.silverMine.assignedCamels + '/' + getSilverMineCapacity() + '</div>' +
                    '<div class="owned-controls">' +
                    '<button class="inv-btn" data-action="assignSilverMineMinus">- Camel</button>' +
                    '<button class="inv-btn" data-action="assignSilverMinePlus"' + (gs.grass <= 0 ? ' disabled' : '') + '>+ Camel</button>' +
                    '<button class="inv-btn" data-action="silverMineDig"' + (digActive ? ' disabled' : '') + ' style="' + (digActive ? ('background: linear-gradient(90deg, rgba(255,215,0,0.28) ' + digPct + '%, rgba(255,215,0,0.06) ' + digPct + '%);') : '') + '">' + (digActive ? 'DIGGING...' : 'DIG') + '</button>' +
                    '</div>' +
                    (gs.grass <= 0 ? '<div class="proc-row">You have no grass for the camels to mine.</div>' : '') +
                    '</div>';
            }
        }

        if (gs.mineGoldUnlocked) {
            if (!gs.goldMine.owned) {
                bld += '<button class="inv-btn" data-action="mineGold"' +
                    (gs.camelCount < GOLD_MINE_COST_CAMELS ? ' disabled' : '') +
                    ' data-tooltip="Build a gold mine for ' + GOLD_MINE_COST_CAMELS + ' camels. 1 camel -> 1 gold/10 days.">' +
                    'Gold Mine (' + GOLD_MINE_COST_CAMELS + ' 🐪)</button>';
            }
            if (gs.goldMine.owned && gs.goldMine.upgradeLevel < 2) {
                const cost = gs.goldMine.upgradeLevel === 0 ? GOLD_MINE_UPGRADE_ONE_COST : GOLD_MINE_UPGRADE_TWO_COST;
                bld += '<button class="inv-btn" data-action="upgradeGoldMine"' + (gs.camelCount < cost ? ' disabled' : '') + '>Upgrade Gold Mine (' + cost + ' 🐪)</button>';
            }
            if (gs.goldMine.owned) {
                bld += '<div class="owned-row" style="width:100%">' +
                    '<div class="owned-title">⛏️ ' + gs.goldMine.name + '</div>' +
                    '<div class="owned-sub">Assigned camels: ' + gs.goldMine.assignedCamels + '/' + getGoldMineCapacity() + '</div>' +
                    '<div class="owned-controls">' +
                    '<button class="inv-btn" data-action="assignGoldMineMinus">- Camel</button>' +
                    '<button class="inv-btn" data-action="assignGoldMinePlus"' + (gs.grass <= 0 ? ' disabled' : '') + '>+ Camel</button>' +
                    '</div>' +
                    (gs.grass <= 0 ? '<div class="proc-row">You have no grass for the camels to mine.</div>' : '') +
                    '</div>';
            }
        }

        bld += '</div></div>';
    }

    if (gs.farmEverAffordable) {
        bld += '<div class="build-row">' +
            '<div class="build-head"><span class="build-title">🏡 Farm</span></div>' +
            '<div class="build-btns">' +
            (!gs.farm.owned
                ? ('<button class="inv-btn" data-action="farmSilver"' +
                    (gs.silver < FARM_COST_SILVER ? ' disabled' : '') +
                    ' data-tooltip="Buy the only farm for ' + FARM_COST_SILVER + ' Silver. Farm workers produce grass.">' +
                    'Buy (' + FARM_COST_SILVER + ' 🥈)</button>' +
                    '<button class="inv-btn" data-action="farmGold"' +
                    (gs.gold < FARM_COST_GOLD ? ' disabled' : '') +
                    ' data-tooltip="Buy the only farm for ' + FARM_COST_GOLD + ' Gold. Farm workers produce grass.">' +
                    'Buy (' + FARM_COST_GOLD + ' 🥇)</button>')
                : '') +
            '</div></div>';
        if (gs.farm.owned) {
            bld += '<div class="build-row"><div class="owned-row">' +
                '<div class="owned-title">🏡 ' + gs.farm.name + '</div>' +
                '<div class="owned-sub">Assigned workers: ' + gs.farm.assignedWorkers + ' / Total workers: ' + gs.workers + ' · +' + (gs.farm.assignedWorkers * FARM_WORKER_GRASS_PER_DAY) + ' grass/day</div>' +
                '<div class="owned-controls">' +
                '<button class="inv-btn" data-action="farmRemoveWorker"' + (gs.farm.assignedWorkers <= 0 ? ' disabled' : '') + '>Remove Worker</button>' +
                '<button class="inv-btn" data-action="farmAddWorker"' + (gs.farm.assignedWorkers >= gs.workers ? ' disabled' : '') + '>Add Worker</button>' +
                '<span class="owned-sub no-margin">Pay with</span>' +
                '<button class="pay-switch" data-action="farmPayToggle">' +
                '<span class="pay-option' + (gs.farm.payMode === 'silver' ? ' active' : '') + '">Silver</span>' +
                '<span class="pay-option' + (gs.farm.payMode === 'gold' ? ' active' : '') + '">Gold</span>' +
                '</button>' +
                '</div>' +
                '</div></div>';
        }
    }

    bld += '<div class="build-row"><div class="build-head"><span class="build-title">🛒 Market</span></div>' +
        '<div class="market-grid">' +
        gs.marketItems.map(item =>
            '<button class="market-item" data-action="marketClick" data-market-id="' + item.id + '">' +
            '<div>' + item.name + '</div>' +
            '<div class="small">🥇 ' + item.goldPrice + ' · 🥈 ' + item.silverPrice + '</div>' +
            '</button>'
        ).join('') +
        '</div></div>';
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
    if (gs.silverMine.owned) {
        const silverRate = gs.silverMine.assignedCamels / 5;
        proc += '<div class="proc-row">⛏️ ' + gs.silverMine.name + ': ' + gs.silverMine.assignedCamels + '/' + getSilverMineCapacity() + ' camels assigned · ~' + silverRate.toFixed(2) + ' silver/day</div>';
    }
    if (gs.goldMine.owned) {
        const goldRate = gs.goldMine.assignedCamels / 10;
        proc += '<div class="proc-row">⛏️ ' + gs.goldMine.name + ': ' + gs.goldMine.assignedCamels + '/' + getGoldMineCapacity() + ' camels assigned · ~' + goldRate.toFixed(2) + ' gold/day</div>';
    }
    gs.caravans.forEach((c, i) => {
        proc += '<div class="proc-row">🏕️ Caravan #' + (i + 1) + ': returning in ' + daysRemaining(c.returnDay) + ' days</div>';
    });
    if (gs.farm.owned) {
        proc += '<div class="proc-row">🏡 ' + gs.farm.name + ': workers ' + gs.farm.assignedWorkers + '/' + gs.workers + ' · +' + (gs.farm.assignedWorkers * FARM_WORKER_GRASS_PER_DAY) + ' grass/day · pay with ' + gs.farm.payMode + '</div>';
    }
    gs.scouts.forEach((scout, i) => {
        proc += '<div class="proc-row">🧭 Scout #' + (i + 1) + ': returning in ' + daysRemaining(scout.returnDay) + ' days</div>';
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
    rebuildSmasherVisuals();
    saveToLocalStorage();
    updateUI();
}

function handleSaveGame() {
    dom.saveLoadArea.classList.remove('hidden');
    dom.saveLoadText.value = encodeSave({
        gs,
        musicEnabled,
        sfxEnabled,
        manualSpeedMultiplier
    });
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
        if (loaded && loaded.gs) {
            gs = Object.assign(freshState(), loaded.gs);
            musicEnabled = loaded.musicEnabled !== false;
            sfxEnabled = loaded.sfxEnabled !== false;
            manualSpeedMultiplier = loaded.manualSpeedMultiplier === 2 ? 2 : 1;
        } else {
            gs = Object.assign(freshState(), loaded);
        }
        normalizeState();
        visualCamels = [];
        lastWallTime = Date.now();
        rebuildSmasherVisuals();
        addLog('Game loaded successfully!');
        menuOpen = false;
        dom.menuPanel.classList.remove('open');
        saveToLocalStorage();
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
    saveToLocalStorage();
}

function toggleSfx() {
    sfxEnabled = !sfxEnabled;
    dom.toggleSfxBtn.textContent = sfxEnabled ? '🔊 SFX: ON' : '🔊 SFX: OFF';
    saveToLocalStorage();
}

function openHotdogPage() {
    if (!gs.hotdogPageUnlocked) {
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
    checkSilverMineDigCompletion();

    checkCaravanCompletions();
    checkBanquetCompletions();
    checkRaceCompletions();
    checkConversionCompletions();
    checkFarmProduction(elapsedGameDays);
    checkScoutReturns();
    checkUnlocks();
    saveToLocalStorage();
}

/* ============================================================
   RENDER LOOP (rAF — only when tab is visible)
   ============================================================ */
function renderLoop(timestamp) {
    updatePhysics();
    render();
    updateSmasherVisuals(timestamp);
    updateUI();
    updateSlowUI(timestamp);

    requestAnimationFrame(renderLoop);
}

/* ============================================================
   START
   ============================================================ */
window.addEventListener('load', init);

/**
 * Camel Drop Game - 2D Version
 * A 2D physics-based game where camels fall and stack with realistic gravity
 */

// Global variables
let canvas, ctx;
let camels = [];
let counter = 0;
let goldAmount = 0;
let camelImage;
let gravity = 0.5;
let groundY;
let isGameStarted = false;
let backgroundMusic, camelSound;
let groundColliderEnabled = true;
let shovelActive = false;

/** --- Incremental Loop System: persistent storage key --- */
const STORAGE_KEY = 'camelIncrementalStateV1';

/** --- Incremental Loop System: resource tracking --- */
let caravanCount = 0;
let farmCount = 0;
let grassAmount = 0;
let grasslandCount = 0;
let guardCampCount = 0;
let nomadTokens = 0;

/** --- Incremental Loop System: DOM references --- */
let farmButton = null;
let grasslandButton = null;
let guardButton = null;
let nomadButton = null;
const resourceElements = {
    grass: null,
    farms: null,
    grasslands: null,
    caravans: null,
    guards: null,
    nomads: null
};

/** --- Incremental Loop System: timers and loops --- */
let farmProductionTimer = 0;
let grassConsumptionTimer = 0;
let caravanGoldTimer = 0;
let banditTimer = 0;
let resourceLoopInterval = null;
let saveThrottleTimeout = null;

/** --- Incremental Loop System: UI feedback --- */
let statusMessageElement = null;
let lastStatusUpdateTime = 0;
let lastStatusText = '';

/** --- Cheat / Test Mode: L+K held = 4x game-time speed --- */
let cheatKeysHeld = { l: false, k: false };
let gameSpeedMultiplier = 1;

/** --- Progressive Unlocking: persisted flags --- */
let unlockFlags = {
    shovel: false,
    caravan: false,
    farm: false,
    grassland: false,
    guard: false,
    nomad: false
};

/** --- Auto-Spawn: 1 visible camel every 6 real seconds --- */
let autoSpawnInterval = null;

/** --- Tooltip System --- */
let tooltipElement = null;
let touchTooltipTimer = null;

// Initialize the game
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    groundY = canvas.height - 100;

    loadCamelImage();
    setupAudio();

    // Restore previous session (including unlock flags)
    loadGameState();

    // Wire up existing HTML buttons
    document.getElementById('spawnButton').addEventListener('click', startGame);
    document.getElementById('shovelButton').addEventListener('click', handleShovelClick);
    document.getElementById('caravanButton').addEventListener('click', handleCaravanClick);
    window.addEventListener('resize', onWindowResize);

    // Build incremental UI, tooltips, cheat mode
    setupIncrementalLoopSystem();
    setupCheatMode();
    setupAllTooltips();

    // Apply progressive visibility based on loaded flags
    applyUnlockVisibility();
    checkProgressiveUnlocks();

    updateCounters();
    updateCaravanButton();

    animate();
}

/**
 * Load the camel PNG image
 */
function loadCamelImage() {
    camelImage = new Image();
    camelImage.onload = function() {
        console.log('Camel image loaded successfully!');
    };
    camelImage.onerror = function() {
        console.error('Failed to load camel image');
        alert('Failed to load camel image. Please check the file path.');
    };
    camelImage.src = 'assets/camel-png-4.png';
}

/**
 * Setup audio elements
 */
function setupAudio() {
    backgroundMusic = document.getElementById('backgroundMusic');
    camelSound = document.getElementById('camelSound');

    backgroundMusic.volume = 0.3;
    backgroundMusic.play().catch(e => {
        console.log('Background music autoplay blocked:', e);
    });

    camelSound.volume = 0.7;
}

// ============================================================
// CHEAT / TEST MODE  (hold L + K  →  4× game-time speed)
// Affects only resource timers. Does NOT touch rendering,
// physics, gravity, or camel-fall animations.
// ============================================================

function setupCheatMode() {
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'l') cheatKeysHeld.l = true;
        if (key === 'k') cheatKeysHeld.k = true;
        gameSpeedMultiplier = (cheatKeysHeld.l && cheatKeysHeld.k) ? 4 : 1;
    });
    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'l') cheatKeysHeld.l = false;
        if (key === 'k') cheatKeysHeld.k = false;
        gameSpeedMultiplier = (cheatKeysHeld.l && cheatKeysHeld.k) ? 4 : 1;
    });
}

// ============================================================
// PROGRESSIVE UNLOCKING
// Buttons and counters are completely hidden until the player
// crosses the relevant threshold for the first time.
// ============================================================

function checkProgressiveUnlocks() {
    let changed = false;

    if (!unlockFlags.shovel && counter >= 10) {
        unlockFlags.shovel = true;
        changed = true;
        console.log('[Unlock] Shovel — Clears all camels from the screen. Use it when things get crowded!');
        updateStatusMessage('Shovel unlocked! Clear the screen.');
    }

    if (!unlockFlags.caravan && counter >= 100) {
        unlockFlags.caravan = true;
        changed = true;
        console.log('[Unlock] Caravan — Convert 100 camels into a caravan. Caravans generate 14-21 gold per minute.');
        updateStatusMessage('Caravans unlocked! Convert camels to gold.');
    }

    if (!unlockFlags.farm && goldAmount >= 25) {
        unlockFlags.farm = true;
        changed = true;
        console.log('[Unlock] Farm — Costs 25 gold. Produces 1 camel every 2 seconds (requires grass).');
        updateStatusMessage('Farms available! Breed camels with grass.');
    }

    if (!unlockFlags.grassland && goldAmount >= 50) {
        unlockFlags.grassland = true;
        changed = true;
        console.log('[Unlock] Grassland — Costs 50 gold. Generates 1 grass per second to feed farms.');
        updateStatusMessage('Grasslands unlocked! Grow grass for farms.');
    }

    if (!unlockFlags.guard && goldAmount >= 100) {
        unlockFlags.guard = true;
        changed = true;
        console.log('[Unlock] Guard Camp — Costs 100 gold. Cuts caravan losses from bandits by 50%.');
        updateStatusMessage('Guard camps available! Defend against bandits.');
    }

    if (!unlockFlags.nomad && (counter >= 1000 || caravanCount >= 100)) {
        unlockFlags.nomad = true;
        changed = true;
        console.log('[Unlock] Nomad Migration — Reset progress for Nomad Tokens. Each token permanently boosts gold income by 1%.');
        updateStatusMessage('Nomad Migration ready! Reset for tokens.');
    }

    if (changed) {
        applyUnlockVisibility();
        queueSaveGameState();
    }
}

function applyUnlockVisibility() {
    const shovelBtn = document.getElementById('shovelButton');
    const caravanBtn = document.getElementById('caravanButton');

    if (shovelBtn) shovelBtn.style.display = unlockFlags.shovel ? '' : 'none';
    if (caravanBtn) caravanBtn.style.display = unlockFlags.caravan ? '' : 'none';

    if (farmButton) farmButton.style.display = unlockFlags.farm ? '' : 'none';
    if (grasslandButton) grasslandButton.style.display = unlockFlags.grassland ? '' : 'none';
    if (guardButton) guardButton.style.display = unlockFlags.guard ? '' : 'none';
    if (nomadButton) nomadButton.style.display = unlockFlags.nomad ? '' : 'none';

    // Resource counters follow their system's unlock
    if (resourceElements.grass)
        resourceElements.grass.parentElement.style.display = unlockFlags.farm ? '' : 'none';
    if (resourceElements.farms)
        resourceElements.farms.parentElement.style.display = unlockFlags.farm ? '' : 'none';
    if (resourceElements.grasslands)
        resourceElements.grasslands.parentElement.style.display = unlockFlags.grassland ? '' : 'none';
    if (resourceElements.caravans)
        resourceElements.caravans.parentElement.style.display = unlockFlags.caravan ? '' : 'none';
    if (resourceElements.guards)
        resourceElements.guards.parentElement.style.display = unlockFlags.guard ? '' : 'none';
    if (resourceElements.nomads)
        resourceElements.nomads.parentElement.style.display = unlockFlags.nomad ? '' : 'none';

    // Status ticker hidden until any system is unlocked
    if (statusMessageElement) {
        const anyUnlocked = Object.values(unlockFlags).some(v => v);
        statusMessageElement.style.display = anyUnlocked ? '' : 'none';
    }
}

// ============================================================
// TOOLTIP / EXPLANATION POPUP SYSTEM
// Desktop: hover  |  Mobile: long-press (≥ 400 ms)
// ============================================================

const TOOLTIP_DATA = {
    spawnButton:     '<b>Drop a Camel!</b><br>Click to spawn a camel that falls with physics.<br>Camels also auto-spawn every 6 seconds.<br><i>Cost: Free</i>',
    shovelButton:    '<b>Shovel</b><br>Clears all camels from the screen by opening the ground for 3 seconds.<br><i>Cost: Free</i>',
    caravanButton:   '<b>Caravan</b><br>Convert 100 🐪 into a trading caravan.<br>Each caravan generates 14–21 🪙 per minute.<br><i>Cost: 100 camels</i>',
    farmButton:      '<b>Farm 🏡</b><br>Produces 1 camel every 2 seconds.<br>Each camel produced consumes 1 grass.<br><i>Cost: 25 🪙</i>',
    grasslandButton: '<b>Grassland 🌾</b><br>Generates 1 grass per second.<br>Grass feeds your farms so they breed camels.<br><i>Cost: 50 🪙</i>',
    guardButton:     '<b>Guard Camp 🛡️</b><br>Reduces caravan losses from bandit raids by 50%.<br><i>Cost: 100 🪙</i>',
    nomadButton:     '<b>Nomad Migration 🔄</b><br>Reset all progress for Nomad Tokens.<br>Each token boosts gold income by 1% permanently.<br><i>Requires: 1000 🐪 or 100 caravans</i>'
};

const COUNTER_TOOLTIP_DATA = {
    camelCounter: '<b>Camels 🐪</b><br>Your herd. Drop more or build farms to grow it.',
    goldCounter:  '<b>Gold 🪙</b><br>Earned from caravans. Spend on farms, grasslands, and guards.'
};

const RESOURCE_COUNTER_TOOLTIPS = {
    grass:      '<b>Grass 🌿</b><br>Consumed by camels (1 per camel every 10 s).<br>Produced by grasslands. Needed for farm production.',
    farms:      '<b>Farms 🏡</b><br>Each farm breeds 1 camel every 2 seconds (costs 1 grass per camel).',
    grasslands: '<b>Grasslands 🌾</b><br>Each grassland generates 1 grass per second.',
    caravans:   '<b>Caravans 🏕️</b><br>Each caravan earns 14–21 gold per minute automatically.',
    guards:     '<b>Guard Camps 🛡️</b><br>Reduce chance of losing caravans to bandits by 50%.',
    nomads:     '<b>Nomad Tokens 🔄</b><br>Each token permanently boosts gold income by 1%.'
};

function createTooltipElement() {
    tooltipElement = document.createElement('div');
    tooltipElement.id = 'gameTooltip';
    Object.assign(tooltipElement.style, {
        position: 'fixed',
        zIndex: '100',
        background: 'rgba(0, 0, 0, 0.88)',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: '10px',
        fontSize: '14px',
        lineHeight: '1.5',
        maxWidth: '280px',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 0.2s',
        backdropFilter: 'blur(6px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        fontFamily: 'Arial, sans-serif'
    });
    document.body.appendChild(tooltipElement);
}

function attachTooltip(element, htmlContent) {
    if (!element || !htmlContent) return;

    // Desktop hover
    element.addEventListener('mouseenter', (e) => {
        tooltipElement.innerHTML = htmlContent;
        tooltipElement.style.opacity = '1';
        positionTooltip(e);
    });
    element.addEventListener('mousemove', positionTooltip);
    element.addEventListener('mouseleave', () => {
        tooltipElement.style.opacity = '0';
    });

    // Mobile: long-press ≥ 400 ms shows tooltip; quick tap fires action normally
    element.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        touchTooltipTimer = setTimeout(() => {
            tooltipElement.innerHTML = htmlContent;
            tooltipElement.style.opacity = '1';
            positionTooltip(touch);
        }, 400);
    }, { passive: true });
    element.addEventListener('touchend', () => {
        clearTimeout(touchTooltipTimer);
        tooltipElement.style.opacity = '0';
    });
    element.addEventListener('touchmove', () => {
        clearTimeout(touchTooltipTimer);
        tooltipElement.style.opacity = '0';
    });
}

function positionTooltip(event) {
    if (!tooltipElement) return;
    let x = (event.clientX || event.pageX || 0) + 15;
    let y = (event.clientY || event.pageY || 0) + 15;
    const maxX = window.innerWidth - 300;
    const maxY = window.innerHeight - 150;
    tooltipElement.style.left = Math.min(x, maxX) + 'px';
    tooltipElement.style.top = Math.min(y, maxY) + 'px';
}

function setupAllTooltips() {
    createTooltipElement();

    // HTML buttons
    attachTooltip(document.getElementById('spawnButton'), TOOLTIP_DATA.spawnButton);
    attachTooltip(document.getElementById('shovelButton'), TOOLTIP_DATA.shovelButton);
    attachTooltip(document.getElementById('caravanButton'), TOOLTIP_DATA.caravanButton);

    // Dynamically created buttons
    attachTooltip(farmButton, TOOLTIP_DATA.farmButton);
    attachTooltip(grasslandButton, TOOLTIP_DATA.grasslandButton);
    attachTooltip(guardButton, TOOLTIP_DATA.guardButton);
    attachTooltip(nomadButton, TOOLTIP_DATA.nomadButton);

    // HTML counter items
    attachTooltip(document.getElementById('camelCounter'), COUNTER_TOOLTIP_DATA.camelCounter);
    attachTooltip(document.getElementById('goldCounter'), COUNTER_TOOLTIP_DATA.goldCounter);

    // Dynamic resource counters
    for (const [key, el] of Object.entries(resourceElements)) {
        if (el && RESOURCE_COUNTER_TOOLTIPS[key]) {
            attachTooltip(el.parentElement, RESOURCE_COUNTER_TOOLTIPS[key]);
        }
    }
}

// ============================================================
// AUTO-SPAWN  (1 visible, physics camel every 6 real seconds)
// Uses the exact same spawn path as the button.
// NOT affected by cheat-mode multiplier (real-time).
// ============================================================

function startAutoSpawn() {
    if (autoSpawnInterval) return;
    autoSpawnInterval = setInterval(() => {
        if (camelImage && camelImage.complete) {
            gainCamels(1, true);
        }
    }, 6000);
}

// ============================================================
// INCREMENTAL UI HELPERS
// ============================================================

/**
 * Create a counter item with emoji icon.
 */
function createResourceCounter(container, label, valueElementId, tooltip) {
    const counterItem = document.createElement('div');
    counterItem.className = 'counter-item';
    if (tooltip) counterItem.title = tooltip;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'counter-icon';
    iconSpan.textContent = label;
    iconSpan.style.display = 'flex';
    iconSpan.style.alignItems = 'center';
    iconSpan.style.justifyContent = 'center';
    iconSpan.style.fontSize = '32px';

    const valueSpan = document.createElement('span');
    valueSpan.id = valueElementId;
    valueSpan.className = 'counter-value';
    valueSpan.style.fontSize = '32px';
    valueSpan.style.color = '#FFFFFF';
    valueSpan.style.fontWeight = 'bold';
    valueSpan.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
    valueSpan.style.minWidth = '60px';
    valueSpan.style.textAlign = 'left';
    valueSpan.textContent = '0';

    counterItem.appendChild(iconSpan);
    counterItem.appendChild(valueSpan);
    container.appendChild(counterItem);
    return valueSpan;
}

/**
 * Create an emoji-driven icon button.
 */
function createEmojiButton(emoji, title) {
    const button = document.createElement('button');
    button.className = 'icon-button';
    button.title = title;

    const emojiSpan = document.createElement('span');
    emojiSpan.textContent = emoji;
    emojiSpan.style.fontSize = '28px';
    emojiSpan.style.pointerEvents = 'none';

    button.appendChild(emojiSpan);
    return button;
}

/**
 * Build all incremental counters, buttons, and status ticker.
 */
function initializeIncrementalUI() {
    const countersContainer = document.getElementById('counters');
    if (!countersContainer) return;

    resourceElements.grass      = createResourceCounter(countersContainer, '🌿', 'grassAmount',    'Available grass');
    resourceElements.farms      = createResourceCounter(countersContainer, '🏡', 'farmCount',      'Farms breeding camels');
    resourceElements.grasslands = createResourceCounter(countersContainer, '🌾', 'grasslandCount', 'Grasslands generating grass');
    resourceElements.caravans   = createResourceCounter(countersContainer, '🏕️', 'caravanCount',   'Active caravans');
    resourceElements.guards     = createResourceCounter(countersContainer, '🛡️', 'guardCount',     'Guard camps protecting caravans');
    resourceElements.nomads     = createResourceCounter(countersContainer, '🔄', 'nomadTokenCount','Nomad tokens for permanent boosts');

    statusMessageElement = document.createElement('div');
    Object.assign(statusMessageElement.style, {
        marginTop: '10px',
        padding: '10px 14px',
        background: 'rgba(0, 0, 0, 0.35)',
        borderRadius: '10px',
        color: '#FFFFFF',
        fontWeight: '600',
        minWidth: '180px',
        fontSize: '16px'
    });
    statusMessageElement.textContent = 'Welcome to the dunes!';
    countersContainer.appendChild(statusMessageElement);

    const iconContainer = document.getElementById('iconButtons');
    const progressBar = document.getElementById('caravanProgress');

    if (iconContainer) {
        farmButton      = createEmojiButton('🏡', 'Build a farm (25 🪙)');
        grasslandButton = createEmojiButton('🌾', 'Cultivate grassland (50 🪙)');
        guardButton     = createEmojiButton('🛡️', 'Build guard camp (100 🪙)');
        nomadButton     = createEmojiButton('🔄', 'Nomad Migration');
        nomadButton.classList.add('disabled');

        if (progressBar) {
            iconContainer.insertBefore(farmButton, progressBar);
            iconContainer.insertBefore(grasslandButton, progressBar);
            iconContainer.insertBefore(guardButton, progressBar);
            iconContainer.insertBefore(nomadButton, progressBar);
        } else {
            iconContainer.appendChild(farmButton);
            iconContainer.appendChild(grasslandButton);
            iconContainer.appendChild(guardButton);
            iconContainer.appendChild(nomadButton);
        }
    }
}

/**
 * Bind button listeners for incremental buttons.
 */
function attachIncrementalListeners() {
    if (farmButton) farmButton.addEventListener('click', handleFarmPurchase);
    if (grasslandButton) grasslandButton.addEventListener('click', handleGrasslandPurchase);
    if (guardButton) guardButton.addEventListener('click', handleGuardPurchase);
    if (nomadButton) nomadButton.addEventListener('click', handleNomadMigration);
}

/**
 * Orchestrate UI setup and loops.
 */
function setupIncrementalLoopSystem() {
    initializeIncrementalUI();
    attachIncrementalListeners();
    startResourceLoop();
    updateNomadButtonState();
    updateIncrementalCounters();
    updateCaravanProgressBar();
}

// ============================================================
// RESOURCE LOOP
// ============================================================

function startResourceLoop() {
    if (resourceLoopInterval) clearInterval(resourceLoopInterval);
    resourceLoopInterval = setInterval(() => {
        // gameSpeedMultiplier is 1 normally, 4 when L+K cheat active
        runResourceTick(1 * gameSpeedMultiplier);
    }, 1000);
}

function runResourceTick(deltaSeconds) {
    const grassGrowthChanged  = applyGrasslandGrowth(deltaSeconds);
    const farmChanged         = processFarmProduction(deltaSeconds);
    const grassConsumed       = processGrassConsumption(deltaSeconds);
    const caravanGoldChanged  = processCaravanGold(deltaSeconds);
    const banditEvent         = processBanditRaid(deltaSeconds);

    if (grassGrowthChanged || farmChanged || grassConsumed || caravanGoldChanged || banditEvent) {
        updateIncrementalCounters();
        updateCaravanButton();
        queueSaveGameState();
    }

    updateCaravanProgressBar();
    updateNomadButtonState();
    checkProgressiveUnlocks();
}

function applyGrasslandGrowth(deltaSeconds) {
    if (grasslandCount === 0 || deltaSeconds <= 0) return false;
    const grassGained = Math.floor(grasslandCount * deltaSeconds);
    if (grassGained <= 0) return false;
    grassAmount += grassGained;
    updateStatusMessage(`Grasslands grew ${grassGained} 🌿`);
    return true;
}

function processFarmProduction(deltaSeconds) {
    farmProductionTimer += deltaSeconds;
    if (farmCount === 0 || farmProductionTimer < 2) return false;

    const cycles = Math.floor(farmProductionTimer / 2);
    if (cycles === 0) return false;

    const potentialCamels = cycles * farmCount;
    if (grassAmount <= 0) {
        farmProductionTimer = Math.min(farmProductionTimer, 2);
        return false;
    }

    const camelsProduced = Math.min(potentialCamels, grassAmount);
    if (camelsProduced <= 0) {
        farmProductionTimer = Math.min(farmProductionTimer, 2);
        return false;
    }

    grassAmount -= camelsProduced;
    farmProductionTimer -= cycles * 2;
    // Every camel must be visible and physical
    gainCamels(camelsProduced, true);
    updateStatusMessage(`Farms bred ${camelsProduced} 🐪`);
    return true;
}

function processGrassConsumption(deltaSeconds) {
    grassConsumptionTimer += deltaSeconds;
    if (grassConsumptionTimer < 10 || counter <= 0) return false;

    const cycles = Math.floor(grassConsumptionTimer / 10);
    if (cycles === 0) return false;

    const grassNeeded = counter * cycles;
    const grassUsed = Math.min(grassNeeded, grassAmount);
    grassAmount -= grassUsed;
    grassConsumptionTimer -= cycles * 10;

    if (grassUsed < grassNeeded) {
        updateStatusMessage('Grass has run dry! Farms are idle.');
    } else {
        updateStatusMessage(`Camels grazed ${grassUsed} 🌿`);
    }
    return grassUsed > 0;
}

function processCaravanGold(deltaSeconds) {
    caravanGoldTimer += deltaSeconds;
    if (caravanCount === 0 || caravanGoldTimer < 60) return false;

    const cycles = Math.floor(caravanGoldTimer / 60);
    if (cycles === 0) return false;

    let totalGold = 0;
    for (let i = 0; i < caravanCount * cycles; i++) {
        const baseGold = Math.floor(Math.random() * 8) + 14;
        const multiplier = 1 + nomadTokens * 0.01;
        totalGold += Math.floor(baseGold * multiplier);
    }

    caravanGoldTimer -= cycles * 60;
    if (totalGold <= 0) return false;

    gainGold(totalGold);
    updateStatusMessage(`Caravans hauled ${totalGold} 🪙`);
    return true;
}

function processBanditRaid(deltaSeconds) {
    banditTimer += deltaSeconds;
    if (banditTimer < 60) return false;

    const cycles = Math.floor(banditTimer / 60);
    banditTimer -= cycles * 60;

    let resourcesChanged = false;
    for (let i = 0; i < cycles; i++) {
        const attackChance = Math.random() * 0.05 + 0.05;
        if (Math.random() > attackChance) continue;

        const lossChance = guardCampCount > 0 ? 0.5 : 1;
        let caravanLost = false;
        if (caravanCount > 0 && Math.random() < lossChance) {
            caravanCount -= 1;
            caravanLost = true;
            resourcesChanged = true;
        }

        const goldStolen = Math.min(goldAmount, Math.floor(goldAmount * (0.1 + Math.random() * 0.1)));
        if (goldStolen > 0) {
            goldAmount -= goldStolen;
            resourcesChanged = true;
        }

        if (caravanLost || goldStolen > 0) {
            updateStatusMessage(`Bandits struck! 💀 Lost ${caravanLost ? '1 caravan' : 'no caravans'} and ${goldStolen} 🪙`);
        } else {
            updateStatusMessage('Bandits spotted but guards held firm.');
        }
    }
    return resourcesChanged;
}

// ============================================================
// STATUS MESSAGE
// ============================================================

function updateStatusMessage(message) {
    if (!statusMessageElement || !message) return;
    const now = Date.now();
    if (message === lastStatusText && now - lastStatusUpdateTime < 4000) return;
    statusMessageElement.textContent = message;
    lastStatusText = message;
    lastStatusUpdateTime = now;
}

// ============================================================
// RESOURCE HELPERS
// ============================================================

function gainCamels(amount, shouldSpawnVisual) {
    if (amount <= 0) return;
    counter += amount;
    if (shouldSpawnVisual) {
        for (let i = 0; i < amount; i++) createCamelEntity();
    }
    updateCounters();
    updateCaravanButton();
    queueSaveGameState();
}

function createCamelEntity() {
    const camel = {
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
    };
    camels.push(camel);
}

function spendCamels(amount) {
    if (amount <= 0 || counter < amount) return false;
    counter -= amount;
    updateCounters();
    updateCaravanButton();
    queueSaveGameState();
    return true;
}

function gainGold(amount) {
    if (amount <= 0) return;
    goldAmount += amount;
    updateCounters();
    queueSaveGameState();
}

function spendGold(cost) {
    if (cost <= 0 || goldAmount < cost) return false;
    goldAmount -= cost;
    updateCounters();
    queueSaveGameState();
    return true;
}

// ============================================================
// INCREMENTAL COUNTER REFRESH
// ============================================================

function updateIncrementalCounters() {
    if (resourceElements.grass)      resourceElements.grass.textContent      = Math.floor(grassAmount);
    if (resourceElements.farms)      resourceElements.farms.textContent      = farmCount;
    if (resourceElements.grasslands) resourceElements.grasslands.textContent = grasslandCount;
    if (resourceElements.caravans)   resourceElements.caravans.textContent   = caravanCount;
    if (resourceElements.guards)     resourceElements.guards.textContent     = guardCampCount;
    if (resourceElements.nomads)     resourceElements.nomads.textContent     = nomadTokens;
}

// ============================================================
// PURCHASE HANDLERS
// ============================================================

function handleFarmPurchase() {
    if (!spendGold(25)) { updateStatusMessage('Need 25 🪙 for a farm.'); return; }
    farmCount += 1;
    updateIncrementalCounters();
    updateStatusMessage('New farm built! 🏡');
    queueSaveGameState();
}

function handleGrasslandPurchase() {
    if (!spendGold(50)) { updateStatusMessage('Need 50 🪙 for a grassland.'); return; }
    grasslandCount += 1;
    updateIncrementalCounters();
    updateStatusMessage('Fresh grassland cultivated! 🌾');
    queueSaveGameState();
}

function handleGuardPurchase() {
    if (!spendGold(100)) { updateStatusMessage('Need 100 🪙 for guards.'); return; }
    guardCampCount += 1;
    updateIncrementalCounters();
    updateStatusMessage('Guard camp established! 🛡️');
    queueSaveGameState();
}

// ============================================================
// CARAVAN PROGRESS UI
// ============================================================

function updateCaravanProgressBar() {
    const progressBar = document.getElementById('caravanProgress');
    const progressFill = document.getElementById('caravanProgressFill');
    if (!progressBar || !progressFill) return;

    if (!unlockFlags.caravan || caravanCount <= 0) {
        progressBar.classList.add('hidden');
        progressFill.style.width = '0%';
        return;
    }
    progressBar.classList.remove('hidden');
    const pct = Math.min((caravanGoldTimer / 60) * 100, 100);
    progressFill.style.width = `${pct}%`;
}

// ============================================================
// NOMAD / PRESTIGE
// ============================================================

function updateNomadButtonState() {
    if (!nomadButton) return;
    const unlocked = counter >= 1000 || caravanCount >= 100;
    if (unlocked) {
        nomadButton.classList.remove('disabled');
        nomadButton.title = 'Nomad Migration ready!';
    } else {
        nomadButton.classList.add('disabled');
        nomadButton.title = 'Reach 1000 camels or 100 caravans to unlock.';
    }
}

function handleNomadMigration() {
    if (!nomadButton || nomadButton.classList.contains('disabled')) return;
    const earnedTokens = Math.max(1, Math.floor(counter / 1000) + Math.floor(caravanCount / 100));
    nomadTokens += earnedTokens;

    resetResourcesForNomad();
    updateStatusMessage(`Nomads set out with ${earnedTokens} tokens! 🔄`);
    updateCounters();
    updateIncrementalCounters();
    updateCaravanButton();
    updateCaravanProgressBar();
    queueSaveGameState();
}

function resetResourcesForNomad() {
    counter = 0;
    goldAmount = 0;
    grassAmount = 0;
    farmCount = 0;
    grasslandCount = 0;
    guardCampCount = 0;
    caravanCount = 0;
    caravanGoldTimer = 0;
    farmProductionTimer = 0;
    grassConsumptionTimer = 0;
    banditTimer = 0;
    camels = [];
}

// ============================================================
// SAVE / LOAD  (localStorage)
// ============================================================

function queueSaveGameState() {
    if (saveThrottleTimeout) clearTimeout(saveThrottleTimeout);
    saveThrottleTimeout = setTimeout(saveGameState, 500);
}

function saveGameState() {
    const payload = {
        counter,
        goldAmount,
        caravanCount,
        farmCount,
        grassAmount,
        grasslandCount,
        guardCampCount,
        nomadTokens,
        caravanGoldTimer,
        farmProductionTimer,
        grassConsumptionTimer,
        banditTimer,
        unlockFlags
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.error('Failed to save game state:', error);
    }
    saveThrottleTimeout = null;
}

function loadGameState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const data = JSON.parse(stored);
        counter              = Number.isFinite(data.counter)              ? data.counter              : counter;
        goldAmount           = Number.isFinite(data.goldAmount)           ? data.goldAmount           : goldAmount;
        caravanCount         = Number.isFinite(data.caravanCount)         ? data.caravanCount         : caravanCount;
        farmCount            = Number.isFinite(data.farmCount)            ? data.farmCount            : farmCount;
        grassAmount          = Number.isFinite(data.grassAmount)          ? data.grassAmount          : grassAmount;
        grasslandCount       = Number.isFinite(data.grasslandCount)       ? data.grasslandCount       : grasslandCount;
        guardCampCount       = Number.isFinite(data.guardCampCount)       ? data.guardCampCount       : guardCampCount;
        nomadTokens          = Number.isFinite(data.nomadTokens)          ? data.nomadTokens          : nomadTokens;
        caravanGoldTimer     = Number.isFinite(data.caravanGoldTimer)     ? data.caravanGoldTimer     : 0;
        farmProductionTimer  = Number.isFinite(data.farmProductionTimer)  ? data.farmProductionTimer  : 0;
        grassConsumptionTimer= Number.isFinite(data.grassConsumptionTimer)? data.grassConsumptionTimer: 0;
        banditTimer          = Number.isFinite(data.banditTimer)          ? data.banditTimer          : 0;

        // Restore unlock flags (permanent across sessions)
        if (data.unlockFlags && typeof data.unlockFlags === 'object') {
            for (const key of Object.keys(unlockFlags)) {
                if (data.unlockFlags[key] === true) unlockFlags[key] = true;
            }
        }
    } catch (error) {
        console.error('Failed to load game state:', error);
    }
}

// ============================================================
// ORIGINAL GAME FUNCTIONS (preserved)
// ============================================================

/**
 * Start the game and spawn first camel
 */
function startGame() {
    if (!isGameStarted) {
        isGameStarted = true;
        backgroundMusic.play().catch(e => console.log('Music play error:', e));
        // Begin auto-spawning camels every 6 real seconds
        startAutoSpawn();
    }

    camelSound.currentTime = 0;
    camelSound.play().catch(e => console.log('Camel sound error:', e));

    spawnCamel();
}

/**
 * Spawn a new camel (same path used by button AND auto-spawn)
 */
function spawnCamel() {
    if (!camelImage.complete) {
        alert('Please wait for the camel image to load!');
        return;
    }
    gainCamels(1, true);
}

/**
 * Check collision between two camels
 */
function checkCollision(camel1, camel2) {
    return camel1.x < camel2.x + camel2.width &&
           camel1.x + camel1.width > camel2.x &&
           camel1.y < camel2.y + camel2.height &&
           camel1.y + camel1.height > camel2.y;
}

/**
 * Handle collision between two camels
 */
function handleCollision(camel1, camel2) {
    const dx = camel2.x - camel1.x;
    const dy = camel2.y - camel1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return;

    const nx = dx / distance;
    const ny = dy / distance;

    const overlap = (camel1.width + camel2.width) / 2 - distance;
    if (overlap > 0) {
        const separationX = nx * overlap * 0.5;
        const separationY = ny * overlap * 0.5;
        camel1.x -= separationX;
        camel1.y -= separationY;
        camel2.x += separationX;
        camel2.y += separationY;
    }

    const relativeVelocityX = camel2.velocityX - camel1.velocityX;
    const relativeVelocityY = camel2.velocityY - camel1.velocityY;
    const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;

    if (velocityAlongNormal > 0) return;

    const restitution = 0.6;
    let impulseScalar = -(1 + restitution) * velocityAlongNormal;
    impulseScalar /= 2;

    const impulseX = impulseScalar * nx;
    const impulseY = impulseScalar * ny;

    camel1.velocityX -= impulseX;
    camel1.velocityY -= impulseY;
    camel2.velocityX += impulseX;
    camel2.velocityY += impulseY;

    camel1.rotationSpeed += (Math.random() - 0.5) * 0.05;
    camel2.rotationSpeed += (Math.random() - 0.5) * 0.05;
}

/**
 * Update camel physics (NOT affected by cheat multiplier)
 */
function updateCamels() {
    camels.forEach((camel, index) => {
        camel.velocityY += gravity;
        camel.x += camel.velocityX;
        camel.y += camel.velocityY;

        camel.rotation += camel.rotationSpeed;
        camel.rotationSpeed *= 0.95;

        camel.velocityX *= 0.99;
        camel.velocityY *= 0.999;

        if (camel.x <= 0 || camel.x >= canvas.width - camel.width) {
            camel.velocityX *= -0.7;
            camel.x = Math.max(0, Math.min(canvas.width - camel.width, camel.x));
        }

        if (groundColliderEnabled && camel.y >= groundY - camel.height) {
            camel.y = groundY - camel.height;
            camel.velocityY *= -0.3;
            camel.velocityX *= 0.8;
            camel.rotationSpeed *= 0.9;
        }

        if (groundColliderEnabled && Math.abs(camel.velocityY) < 0.1 && camel.y >= groundY - camel.height - 5) {
            camel.velocityY = 0;
            camel.rotationSpeed *= 0.8;
        }

        if (Math.abs(camel.rotationSpeed) < 0.001) {
            camel.rotationSpeed = 0;
        }

        if (camel.y > canvas.height + 100) {
            camels.splice(index, 1);
        }
    });

    for (let i = 0; i < camels.length; i++) {
        for (let j = i + 1; j < camels.length; j++) {
            if (checkCollision(camels[i], camels[j])) {
                handleCollision(camels[i], camels[j]);
            }
        }
    }
}

/**
 * Render all camels
 */
function renderCamels() {
    camels.forEach(camel => {
        ctx.save();
        ctx.translate(camel.x + camel.anchorX, camel.y + camel.anchorY);
        ctx.rotate(camel.rotation);
        ctx.scale(camel.scale, camel.scale);

        if (camelImage.complete) {
            ctx.drawImage(camelImage, -camel.anchorX, -camel.anchorY, camel.width, camel.height);
        } else {
            ctx.fillStyle = camel.color;
            ctx.fillRect(-camel.anchorX, -camel.anchorY, camel.width, camel.height);
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-camel.anchorX - 20, -camel.anchorY - 30, 40, 20);
            ctx.fillRect(-camel.anchorX - 15, -camel.anchorY - 40, 15, 15);
            ctx.fillRect(-camel.anchorX - 10, -camel.anchorY - 45, 8, 8);
        }

        ctx.restore();
    });
}

/**
 * Draw the ground
 */
function drawGround() {
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
    ctx.fillStyle = '#A0522D';
    for (let i = 0; i < canvas.width; i += 20) {
        ctx.fillRect(i, groundY, 10, 10);
    }
}

/**
 * Handle window resize
 */
function onWindowResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    groundY = canvas.height - 100;
}

/**
 * Animation loop (NOT affected by cheat multiplier)
 */
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateCamels();
    drawGround();
    renderCamels();
    requestAnimationFrame(animate);
}

/**
 * Handle shovel button click
 */
function handleShovelClick() {
    if (shovelActive) return;

    shovelActive = true;
    groundColliderEnabled = false;

    const shovelButton = document.getElementById('shovelButton');
    shovelButton.classList.add('active');

    const originalGravity = gravity;
    gravity = 2;

    camels.forEach(camel => {
        camel.velocityY += 5;
    });

    setTimeout(() => {
        gravity = originalGravity;
        groundColliderEnabled = true;
        shovelActive = false;
        shovelButton.classList.remove('active');
    }, 3000);
}

/**
 * Update counter displays
 */
function updateCounters() {
    document.getElementById('counter').textContent = counter;
    document.getElementById('goldAmount').textContent = goldAmount;
    updateIncrementalCounters();
    checkProgressiveUnlocks();
}

/**
 * Update caravan button state based on camel count
 */
function updateCaravanButton() {
    const caravanButton = document.getElementById('caravanButton');
    if (counter >= 100) {
        caravanButton.classList.remove('disabled');
        caravanButton.title = 'Convert 100 camels into a caravan 🏕️';
    } else {
        caravanButton.classList.add('disabled');
        caravanButton.title = 'Needs 100 camels to form a caravan';
    }
}

/**
 * Handle caravan button click
 */
function handleCaravanClick() {
    if (counter < 100) return;
    if (!spendCamels(100)) return;
    caravanCount += 1;
    updateIncrementalCounters();
    updateCaravanProgressBar();
    updateNomadButtonState();
    updateStatusMessage('Caravan assembled! 🏕️');
    queueSaveGameState();
}

// Start the game when the page loads
window.addEventListener('load', init);

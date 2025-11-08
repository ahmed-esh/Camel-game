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

// Initialize the game
function init() {
    // Get canvas and context
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Calculate ground position (bottom of screen)
    groundY = canvas.height - 100;
    
    // Load camel image
    loadCamelImage();
    
    // Setup audio
    setupAudio();
    
    // --- Incremental Loop System: restore previous session ---
    loadGameState();
    
    // Add event listeners
    document.getElementById('spawnButton').addEventListener('click', startGame);
    document.getElementById('shovelButton').addEventListener('click', handleShovelClick);
    document.getElementById('caravanButton').addEventListener('click', handleCaravanClick);
    window.addEventListener('resize', onWindowResize);
    
    // --- Incremental Loop System: prepare UI + loops ---
    setupIncrementalLoopSystem();
    
    // Initialize counters and button states
    updateCounters();
    updateCaravanButton();
    
    // Start animation loop
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
    
    // Start background music
    backgroundMusic.volume = 0.3; // Lower volume for background music
    backgroundMusic.play().catch(e => {
        console.log('Background music autoplay blocked:', e);
        // Music will start when user interacts with the page
    });
    
    // Set camel sound volume
    camelSound.volume = 0.7;
}

/**
 * --- Incremental Loop System: create a counter item with emoji icon ---
 * @param {HTMLElement} container - The parent element that will host the counter.
 * @param {string} label - Emoji or text label for the counter icon.
 * @param {string} valueElementId - Identifier for the value span.
 * @param {string} tooltip - Descriptive tooltip for hover.
 * @returns {HTMLElement} - The span element showing the value.
 */
function createResourceCounter(container, label, valueElementId, tooltip) {
    const counterItem = document.createElement('div');
    counterItem.className = 'counter-item';
    if (tooltip) {
        counterItem.title = tooltip;
    }
    
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
 * --- Incremental Loop System: create an emoji-driven icon button ---
 * @param {string} emoji - The emoji that will be shown on the button.
 * @param {string} title - Tooltip text describing the action.
 * @returns {HTMLButtonElement} - The newly created button.
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
 * --- Incremental Loop System: initialize counters, buttons, and status UI ---
 */
function initializeIncrementalUI() {
    const countersContainer = document.getElementById('counters');
    if (!countersContainer) {
        return;
    }
    
    resourceElements.grass = createResourceCounter(countersContainer, '🌿', 'grassAmount', 'Available grass');
    resourceElements.farms = createResourceCounter(countersContainer, '🏡', 'farmCount', 'Farms breeding camels');
    resourceElements.grasslands = createResourceCounter(countersContainer, '🏕️', 'grasslandCount', 'Grasslands generating grass');
    resourceElements.caravans = createResourceCounter(countersContainer, '🏕️', 'caravanCount', 'Active caravans');
    resourceElements.guards = createResourceCounter(countersContainer, '🛡️', 'guardCount', 'Guard camps protecting caravans');
    resourceElements.nomads = createResourceCounter(countersContainer, '🔄', 'nomadTokenCount', 'Nomad tokens for permanent boosts');
    
    statusMessageElement = document.createElement('div');
    statusMessageElement.style.marginTop = '10px';
    statusMessageElement.style.padding = '10px 14px';
    statusMessageElement.style.background = 'rgba(0, 0, 0, 0.35)';
    statusMessageElement.style.borderRadius = '10px';
    statusMessageElement.style.color = '#FFFFFF';
    statusMessageElement.style.fontWeight = '600';
    statusMessageElement.style.minWidth = '180px';
    statusMessageElement.style.fontSize = '16px';
    statusMessageElement.textContent = 'Welcome back to the dunes!';
    countersContainer.appendChild(statusMessageElement);
    
    const iconContainer = document.getElementById('iconButtons');
    const progressBar = document.getElementById('caravanProgress');
    
    if (iconContainer) {
        farmButton = createEmojiButton('🏡', 'Spend 25 🪙 to build a farm that breeds camels.');
        grasslandButton = createEmojiButton('🌿', 'Spend 50 🪙 to cultivate a grassland for grass.');
        guardButton = createEmojiButton('🛡️', 'Spend 100 🪙 to build a guard camp.');
        nomadButton = createEmojiButton('🔄', 'Nomad Migration: reset for Nomad Tokens.');
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
 * --- Incremental Loop System: bind button listeners ---
 */
function attachIncrementalListeners() {
    if (farmButton) {
        farmButton.addEventListener('click', handleFarmPurchase);
    }
    if (grasslandButton) {
        grasslandButton.addEventListener('click', handleGrasslandPurchase);
    }
    if (guardButton) {
        guardButton.addEventListener('click', handleGuardPurchase);
    }
    if (nomadButton) {
        nomadButton.addEventListener('click', handleNomadMigration);
    }
}

/**
 * --- Incremental Loop System: orchestrate UI setup and loops ---
 */
function setupIncrementalLoopSystem() {
    initializeIncrementalUI();
    attachIncrementalListeners();
    startResourceLoop();
    updateNomadButtonState();
    updateIncrementalCounters();
    updateCaravanProgressBar();
}

/**
 * --- Incremental Loop System: create the recurring resource loop ---
 */
function startResourceLoop() {
    if (resourceLoopInterval) {
        // --- Incremental Loop System: prevent duplicate loops ---
        clearInterval(resourceLoopInterval);
    }
    // --- Incremental Loop System: schedule tick every second ---
    resourceLoopInterval = setInterval(() => {
        runResourceTick(1);
    }, 1000);
}

/**
 * --- Incremental Loop System: execute one resource tick ---
 * @param {number} deltaSeconds - Elapsed seconds since previous tick.
 */
function runResourceTick(deltaSeconds) {
    // --- Incremental Loop System: apply passive generation and upkeep ---
    const grassGrowthChanged = applyGrasslandGrowth(deltaSeconds);
    const farmChanged = processFarmProduction(deltaSeconds);
    const grassConsumed = processGrassConsumption(deltaSeconds);
    const caravanGoldChanged = processCaravanGold(deltaSeconds);
    const banditEvent = processBanditRaid(deltaSeconds);
    
    if (grassGrowthChanged || farmChanged || grassConsumed || caravanGoldChanged || banditEvent) {
        updateIncrementalCounters();
        updateCaravanButton();
        queueSaveGameState();
    }
    
    updateCaravanProgressBar();
    updateNomadButtonState();
}

/**
 * --- Incremental Loop System: grass creation from grasslands ---
 * @param {number} deltaSeconds - Elapsed seconds since last check.
 * @returns {boolean} - True when grass changed.
 */
function applyGrasslandGrowth(deltaSeconds) {
    if (grasslandCount === 0 || deltaSeconds <= 0) {
        return false;
    }
    const grassGained = Math.floor(grasslandCount * deltaSeconds);
    if (grassGained <= 0) {
        return false;
    }
    // --- Incremental Loop System: accumulate new grass ---
    grassAmount += grassGained;
    updateStatusMessage(`Grasslands grew ${grassGained} 🌿`);
    return true;
}

/**
 * --- Incremental Loop System: produce camels from farms if grass is ready ---
 * @param {number} deltaSeconds - Elapsed seconds since previous tick.
 * @returns {boolean} - True when camels produced.
 */
function processFarmProduction(deltaSeconds) {
    farmProductionTimer += deltaSeconds;
    if (farmCount === 0 || farmProductionTimer < 2) {
        return false;
    }
    
    const cycles = Math.floor(farmProductionTimer / 2);
    if (cycles === 0) {
        return false;
    }
    
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
    
    // --- Incremental Loop System: convert grass into camels ---
    grassAmount -= camelsProduced;
    farmProductionTimer -= cycles * 2;
    gainCamels(camelsProduced, false);
    updateStatusMessage(`Farms bred ${camelsProduced} 🐪`);
    return true;
}

/**
 * --- Incremental Loop System: grass upkeep for camels ---
 * @param {number} deltaSeconds - Elapsed seconds since previous tick.
 * @returns {boolean} - True when grass changed.
 */
function processGrassConsumption(deltaSeconds) {
    grassConsumptionTimer += deltaSeconds;
    if (grassConsumptionTimer < 10 || counter <= 0) {
        return false;
    }
    
    const cycles = Math.floor(grassConsumptionTimer / 10);
    if (cycles === 0) {
        return false;
    }
    
    const grassNeeded = counter * cycles;
    const grassUsed = Math.min(grassNeeded, grassAmount);
    // --- Incremental Loop System: upkeep cost for herd ---
    grassAmount -= grassUsed;
    grassConsumptionTimer -= cycles * 10;
    
    if (grassUsed < grassNeeded) {
        updateStatusMessage('Grass has run dry! Farms are idle.');
    } else {
        updateStatusMessage(`Camels grazed ${grassUsed} 🌿`);
    }
    
    return grassUsed > 0;
}

/**
 * --- Incremental Loop System: automatic caravan gold payout ---
 * @param {number} deltaSeconds - Elapsed seconds since previous tick.
 * @returns {boolean} - True when gold changed.
 */
function processCaravanGold(deltaSeconds) {
    caravanGoldTimer += deltaSeconds;
    if (caravanCount === 0 || caravanGoldTimer < 60) {
        return false;
    }
    
    const cycles = Math.floor(caravanGoldTimer / 60);
    if (cycles === 0) {
        return false;
    }
    
    let totalGold = 0;
    for (let i = 0; i < caravanCount * cycles; i++) {
        const baseGold = Math.floor(Math.random() * 8) + 14; // 14-21 inclusive
        const multiplier = 1 + nomadTokens * 0.01;
        totalGold += Math.floor(baseGold * multiplier);
    }
    
    // --- Incremental Loop System: reset progress for processed cycles ---
    caravanGoldTimer -= cycles * 60;
    if (totalGold <= 0) {
        return false;
    }
    
    gainGold(totalGold);
    updateStatusMessage(`Caravans hauled ${totalGold} 🪙`);
    return true;
}

/**
 * --- Incremental Loop System: random bandit raid processing ---
 * @param {number} deltaSeconds - Elapsed seconds since previous tick.
 * @returns {boolean} - True when resources changed.
 */
function processBanditRaid(deltaSeconds) {
    banditTimer += deltaSeconds;
    if (banditTimer < 60) {
        return false;
    }
    
    const cycles = Math.floor(banditTimer / 60);
    banditTimer -= cycles * 60;
    
    let resourcesChanged = false;
    for (let i = 0; i < cycles; i++) {
        const attackChance = Math.random() * 0.05 + 0.05; // 5-10%
        if (Math.random() > attackChance) {
            continue;
        }
        
        // --- Incremental Loop System: guards reduce caravan loss chance ---
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
            updateStatusMessage('Bandits were spotted but guards held firm.');
        }
    }
    
    return resourcesChanged;
}

/**
 * --- Incremental Loop System: update floating status label with throttling ---
 * @param {string} message - Message to display.
 */
function updateStatusMessage(message) {
    if (!statusMessageElement || !message) {
        return;
    }
    const now = Date.now();
    if (message === lastStatusText && now - lastStatusUpdateTime < 4000) {
        return;
    }
    statusMessageElement.textContent = message;
    lastStatusText = message;
    lastStatusUpdateTime = now;
}

/**
 * --- Incremental Loop System: add camels to the resource pool ---
 * @param {number} amount - Camels to add.
 * @param {boolean} shouldSpawnVisual - Whether to create physics entities.
 */
function gainCamels(amount, shouldSpawnVisual) {
    if (amount <= 0) {
        return;
    }
    counter += amount;
    if (shouldSpawnVisual) {
        for (let i = 0; i < amount; i++) {
            // --- Incremental Loop System: spawn physics entity for new camel ---
            createCamelEntity();
        }
    }
    updateCounters();
    updateCaravanButton();
    queueSaveGameState();
}

/**
 * --- Incremental Loop System: instantiate a physics camel entity ---
 */
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

/**
 * --- Incremental Loop System: reduce camels if enough are available ---
 * @param {number} amount - Camels to spend.
 * @returns {boolean} - True when deduction succeeds.
 */
function spendCamels(amount) {
    if (amount <= 0 || counter < amount) {
        return false;
    }
    counter -= amount;
    updateCounters();
    updateCaravanButton();
    queueSaveGameState();
    return true;
}

/**
 * --- Incremental Loop System: add gold with multiplier applied ---
 * @param {number} amount - Base gold to add.
 */
function gainGold(amount) {
    if (amount <= 0) {
        return;
    }
    // --- Incremental Loop System: add gold to stash ---
    goldAmount += amount;
    updateCounters();
    queueSaveGameState();
}

/**
 * --- Incremental Loop System: spend gold when affordable ---
 * @param {number} cost - Gold required.
 * @returns {boolean} - True when cost is paid.
 */
function spendGold(cost) {
    if (cost <= 0 || goldAmount < cost) {
        return false;
    }
    // --- Incremental Loop System: deduct gold ---
    goldAmount -= cost;
    updateCounters();
    queueSaveGameState();
    return true;
}

/**
 * --- Incremental Loop System: refresh extended counters ---
 */
function updateIncrementalCounters() {
    if (resourceElements.grass) {
        // --- Incremental Loop System: show available grass ---
        resourceElements.grass.textContent = Math.floor(grassAmount);
    }
    if (resourceElements.farms) {
        // --- Incremental Loop System: show farms count ---
        resourceElements.farms.textContent = farmCount;
    }
    if (resourceElements.grasslands) {
        // --- Incremental Loop System: show grasslands count ---
        resourceElements.grasslands.textContent = grasslandCount;
    }
    if (resourceElements.caravans) {
        // --- Incremental Loop System: show caravans count ---
        resourceElements.caravans.textContent = caravanCount;
    }
    if (resourceElements.guards) {
        // --- Incremental Loop System: show guard camps ---
        resourceElements.guards.textContent = guardCampCount;
    }
    if (resourceElements.nomads) {
        // --- Incremental Loop System: show prestige tokens ---
        resourceElements.nomads.textContent = nomadTokens;
    }
}

/**
 * --- Incremental Loop System: handle farm purchase button ---
 */
function handleFarmPurchase() {
    const cost = 25;
    if (!spendGold(cost)) {
        updateStatusMessage('Need more 🪙 for a farm.');
        return;
    }
    // --- Incremental Loop System: add new farm ---
    farmCount += 1;
    updateIncrementalCounters();
    updateStatusMessage('New farm built! 🏡');
    queueSaveGameState();
}

/**
 * --- Incremental Loop System: handle grassland purchase button ---
 */
function handleGrasslandPurchase() {
    const cost = 50;
    if (!spendGold(cost)) {
        updateStatusMessage('Need more 🪙 for a grassland.');
        return;
    }
    // --- Incremental Loop System: add new grassland ---
    grasslandCount += 1;
    updateIncrementalCounters();
    updateStatusMessage('Fresh grassland cultivated! 🏕️');
    queueSaveGameState();
}

/**
 * --- Incremental Loop System: handle guard camp purchase button ---
 */
function handleGuardPurchase() {
    const cost = 100;
    if (!spendGold(cost)) {
        updateStatusMessage('Need more 🪙 for guards.');
        return;
    }
    // --- Incremental Loop System: add new guard camp ---
    guardCampCount += 1;
    updateIncrementalCounters();
    updateStatusMessage('Guard camp established! 🛡️');
    queueSaveGameState();
}

/**
 * --- Incremental Loop System: update caravan progress UI ---
 */
function updateCaravanProgressBar() {
    const progressBar = document.getElementById('caravanProgress');
    const progressFill = document.getElementById('caravanProgressFill');
    if (!progressBar || !progressFill) {
        return;
    }
    if (caravanCount <= 0) {
        progressBar.classList.add('hidden');
        progressFill.style.width = '0%';
        return;
    }
    progressBar.classList.remove('hidden');
    const progressPercent = Math.min((caravanGoldTimer / 60) * 100, 100);
    progressFill.style.width = `${progressPercent}%`;
}

/**
 * --- Incremental Loop System: enable prestige button when unlocked ---
 */
function updateNomadButtonState() {
    if (!nomadButton) {
        return;
    }
    const unlocked = counter >= 1000 || caravanCount >= 100;
    if (unlocked) {
        // --- Incremental Loop System: prestige available ---
        nomadButton.classList.remove('disabled');
        nomadButton.title = 'Nomad Migration ready!';
    } else {
        // --- Incremental Loop System: prestige locked ---
        nomadButton.classList.add('disabled');
        nomadButton.title = 'Reach 1000 camels or 100 caravans to unlock.';
    }
}

/**
 * --- Incremental Loop System: trigger prestige reset ---
 */
function handleNomadMigration() {
    if (!nomadButton || nomadButton.classList.contains('disabled')) {
        return;
    }
    // --- Incremental Loop System: compute prestige tokens ---
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

/**
 * --- Incremental Loop System: clear resources except prestige tokens ---
 */
function resetResourcesForNomad() {
    // --- Incremental Loop System: wipe loop resources but keep tokens ---
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

/**
 * --- Incremental Loop System: persist state with throttling ---
 */
function queueSaveGameState() {
    if (saveThrottleTimeout) {
        clearTimeout(saveThrottleTimeout);
    }
    // --- Incremental Loop System: debounce saves for performance ---
    saveThrottleTimeout = setTimeout(saveGameState, 500);
}

/**
 * --- Incremental Loop System: write current state to localStorage ---
 */
function saveGameState() {
    // --- Incremental Loop System: snapshot key resources ---
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
        banditTimer
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.error('Failed to save game state:', error);
    }
    saveThrottleTimeout = null;
}

/**
 * --- Incremental Loop System: restore saved progress ---
 */
function loadGameState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return;
        }
        // --- Incremental Loop System: hydrate from storage ---
        const data = JSON.parse(stored);
        counter = Number.isFinite(data.counter) ? data.counter : counter;
        goldAmount = Number.isFinite(data.goldAmount) ? data.goldAmount : goldAmount;
        caravanCount = Number.isFinite(data.caravanCount) ? data.caravanCount : caravanCount;
        farmCount = Number.isFinite(data.farmCount) ? data.farmCount : farmCount;
        grassAmount = Number.isFinite(data.grassAmount) ? data.grassAmount : grassAmount;
        grasslandCount = Number.isFinite(data.grasslandCount) ? data.grasslandCount : grasslandCount;
        guardCampCount = Number.isFinite(data.guardCampCount) ? data.guardCampCount : guardCampCount;
        nomadTokens = Number.isFinite(data.nomadTokens) ? data.nomadTokens : nomadTokens;
        caravanGoldTimer = Number.isFinite(data.caravanGoldTimer) ? data.caravanGoldTimer : 0;
        farmProductionTimer = Number.isFinite(data.farmProductionTimer) ? data.farmProductionTimer : 0;
        grassConsumptionTimer = Number.isFinite(data.grassConsumptionTimer) ? data.grassConsumptionTimer : 0;
        banditTimer = Number.isFinite(data.banditTimer) ? data.banditTimer : 0;
    } catch (error) {
        console.error('Failed to load game state:', error);
    }
}

/**
 * Start the game and spawn first camel
 */
function startGame() {
    if (!isGameStarted) {
        isGameStarted = true;
        // Start background music on first interaction
        backgroundMusic.play().catch(e => console.log('Music play error:', e));
    }
    
    // Play camel sound
    camelSound.currentTime = 0; // Reset to beginning
    camelSound.play().catch(e => console.log('Camel sound error:', e));
    
    spawnCamel();
}

/**
 * Spawn a new camel
 */
function spawnCamel() {
    // Check if image is loaded
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
    // Calculate collision normal (direction from camel1 to camel2)
    const dx = camel2.x - camel1.x;
    const dy = camel2.y - camel1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return; // Avoid division by zero
    
    const nx = dx / distance;
    const ny = dy / distance;
    
    // Separate the camels
    const overlap = (camel1.width + camel2.width) / 2 - distance;
    if (overlap > 0) {
        const separationX = nx * overlap * 0.5;
        const separationY = ny * overlap * 0.5;
        
        camel1.x -= separationX;
        camel1.y -= separationY;
        camel2.x += separationX;
        camel2.y += separationY;
    }
    
    // Calculate relative velocity
    const relativeVelocityX = camel2.velocityX - camel1.velocityX;
    const relativeVelocityY = camel2.velocityY - camel1.velocityY;
    
    // Calculate relative velocity along collision normal
    const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;
    
    // Don't resolve if velocities are separating
    if (velocityAlongNormal > 0) return;
    
    // Calculate restitution (bounciness)
    const restitution = 0.6;
    
    // Calculate impulse scalar
    let impulseScalar = -(1 + restitution) * velocityAlongNormal;
    impulseScalar /= 2; // Since both camels have equal mass
    
    // Apply impulse
    const impulseX = impulseScalar * nx;
    const impulseY = impulseScalar * ny;
    
    camel1.velocityX -= impulseX;
    camel1.velocityY -= impulseY;
    camel2.velocityX += impulseX;
    camel2.velocityY += impulseY;
    
    // Add minimal random rotation when colliding
    camel1.rotationSpeed += (Math.random() - 0.5) * 0.05;
    camel2.rotationSpeed += (Math.random() - 0.5) * 0.05;
}

/**
 * Update camel physics
 */
function updateCamels() {
    camels.forEach((camel, index) => {
        // Apply gravity
        camel.velocityY += gravity;
        
        // Update position
        camel.x += camel.velocityX;
        camel.y += camel.velocityY;
        
        // Update rotation with damping
        camel.rotation += camel.rotationSpeed;
        camel.rotationSpeed *= 0.95; // Slow down rotation over time
        
        // Apply air resistance
        camel.velocityX *= 0.99;
        camel.velocityY *= 0.999;
        
        // Bounce off walls
        if (camel.x <= 0 || camel.x >= canvas.width - camel.width) {
            camel.velocityX *= -0.7; // Bounce with energy loss
            camel.x = Math.max(0, Math.min(canvas.width - camel.width, camel.x));
        }
        
        // Land on ground (only if ground collider is enabled)
        if (groundColliderEnabled && camel.y >= groundY - camel.height) {
            camel.y = groundY - camel.height;
            camel.velocityY *= -0.3; // Bounce with energy loss
            camel.velocityX *= 0.8; // Friction
            camel.rotationSpeed *= 0.9; // Slow down rotation
        }
        
        // Stop very slow movements (only if ground collider is enabled)
        if (groundColliderEnabled && Math.abs(camel.velocityY) < 0.1 && camel.y >= groundY - camel.height - 5) {
            camel.velocityY = 0;
            camel.rotationSpeed *= 0.8; // Gradually stop rotation when landed
        }
        
        // Stop very slow rotation
        if (Math.abs(camel.rotationSpeed) < 0.001) {
            camel.rotationSpeed = 0;
        }
        
        // Remove camels that fall off screen
        if (camel.y > canvas.height + 100) {
            camels.splice(index, 1);
        }
    });
    
    // Check collisions between all camels (always enabled)
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
        
        // Move to camel's anchor point (pivot point)
        ctx.translate(camel.x + camel.anchorX, camel.y + camel.anchorY);
        
        // Apply rotation around the anchor point
        ctx.rotate(camel.rotation);
        
        // Apply scale
        ctx.scale(camel.scale, camel.scale);
        
        // Draw camel image (offset by anchor point)
        if (camelImage.complete) {
            ctx.drawImage(
                camelImage,
                -camel.anchorX,
                -camel.anchorY,
                camel.width,
                camel.height
            );
        } else {
            // Fallback: draw colored rectangle if image not loaded
            ctx.fillStyle = camel.color;
            ctx.fillRect(-camel.anchorX, -camel.anchorY, camel.width, camel.height);
            
            // Draw simple camel shape
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-camel.anchorX - 20, -camel.anchorY - 30, 40, 20); // Body
            ctx.fillRect(-camel.anchorX - 15, -camel.anchorY - 40, 15, 15); // Head
            ctx.fillRect(-camel.anchorX - 10, -camel.anchorY - 45, 8, 8); // Hump
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
    
    // Add some texture to ground
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
 * Animation loop
 */
function animate() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update and render
    updateCamels();
    drawGround();
    renderCamels();
    
    // Continue animation
    requestAnimationFrame(animate);
}

/**
 * Handle shovel button click
 */
function handleShovelClick() {
    if (shovelActive) return; // Prevent multiple activations
    
    shovelActive = true;
    groundColliderEnabled = false; // Disable ground collider so camels fall through
    
    // Add active class for visual feedback
    const shovelButton = document.getElementById('shovelButton');
    shovelButton.classList.add('active');
    
    // Increase gravity to make camels fall faster
    const originalGravity = gravity;
    gravity = 2; // Much stronger gravity
    
    // Make all camels fall down faster
    camels.forEach(camel => {
        camel.velocityY += 5; // Push them down
    });
    
    // After 3 seconds, remove camels and restore ground collider
    setTimeout(() => {
        // Remove all camels that have fallen off screen (they'll be removed automatically)
        // Camels falling through will be removed in the update loop when y > canvas.height + 100
        
        // Restore gravity and ground collider
        gravity = originalGravity;
        groundColliderEnabled = true; // Re-enable ground collider so new camels don't fall through
        shovelActive = false;
        
        // Remove active class
        shovelButton.classList.remove('active');
    }, 3000); // 3 seconds
}

/**
 * Update counter displays
 */
function updateCounters() {
    document.getElementById('counter').textContent = counter;
    document.getElementById('goldAmount').textContent = goldAmount;
    updateIncrementalCounters();
}

/**
 * Update caravan button state based on camel count
 */
function updateCaravanButton() {
    const caravanButton = document.getElementById('caravanButton');
    
    if (counter >= 100) {
        // --- Incremental Loop System: button ready to convert camels ---
        caravanButton.classList.remove('disabled');
        caravanButton.title = 'Convert 100 camels into a caravan 🏕️';
    } else {
        // --- Incremental Loop System: not enough camels yet ---
        caravanButton.classList.add('disabled');
        caravanButton.title = 'Needs 100 camels to form a caravan';
    }
}

/**
 * Handle caravan button click
 */
function handleCaravanClick() {
    if (counter < 100) {
        return;
    }
    
    if (!spendCamels(100)) {
        return;
    }
    // --- Incremental Loop System: establish a new caravan ---
    caravanCount += 1;
    updateIncrementalCounters();
    updateCaravanProgressBar();
    updateNomadButtonState();
    updateStatusMessage('Caravan assembled! 🏕️');
    queueSaveGameState();
}

// Start the game when the page loads
window.addEventListener('load', init);

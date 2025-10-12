/**
 * Camel Drop Game - 2D Version
 * A 2D physics-based game where camels fall and stack with realistic gravity
 */

// Global variables
let canvas, ctx;
let camels = [];
let counter = 0;
let camelImage;
let gravity = 0.5;
let groundY;
let isGameStarted = false;
let backgroundMusic, camelSound;

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
    
    // Add event listeners
    document.getElementById('spawnButton').addEventListener('click', startGame);
    window.addEventListener('resize', onWindowResize);
    
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
    
    // Increment counter
    counter++;
    document.getElementById('counter').textContent = counter;
    
    // Create new camel object
    const camel = {
        x: Math.random() * (canvas.width - 100) + 50, // Random X position
        y: 50, // Start near top
        width: 80, // Camel width
        height: 100, // Camel height
        velocityX: (Math.random() - 0.5) * 2, // Small random horizontal velocity
        velocityY: 0, // Start with no vertical velocity
        rotation: (Math.random() - 0.5) * 0.5, // Small random rotation
        rotationSpeed: (Math.random() - 0.5) * 0.1, // Random rotation speed
        scale: 0.8 + Math.random() * 0.4, // Random scale between 0.8 and 1.2
        color: `hsl(${Math.random() * 60 + 30}, 70%, 60%)` // Random camel-like color
    };
    
    camels.push(camel);
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
    
    // Add some random rotation when colliding
    camel1.rotationSpeed += (Math.random() - 0.5) * 0.2;
    camel2.rotationSpeed += (Math.random() - 0.5) * 0.2;
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
        
        // Update rotation
        camel.rotation += camel.rotationSpeed;
        
        // Apply air resistance
        camel.velocityX *= 0.99;
        camel.velocityY *= 0.999;
        
        // Bounce off walls
        if (camel.x <= 0 || camel.x >= canvas.width - camel.width) {
            camel.velocityX *= -0.7; // Bounce with energy loss
            camel.x = Math.max(0, Math.min(canvas.width - camel.width, camel.x));
        }
        
        // Land on ground
        if (camel.y >= groundY - camel.height) {
            camel.y = groundY - camel.height;
            camel.velocityY *= -0.3; // Bounce with energy loss
            camel.velocityX *= 0.8; // Friction
            camel.rotationSpeed *= 0.9; // Slow down rotation
        }
        
        // Stop very slow movements
        if (Math.abs(camel.velocityY) < 0.1 && camel.y >= groundY - camel.height - 5) {
            camel.velocityY = 0;
            camel.rotationSpeed = 0;
        }
        
        // Remove camels that fall off screen (optional)
        if (camel.y > canvas.height + 100) {
            camels.splice(index, 1);
        }
    });
    
    // Check collisions between all camels
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
        
        // Move to camel center
        ctx.translate(camel.x + camel.width / 2, camel.y + camel.height / 2);
        
        // Apply rotation
        ctx.rotate(camel.rotation);
        
        // Apply scale
        ctx.scale(camel.scale, camel.scale);
        
        // Draw camel image
        if (camelImage.complete) {
            ctx.drawImage(
                camelImage,
                -camel.width / 2,
                -camel.height / 2,
                camel.width,
                camel.height
            );
        } else {
            // Fallback: draw colored rectangle if image not loaded
            ctx.fillStyle = camel.color;
            ctx.fillRect(-camel.width / 2, -camel.height / 2, camel.width, camel.height);
            
            // Draw simple camel shape
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-20, -30, 40, 20); // Body
            ctx.fillRect(-15, -40, 15, 15); // Head
            ctx.fillRect(-10, -45, 8, 8); // Hump
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

// Start the game when the page loads
window.addEventListener('load', init);

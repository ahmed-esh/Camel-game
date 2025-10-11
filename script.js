/**
 * Camel Drop Game
 * A 3D physics-based game where camels fall and stack with realistic gravity
 */

// Global variables
let scene, camera, renderer;
let world; // Physics world
let camelModel; // Loaded camel model template
let camels = []; // Array to store spawned camels with their physics bodies
let counter = 0; // Counter for spawned camels
let isModelLoaded = false; // Flag to check if model is loaded

// Initialize the game
function init() {
    // Create Three.js scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue background
    
    // Set up camera
    camera = new THREE.PerspectiveCamera(
        75, // Field of view
        window.innerWidth / window.innerHeight, // Aspect ratio
        0.1, // Near clipping plane
        1000 // Far clipping plane
    );
    camera.position.set(0, 5, 500);
    camera.lookAt(0, 0, 0);
    
    // Set up renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Enable shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('gameContainer').appendChild(renderer.domElement);
    
    // Set up lighting
    setupLights();
    
    // Set up physics world
    setupPhysics();
    
    // Create ground
    createGround();
    
    // Load camel model
    loadCamelModel();
    
    // Add event listeners
    document.getElementById('spawnButton').addEventListener('click', spawnCamel);
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
}

/**
 * Set up scene lighting
 */
function setupLights() {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Directional light for shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Hemisphere light for natural lighting
    const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
    scene.add(hemisphereLight);
}

/**
 * Set up Cannon.js physics world
 */
function setupPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0); // Realistic Earth gravity
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;
    world.defaultContactMaterial.contactEquationStiffness = 1e8;
    world.defaultContactMaterial.contactEquationRelaxation = 3;
}

/**
 * Create the ground plane with physics
 */
function createGround() {
    // Visual ground (Three.js)
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8b7355,
        roughness: 0.8,
        metalness: 0.2
    });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    
    // Physics ground (Cannon.js)
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ 
        mass: 0, // Static body
        shape: groundShape,
        material: new CANNON.Material({ friction: 0.5, restitution: 0.3 })
    });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.add(groundBody);
}

/**
 * Load the camel GLTF model
 */
function loadCamelModel() {
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        'assets/Bactrian camel.glb',
        function(gltf) {
            // Model loaded successfully
            camelModel = gltf.scene;
            
            // Scale the original model to be much smaller
            camelModel.scale.set(0.00005, 0.00005, 0.00005);
            
            // Enable shadows for all meshes in the model
            camelModel.traverse(function(node) {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            
            isModelLoaded = true;
            console.log('Camel model loaded successfully!');
        },
        function(xhr) {
            // Loading progress
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function(error) {
            // Error loading model
            console.error('Error loading camel model:', error);
            alert('Failed to load camel model. Please check the file path.');
        }
    );
}

/**
 * Spawn a new camel with physics
 */
function spawnCamel() {
    // Check if model is loaded
    if (!isModelLoaded) {
        alert('Please wait for the camel model to load!');
        return;
    }
    
    // Increment counter
    counter++;
    document.getElementById('counter').textContent = counter;
    
    // Clone the camel model
    const camelClone = camelModel.clone();
    
    // Calculate bounding box for physics
    const box = new THREE.Box3().setFromObject(camelClone);
    const size = box.getSize(new THREE.Vector3());
    
    // Position the camel at spawn point (above the screen)
    const spawnX = (Math.random() - 0.5) * 2; // Small random X offset
    const spawnY = 15; // High up
    const spawnZ = (Math.random() - 0.5) * 2; // Small random Z offset
    
    camelClone.position.set(spawnX, spawnY, spawnZ);
    
    // Random rotation for variety
    camelClone.rotation.y = Math.random() * Math.PI * 2;
    
    scene.add(camelClone);
    
    // Create physics body (using box shape approximation)
    const halfExtents = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
    const camelShape = new CANNON.Box(halfExtents);
    const camelBody = new CANNON.Body({
        mass: 5, // 5kg camel
        shape: camelShape,
        material: new CANNON.Material({ friction: 0.5, restitution: 0.2 })
    });
    
    camelBody.position.set(spawnX, spawnY, spawnZ);
    camelBody.quaternion.copy(camelClone.quaternion);
    
    // Add angular damping to slow down spinning
    camelBody.angularDamping = 0.5;
    camelBody.linearDamping = 0.1;
    
    world.add(camelBody);
    
    // Store the camel and its physics body
    camels.push({
        mesh: camelClone,
        body: camelBody
    });
}

/**
 * Handle window resize
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Animation loop
 */
function animate() {
    requestAnimationFrame(animate);
    
    // Update physics world
    world.step(1 / 60); // 60 FPS physics simulation
    
    // Sync Three.js meshes with Cannon.js bodies
    camels.forEach(camel => {
        camel.mesh.position.copy(camel.body.position);
        camel.mesh.quaternion.copy(camel.body.quaternion);
    });
    
    // Render the scene
    renderer.render(scene, camera);
}

// Start the game when the page loads
window.addEventListener('load', init);


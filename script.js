// Global variables
let isGameStarted = false;
let score = 0;
let arSystem;
let scene, camera, renderer;
let bottle;
let scoreElement;
let startButton;
let instructionsElement;
let animationMixers = [];
let clock;
let particleSystem;
let crosshairElement;
let errorMessageElement;
let errorTextElement;

// Initialize the game
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('DOM loaded, initializing game UI');
    
    // Get UI elements
    scoreElement = document.getElementById('score');
    startButton = document.getElementById('start-button');
    instructionsElement = document.getElementById('instructions');
    crosshairElement = document.getElementById('crosshair');
    errorMessageElement = document.getElementById('error-message');
    errorTextElement = document.getElementById('error-text');
    
    // Check if Three.js is loaded
    if (typeof THREE === 'undefined') {
      throw new Error('Three.js is not loaded properly. Please check your imports.');
    }
    
    // Init Three.js clock
    clock = new THREE.Clock();
    
    // Add event listener to start button
    startButton.addEventListener('click', () => {
      console.log('Start button clicked');
      startGame().catch(error => {
        console.error('Error starting game:', error);
        showError('Failed to start the game: ' + error.message);
      });
    });
    
    console.log('Game UI initialized successfully');
  } catch (error) {
    console.error('Error initializing game:', error);
    showError('Failed to initialize the game: ' + error.message);
  }
});

// Wait for MindAR to load
function waitForMindAR() {
  return new Promise((resolve, reject) => {
    // If MindAR is already loaded, resolve immediately
    if (window.mindARLoaded) {
      console.log('MindAR already loaded');
      resolve();
      return;
    }
    
    // Otherwise, wait for the mindarloaded event
    console.log('Waiting for MindAR to load...');
    const timeout = setTimeout(() => {
      reject(new Error('MindAR loading timed out'));
    }, 10000); // 10 second timeout
    
    window.addEventListener('mindarloaded', () => {
      console.log('MindAR loaded event received');
      clearTimeout(timeout);
      resolve();
    });
  });
}

// Show error message
function showError(message) {
  console.error('Game error:', message);
  if (errorTextElement) {
    errorTextElement.textContent = message;
  }
  if (errorMessageElement) {
    errorMessageElement.style.display = 'block';
  } else {
    alert('Error: ' + message);
  }
}

// Start the AR game
async function startGame() {
  try {
    console.log('Starting game');
    
    // Hide instructions and start button
    instructionsElement.classList.add('hidden');
    startButton.classList.add('hidden');
    
    // Set game state
    isGameStarted = true;
    score = 0;
    updateScore();
    
    // Wait for MindAR to load
    try {
      await waitForMindAR();
    } catch (mindARError) {
      console.error('MindAR loading error:', mindARError);
      // Continue anyway, we'll handle this in initAR
    }
    
    // Check camera access
    try {
      console.log('Checking camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('Camera access granted');
      
      // Stop the stream immediately, MindAR will request it again
      stream.getTracks().forEach(track => track.stop());
      
      // Initialize AR
      await initAR();
    } catch (cameraError) {
      console.error('Camera access error:', cameraError);
      
      // Try fallback to non-AR mode
      console.log('Falling back to non-AR mode');
      alert('Camera access was denied or not available. Falling back to a simplified non-AR mode for testing.');
      await initNonARMode();
    }
  } catch (error) {
    console.error('Error in startGame:', error);
    showError('Failed to start the game: ' + error.message);
    throw error;
  }
}

// Initialize AR system
async function initAR() {
  try {
    console.log('Initializing AR system');
    
    // Check if MindAR is loaded
    if (!window.MindARThree) {
      throw new Error('MindAR library is not loaded. Please check your internet connection or try a different browser.');
    }
    
    // Check if the .mind file exists by doing a fetch request
    try {
      console.log('Checking if mind file exists...');
      // Use the correct path to the sample marker
      const mindFilePath = 'https://hiukim.github.io/mind-ar-js-doc/assets/targets/card.mind';
      const response = await fetch(mindFilePath, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Mind file not found (${response.status}). Please ensure the target file has been properly compiled.`);
      }
      console.log('Mind file exists and is accessible');
    } catch (fileError) {
      console.error('Mind file error:', fileError);
      showError('Target file is missing or inaccessible. Please make sure you have uploaded the compiled .mind file to the correct location.');
      throw fileError;
    }
    
    console.log('Creating MindAR system...');
    
    // Create a container for the AR content
    const container = document.getElementById('game-container');
    container.innerHTML = ''; // Clear existing content
    
    // Initialize the AR experience with the MindARThree constructor
    console.log('Using MindARThree API:', typeof window.MindARThree);
    const mindarThree = new window.MindARThree({
      container: container,
      imageTargetSrc: 'https://hiukim.github.io/mind-ar-js-doc/assets/targets/card.mind',
    });
    
    // Create Three.js scene and get components
    const {renderer, scene, camera} = mindarThree;
    
    // Store references for global use
    window.scene = scene;
    window.camera = camera;
    window.renderer = renderer;
    arSystem = mindarThree;
    
    console.log('Creating anchor');
    // Create the anchor for the bottle (use the exported method to create an anchor)
    const anchor = mindarThree.addAnchor(0);
    
    console.log('Creating bottle model');
    // Create a bottle 3D model or placeholder
    const bottleModel = await createPlaceholderBottleSimple(null);
    anchor.group.add(bottleModel);
    
    console.log('Setting up lighting');
    // Set up lighting
    setupLighting(scene);
    
    console.log('Initializing particle system');
    // Initialize particle system for effects
    initParticleSystem(scene);
    
    console.log('Adding event listener for shooting');
    // Add event listener for shooting
    document.addEventListener('click', shoot);
    
    console.log('Starting AR');
    // Start AR experience
    await mindarThree.start();
    
    console.log('AR system started successfully');
  } catch (error) {
    console.error('Error initializing AR:', error);
    showError('Failed to initialize AR: ' + error.message);
    throw error;
  }
}

// Create 3D model for the bottle
async function createBottleModel(anchor) {
  try {
    console.log('Creating bottle model');
    
    // Check if the GLTFLoader is available from the Three.js instance bundled with MindAR
    if (!THREE.GLTFLoader) {
      console.log('GLTFLoader not available, creating a placeholder bottle instead');
      createPlaceholderBottle(anchor);
      return;
    }
    
    // Try to load 3D model
    try {
      console.log('Attempting to load 3D model...');
      const gltfLoader = new THREE.GLTFLoader();
      const bottleModel = await new Promise((resolve, reject) => {
        gltfLoader.load(
          'assets/models/bottle.glb', // Path to your 3D model
          (gltf) => resolve(gltf),
          (progress) => console.log('Loading model:', (progress.loaded / progress.total * 100) + '%'),
          (error) => reject(error)
        );
      });
      
      console.log('3D model loaded successfully');
      // If 3D model loaded successfully
      bottle = bottleModel.scene;
      bottle.userData.isTarget = true;
      
      // Setup animations if they exist
      if (bottleModel.animations && bottleModel.animations.length) {
        console.log('Setting up model animations');
        const mixer = new THREE.AnimationMixer(bottle);
        animationMixers.push(mixer);
        
        // Play all animations
        bottleModel.animations.forEach(clip => {
          mixer.clipAction(clip).play();
        });
      }
      
      // Adjust scale as needed
      bottle.scale.set(0.5, 0.5, 0.5);
      
      // Add the model to the anchor
      anchor.group.add(bottle);
      
      // Mark all meshes in the model as targets for shooting
      bottle.traverse(child => {
        if (child.isMesh) {
          child.userData.isTarget = true;
        }
      });
      
      console.log('3D model setup complete');
    } catch (modelError) {
      console.warn('Could not load 3D model:', modelError);
      // Fallback to a simple placeholder cube
      createPlaceholderBottle(anchor);
    }
  } catch (error) {
    console.error('Error creating bottle model:', error);
    // Fallback to a simple placeholder cube
    createPlaceholderBottle(anchor);
  }
}

// Create a simple placeholder bottle if 3D model fails to load
function createPlaceholderBottle(anchor) {
  try {
    console.log('Creating placeholder bottle');
    // Create a simple bottle shape using basic Three.js geometries
    const bottleGroup = new THREE.Group();
    bottleGroup.userData.isTarget = true;
    
    // Bottle body
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 16);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x6b4423, // Brown color for chocolate milk
      transparent: true,
      opacity: 0.8
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    
    // Bottle neck
    const neckGeometry = new THREE.CylinderGeometry(0.15, 0.3, 0.3, 16);
    const neck = new THREE.Mesh(neckGeometry, bodyMaterial);
    neck.position.y = 0.65;
    
    // Bottle cap
    const capGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
    const capMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 }); // Red cap
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.y = 0.85;
    
    // Add all parts to the bottle group
    bottleGroup.add(body);
    bottleGroup.add(neck);
    bottleGroup.add(cap);
    
    // Set bottle position
    bottleGroup.position.y = 0.5;
    
    // Add the bottle group to the anchor
    anchor.group.add(bottleGroup);
    
    // Store reference to the bottle for collision detection
    bottle = bottleGroup;
    
    // Mark all children as targets
    bottle.traverse(child => {
      if (child.isMesh) {
        child.userData.isTarget = true;
      }
    });
    
    console.log('Placeholder bottle created successfully');
  } catch (error) {
    console.error('Error creating placeholder bottle:', error);
    showError('Failed to create bottle model: ' + error.message);
  }
}

// Set up scene lighting
function setupLighting(scene) {
  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // Add directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0, 5, 0);
  scene.add(directionalLight);
}

// Initialize particle system for visual effects
function initParticleSystem(scene) {
  try {
    // Create particle geometry
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 50;
    
    // Create position array for particles
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    const lifetimes = [];
    
    // Initialize particle positions (not visible initially)
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = 0;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = 0;
      
      // Store velocity and lifetime in separate arrays
      velocities.push(new THREE.Vector3(0, 0, 0));
      lifetimes.push(0);
    }
    
    // Set particle geometry attributes
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Create particle material
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xff0000,
      size: 0.05,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    // Create particle system
    particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    particleSystem.userData.velocities = velocities;
    particleSystem.userData.lifetimes = lifetimes;
    
    // Add to scene
    scene.add(particleSystem);
  } catch (error) {
    console.error('Error initializing particle system:', error);
  }
}

// Update particle positions and lifetimes
function updateParticles() {
  if (!particleSystem || !particleSystem.geometry || !particleSystem.geometry.attributes.position) return;
  const positions = particleSystem.geometry.attributes.position.array;
  const velocities = particleSystem.userData.velocities;
  const lifetimes = particleSystem.userData.lifetimes;
  
  let needsUpdate = false;
  
  // Update each particle
  for (let i = 0; i < lifetimes.length; i++) {
    // Only update active particles
    if (lifetimes[i] > 0) {
      needsUpdate = true;
      
      // Update lifetime
      lifetimes[i] -= 0.01;
      
      // Update position based on velocity
      const i3 = i * 3;
      positions[i3] += velocities[i].x;
      positions[i3 + 1] += velocities[i].y;
      positions[i3 + 2] += velocities[i].z;
      
      // Apply gravity
      velocities[i].y -= 0.001;
    }
  }
  
  // Update geometry if needed
  if (needsUpdate) {
    particleSystem.geometry.attributes.position.needsUpdate = true;
  }
}

// Emit particles at a point
function emitParticles(point, count = 20) {
  if (!particleSystem || !particleSystem.geometry || !particleSystem.geometry.attributes.position) return;
  const positions = particleSystem.geometry.attributes.position.array;
  const velocities = particleSystem.userData.velocities;
  const lifetimes = particleSystem.userData.lifetimes;
  
  // Find inactive particles and activate them
  let activatedCount = 0;
  
  for (let i = 0; i < lifetimes.length && activatedCount < count; i++) {
    if (lifetimes[i] <= 0) {
      // Activate particle
      lifetimes[i] = 1.0; // Set lifetime
      
      // Set position to emission point
      const i3 = i * 3;
      positions[i3] = point.x;
      positions[i3 + 1] = point.y;
      positions[i3 + 2] = point.z;
      
      // Set random velocity
      velocities[i].set(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05 + 0.02, // Slight upward bias
        (Math.random() - 0.5) * 0.05
      );
      
      activatedCount++;
    }
  }
  
  // Update geometry
  particleSystem.geometry.attributes.position.needsUpdate = true;
}

// Handle shooting
function shoot(event) {
  if (!isGameStarted || !camera || !bottle) return;
  
  // Animate crosshair on tap
  if (crosshairElement) {
    crosshairElement.classList.add('crosshair-shoot');
    setTimeout(() => {
      crosshairElement.classList.remove('crosshair-shoot');
    }, 150); // Animation duration
  }

  // Create a raycaster from the camera through the tap position
  const raycaster = new THREE.Raycaster();
  
  // Calculate normalized device coordinates (-1 to +1) for the tap
  const tapX = (event.clientX / window.innerWidth) * 2 - 1;
  const tapY = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Set the raycaster origin and direction
  raycaster.setFromCamera({ x: tapX, y: tapY }, camera);
  
  // Check for intersection with the bottle (including all child meshes)
  const targets = [];
  bottle.traverse(child => {
    if (child.isMesh && child.userData.isTarget) {
      targets.push(child);
    }
  });
  
  const intersects = raycaster.intersectObjects(targets, true);
  
  if (intersects.length > 0) {
    // Hit detected
    handleHit(intersects[0].point);
  } else {
    // Miss detected
    handleMiss();
  }
}

// Handle successful hit
function handleHit(hitPoint) {
  // Increase score
  score += 10;
  updateScore();
  
  // Create hit effect
  emitParticles(hitPoint, 30);
  
  // Make the bottle flash
  flashBottle();
  
  // Play hit sound (if available)
  playSound('hit');
}

// Handle miss
function handleMiss() {
  // Could add some visual feedback for missed shots
  console.log('Missed the target');
  
  // Play miss sound (if available)
  playSound('miss');
}

// Play sound effect
function playSound(type) {
  // Create audio element
  const audio = new Audio();
  audio.preload = 'auto'; // Preload audio for faster playback
  
  // Set source based on type
  if (type === 'hit') {
    audio.src = 'assets/sounds/hit.mp3';
  } else if (type === 'miss') {
    audio.src = 'assets/sounds/miss.mp3';
  }
  
  // Play the sound (will be ignored if file doesn't exist)
  audio.play().catch(error => {
    // Ignore errors (file might not exist)
    console.log('Sound not available:', error.message);
  });
}

// Make the bottle flash when hit
function flashBottle() {
  // Flash all materials in the bottle model
  if (!bottle) return;
  bottle.traverse(child => {
    if (child.isMesh && child.material) {
      // Store original material color
      const originalColor = child.material.color ? child.material.color.clone() : null;
      
      // Change to hit color (if material has color)
      if (child.material.color) {
        child.material.color.set(0xff0000);
        
        // Reset to original color after a short delay
        setTimeout(() => {
          if (originalColor) {
            child.material.color.copy(originalColor);
          }
        }, 200);
      }
    }
  });
}

// Update score display
function updateScore() {
  scoreElement.textContent = score.toString();
}

// Clean up resources when the game ends
function endGame() {
  // Stop AR system
  if (arSystem) {
    arSystem.stop();
  }
  
  // Reset game state
  isGameStarted = false;
  
  // Show start button and instructions
  startButton.classList.remove('hidden');
  instructionsElement.classList.remove('hidden');
}

// Add window resize handler
window.addEventListener('resize', () => {
  if (arSystem && arSystem.renderer && camera) {
    arSystem.renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
});

// Update crosshair active state
function updateCrosshairActiveState() {
  try {
    if (!crosshairElement || !camera || !bottle || !scene) return;

    const raycaster = new THREE.Raycaster();
    // Raycast from the center of the screen (where the crosshair is)
    raycaster.setFromCamera({ x: 0, y: 0 }, camera); 

    const targets = [];
    // Ensure bottle and its children are valid targets
    if (bottle.userData.isTarget) { // Check the main bottle group/object first
        bottle.traverse(child => {
            if (child.isMesh && child.visible) { // Only consider visible meshes
                 targets.push(child);
            }
        });
    }

    const intersects = raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      crosshairElement.classList.add('crosshair-active');
    } else {
      crosshairElement.classList.remove('crosshair-active');
    }
  } catch (error) {
    console.error('Error updating crosshair state:', error);
  }
}

// Initialize a simplified non-AR mode for testing or when camera isn't available
async function initNonARMode() {
  try {
    console.log('Initializing non-AR mode');
    
    // Create a simple scene, camera, and renderer
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x505050); // Gray background
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    const container = document.getElementById('game-container');
    if (container) {
      container.innerHTML = ''; // Clear container first
      container.appendChild(renderer.domElement);
    } else {
      console.error('Game container element not found');
      document.body.appendChild(renderer.domElement);
    }
    
    // Create a simple group to act as an anchor
    const anchor = new THREE.Group();
    if (!anchor) {
      throw new Error('Failed to create anchor group');
    }
    
    scene.add(anchor);
    
    // Create a bottle model
    console.log('Creating placeholder bottle');
    createPlaceholderBottleSimple(scene);
    
    // Set up lighting
    setupLighting(scene);
    
    // Initialize particle system
    initParticleSystem(scene);
    
    // Add event listener for shooting
    document.addEventListener('click', shoot);
    
    // Animation loop
    clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      try {
        // Update animations
        const delta = clock.getDelta();
        for (let mixer of animationMixers) {
          mixer.update(delta);
        }
        
        // Update particles if they exist
        if (particleSystem) {
          updateParticles();
        }
        
        // Rotate the bottle slowly for better visibility
        if (bottle) {
          bottle.rotation.y += 0.01;
        }
        
        // Update crosshair active state
        if (isGameStarted && camera && bottle) {
          updateCrosshairActiveState();
        }
        
        // Render the scene
        renderer.render(scene, camera);
      } catch (error) {
        console.error('Error in animation loop:', error);
      }
    });
    
    console.log('Non-AR mode initialized successfully');
  } catch (error) {
    console.error('Error initializing non-AR mode:', error);
    showError('Failed to initialize non-AR mode: ' + error.message);
  }
}

// A simpler version of createPlaceholderBottle for the fallback mode
function createPlaceholderBottleSimple(scene) {
  try {
    // Create a simple bottle shape directly in the scene
    const bottleGroup = new THREE.Group();
    bottleGroup.userData.isTarget = true;
    
    // Bottle body
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 16);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x6b4423, // Brown color for chocolate milk
      transparent: true,
      opacity: 0.8
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    
    // Bottle neck
    const neckGeometry = new THREE.CylinderGeometry(0.15, 0.3, 0.3, 16);
    const neck = new THREE.Mesh(neckGeometry, bodyMaterial);
    neck.position.y = 0.65;
    
    // Bottle cap
    const capGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
    const capMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 }); // Red cap
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.y = 0.85;
    
    // Add all parts to the bottle group
    bottleGroup.add(body);
    bottleGroup.add(neck);
    bottleGroup.add(cap);
    
    // Set bottle position
    bottleGroup.position.y = 0.5;
    
    // Add the bottle group to the scene if scene is provided
    if (scene) {
      scene.add(bottleGroup);
    }
    
    // Store reference to the bottle for collision detection
    bottle = bottleGroup;
    
    // Mark all children as targets
    bottle.traverse(child => {
      if (child.isMesh) {
        child.userData.isTarget = true;
      }
    });
    
    console.log('Simple placeholder bottle created successfully');
    return bottleGroup;
  } catch (error) {
    console.error('Error creating simple placeholder bottle:', error);
    showError('Failed to create bottle model: ' + error.message);
    
    // Absolute fallback - create a simple box
    try {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
      const boxMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const box = new THREE.Mesh(boxGeometry, boxMaterial);
      if (scene) {
        scene.add(box);
      }
      bottle = box;
      bottle.userData.isTarget = true;
      return box;
    } catch (fallbackError) {
      console.error('Critical error - even fallback object creation failed:', fallbackError);
    }
  }
} 
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';

// Game variables
let scene, camera, renderer, controls;
let loadingElement, teamSelectModal, classSelectModal, gameOverModal;
let currentPlayerTeam = null;
let currentPlayerClass = null;
let gameActive = false;
let gameTime = 5 * 60; // 5 minutes in seconds
let redScore = 0;
let blueScore = 0;
let room;

// Initialize WebsimSocket and game
async function init() {
    setupScene();
    setupUI();
    
    // Initialize multiplayer
    room = new WebsimSocket();
    await room.initialize();
    
    // Setup event listeners
    setupEventListeners();
    
    // Subscribe to presence and room state
    subscribeToMultiplayerState();
    
    // Initialize player state in presence
    initializePlayerState();
    
    loadingElement.style.display = 'none';
    startRenderLoop();
}

function setupScene() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 20);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('game-canvas') });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Create the game world
    createGameWorld();
    
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function createGameWorld() {
    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x556B2F,
        side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create Red Castle
    createCastle(-30, 0, 0xff5555, 'red');
    
    // Create Blue Castle
    createCastle(30, 0, 0x5555ff, 'blue');
    
    // Add some terrain elements
    createTerrain();
}

function createCastle(x, z, color, team) {
    // Base/foundation
    const baseGeometry = new THREE.BoxGeometry(20, 1, 20);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(x, 0.5, z);
    base.receiveShadow = true;
    base.castShadow = true;
    scene.add(base);
    
    // Main castle structure
    const castleGeometry = new THREE.BoxGeometry(16, 10, 16);
    const castleMaterial = new THREE.MeshStandardMaterial({ color });
    const castle = new THREE.Mesh(castleGeometry, castleMaterial);
    castle.position.set(x, 6, z);
    castle.receiveShadow = true;
    castle.castShadow = true;
    scene.add(castle);
    
    // Castle towers (4 corners)
    const towerPositions = [
        [x + 8, z + 8],
        [x + 8, z - 8],
        [x - 8, z + 8],
        [x - 8, z - 8]
    ];
    
    towerPositions.forEach(pos => {
        createTower(pos[0], pos[1], color);
    });
    
    // Castle entrance
    const entranceGeometry = new THREE.BoxGeometry(6, 6, 1);
    const entranceMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const entrance = new THREE.Mesh(entranceGeometry, entranceMaterial);
    
    // Position entrance based on team
    if (team === 'red') {
        entrance.position.set(x, 3, z + 8.5);
    } else {
        entrance.position.set(x, 3, z - 8.5);
    }
    
    entrance.receiveShadow = true;
    entrance.castShadow = true;
    scene.add(entrance);
    
    // Upper floor/battlement
    const battlementGeometry = new THREE.BoxGeometry(18, 1, 18);
    const battlementMaterial = new THREE.MeshStandardMaterial({ color: 0x999999 });
    const battlement = new THREE.Mesh(battlementGeometry, battlementMaterial);
    battlement.position.set(x, 11.5, z);
    battlement.receiveShadow = true;
    battlement.castShadow = true;
    scene.add(battlement);
    
    // Add crenellations (castle top pattern)
    for (let i = -8; i <= 8; i += 2) {
        for (let j of [-9, 9]) {
            // Front and back walls
            const crenellationGeometry = new THREE.BoxGeometry(1, 2, 1);
            const crenellation = new THREE.Mesh(crenellationGeometry, castleMaterial);
            crenellation.position.set(x + i, 13, z + j);
            crenellation.castShadow = true;
            scene.add(crenellation);
        }
        
        for (let j of [-9, 9]) {
            // Side walls
            const crenellationGeometry = new THREE.BoxGeometry(1, 2, 1);
            const crenellation = new THREE.Mesh(crenellationGeometry, castleMaterial);
            crenellation.position.set(x + j, 13, z + i);
            crenellation.castShadow = true;
            scene.add(crenellation);
        }
    }
    
    // Add flag
    const flagpoleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5);
    const flagpoleMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const flagpole = new THREE.Mesh(flagpoleGeometry, flagpoleMaterial);
    flagpole.position.set(x, 14, z);
    scene.add(flagpole);
    
    const flagGeometry = new THREE.PlaneGeometry(2, 1);
    const flagMaterial = new THREE.MeshStandardMaterial({ 
        color,
        side: THREE.DoubleSide 
    });
    const flag = new THREE.Mesh(flagGeometry, flagMaterial);
    flag.position.set(x + 1, 13.5, z);
    flag.userData = { team, type: 'flag' };
    scene.add(flag);
    
    // Add ramps to upper level
    const rampGeometry = new THREE.BoxGeometry(4, 0.5, 8);
    const rampMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    
    // First ramp (lower)
    const ramp1 = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp1.position.set(x, 2, z + 4);
    ramp1.rotation.x = Math.PI / 8;
    scene.add(ramp1);
    
    // Second ramp (middle)
    const ramp2 = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp2.position.set(x, 6, z);
    ramp2.rotation.x = Math.PI / 8;
    ramp2.rotation.y = Math.PI / 2;
    scene.add(ramp2);
    
    // Third ramp (upper)
    const ramp3 = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp3.position.set(x, 10, z - 4);
    ramp3.rotation.x = Math.PI / 8;
    scene.add(ramp3);
}

function createTower(x, z, color) {
    const towerGeometry = new THREE.CylinderGeometry(2, 2, 15, 8);
    const towerMaterial = new THREE.MeshStandardMaterial({ color: color });
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.position.set(x, 7.5, z);
    tower.receiveShadow = true;
    tower.castShadow = true;
    scene.add(tower);
    
    // Tower top
    const towerTopGeometry = new THREE.ConeGeometry(3, 4, 8);
    const towerTopMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const towerTop = new THREE.Mesh(towerTopGeometry, towerTopMaterial);
    towerTop.position.set(x, 17, z);
    towerTop.receiveShadow = true;
    towerTop.castShadow = true;
    scene.add(towerTop);
}

function createTerrain() {
    // Add some trees
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * 80 - 40;
        const z = Math.random() * 80 - 40;
        
        // Don't place trees too close to castles
        if (Math.sqrt(Math.pow(x - 30, 2) + Math.pow(z, 2)) < 15 ||
            Math.sqrt(Math.pow(x + 30, 2) + Math.pow(z, 2)) < 15) {
            continue;
        }
        
        createTree(x, z);
    }
    
    // Add some rocks
    for (let i = 0; i < 10; i++) {
        const x = Math.random() * 60 - 30;
        const z = Math.random() * 60 - 30;
        
        // Don't place rocks too close to castles
        if (Math.sqrt(Math.pow(x - 30, 2) + Math.pow(z, 2)) < 15 ||
            Math.sqrt(Math.pow(x + 30, 2) + Math.pow(z, 2)) < 15) {
            continue;
        }
        
        createRock(x, z);
    }
}

function createTree(x, z) {
    // Tree trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 4);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(x, 2, z);
    trunk.castShadow = true;
    scene.add(trunk);
    
    // Tree foliage
    const foliageGeometry = new THREE.ConeGeometry(2, 4, 8);
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.set(x, 5, z);
    foliage.castShadow = true;
    scene.add(foliage);
}

function createRock(x, z) {
    const rockGeometry = new THREE.DodecahedronGeometry(1 + Math.random());
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(x, 0.5, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
}

function setupUI() {
    loadingElement = document.getElementById('loading');
    teamSelectModal = document.getElementById('team-select');
    classSelectModal = document.getElementById('class-select');
    gameOverModal = document.getElementById('game-over');
    
    // Team selection
    document.getElementById('join-red').addEventListener('click', () => selectTeam('red'));
    document.getElementById('join-blue').addEventListener('click', () => selectTeam('blue'));
    document.getElementById('join-auto').addEventListener('click', () => selectTeam('auto'));
    
    // Class selection
    document.getElementById('class-knight').addEventListener('click', () => selectClass('knight'));
    document.getElementById('class-archer').addEventListener('click', () => selectClass('archer'));
    document.getElementById('class-mage').addEventListener('click', () => selectClass('mage'));
    
    // Play again button
    document.getElementById('play-again').addEventListener('click', restartGame);
}

function setupEventListeners() {
    // Game controls (WASD, Space, etc)
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
}

function handleKeyDown(event) {
    if (!gameActive) return;
    
    // Handle movement
    if (event.key === 'w' || event.key === 'ArrowUp') {
        movePlayer('forward');
    } else if (event.key === 's' || event.key === 'ArrowDown') {
        movePlayer('backward');
    } else if (event.key === 'a' || event.key === 'ArrowLeft') {
        movePlayer('left');
    } else if (event.key === 'd' || event.key === 'ArrowRight') {
        movePlayer('right');
    }
    
    // Jump
    if (event.key === ' ') {
        jumpPlayer();
    }
    
    // Interaction
    if (event.key === 'f') {
        interactWithObject();
    }
    
    // Switch weapon
    if (event.key === 'q') {
        switchWeapon();
    }
    
    // Reload
    if (event.key === 'r') {
        reloadWeapon();
    }
}

function handleKeyUp(event) {
    // Handle key up events
}

function handleMouseDown(event) {
    if (!gameActive) return;
    
    if (event.button === 0) { // Left click
        attack();
    } else if (event.button === 2) { // Right click
        defend();
    }
}

function handleMouseMove(event) {
    if (!gameActive) return;
    
    // Update player's look direction based on mouse movement
    // Will be implemented with first person controls
}

function movePlayer(direction) {
    // Get current player's position
    const playerPosition = room.presence[room.clientId]?.position || { x: 0, y: 0, z: 0 };
    
    // Calculate new position based on direction
    let newPosition = { ...playerPosition };
    const moveSpeed = 0.5;
    
    switch (direction) {
        case 'forward':
            newPosition.z -= moveSpeed;
            break;
        case 'backward':
            newPosition.z += moveSpeed;
            break;
        case 'left':
            newPosition.x -= moveSpeed;
            break;
        case 'right':
            newPosition.x += moveSpeed;
            break;
    }
    
    // Update player position
    room.updatePresence({
        position: newPosition
    });
}

function jumpPlayer() {
    // Implement jump mechanics
    console.log('Player jumped');
    
    // Send jump event
    room.send({
        type: 'playerAction',
        action: 'jump'
    });
}

function interactWithObject() {
    // Check if player is near flag or other interactive objects
    console.log('Player interaction');
    
    // Example: Checking if near enemy flag
    const playerPosition = room.presence[room.clientId].position;
    const playerTeam = room.presence[room.clientId].team;
    
    // Placeholder logic for flag capture
    if (isNearEnemyFlag(playerPosition, playerTeam)) {
        captureFlag();
    }
}

function isNearEnemyFlag(playerPosition, playerTeam) {
    // Check if player is near enemy flag
    // This is placeholder logic - would need actual collision detection
    const enemyTeam = playerTeam === 'red' ? 'blue' : 'red';
    const flagX = enemyTeam === 'red' ? -30 : 30;
    
    const distance = Math.sqrt(
        Math.pow(playerPosition.x - flagX, 2) + 
        Math.pow(playerPosition.z, 2)
    );
    
    return distance < 5; // If player is within 5 units of enemy flag
}

function captureFlag() {
    const playerTeam = room.presence[room.clientId].team;
    
    // Update room state with flag capture
    room.updateRoomState({
        flags: {
            [playerTeam === 'red' ? 'blue' : 'red']: {
                status: 'captured',
                carrier: room.clientId
            }
        }
    });
    
    // Broadcast flag capture event
    room.send({
        type: 'flagCaptured',
        team: playerTeam,
        player: room.clientId
    });
}

function switchWeapon() {
    const currentWeapon = room.presence[room.clientId].weapon;
    let newWeapon;
    
    // Cycle through weapons based on class
    switch (currentPlayerClass) {
        case 'knight':
            newWeapon = currentWeapon === 'sword' ? 'shield' : 'sword';
            break;
        case 'archer':
            newWeapon = currentWeapon === 'bow' ? 'dagger' : 'bow';
            break;
        case 'mage':
            newWeapon = currentWeapon === 'staff' ? 'spellbook' : 'staff';
            break;
    }
    
    // Update player's weapon
    room.updatePresence({
        weapon: newWeapon
    });
    
    console.log(`Switched to ${newWeapon}`);
}

function reloadWeapon() {
    // Only relevant for archer
    if (currentPlayerClass === 'archer') {
        room.updatePresence({
            ammo: 10 // Reset to max ammo
        });
        
        // Update UI
        document.getElementById('ammo-count').textContent = '10';
        
        console.log('Reloaded arrows');
    }
}

function attack() {
    if (!gameActive) return;
    
    const playerTeam = room.presence[room.clientId].team;
    const playerPosition = room.presence[room.clientId].position;
    const playerWeapon = room.presence[room.clientId].weapon;
    
    // Send attack event
    room.send({
        type: 'playerAttack',
        team: playerTeam,
        position: playerPosition,
        weapon: playerWeapon
    });
    
    // Check for hits on other players
    // This is simplified - would need proper hit detection
    checkAttackHits(playerPosition, playerTeam, playerWeapon);
}

function checkAttackHits(attackerPosition, attackerTeam, weapon) {
    // Get all players
    const players = Object.entries(room.presence).filter(([id, data]) => 
        id !== room.clientId && data.team !== attackerTeam
    );
    
    // Check range based on weapon
    let attackRange = 2; // Default melee range
    
    if (weapon === 'bow') {
        attackRange = 15; // Bow has longer range
        
        // Decrease ammo
        const currentAmmo = room.presence[room.clientId].ammo - 1;
        room.updatePresence({ ammo: currentAmmo });
        
        // Update UI
        document.getElementById('ammo-count').textContent = currentAmmo;
    } else if (weapon === 'staff') {
        attackRange = 10; // Staff has medium range
    }
    
    // Check for hits
    for (const [playerId, playerData] of players) {
        const targetPosition = playerData.position;
        
        // Calculate distance
        const distance = Math.sqrt(
            Math.pow(attackerPosition.x - targetPosition.x, 2) + 
            Math.pow(attackerPosition.z - targetPosition.z, 2)
        );
        
        if (distance <= attackRange) {
            // Hit detected, request presence update
            // The damage amount depends on the weapon and class
            let damage = 10; // Default damage
            
            if (currentPlayerClass === 'knight' && weapon === 'sword') {
                damage = 20;
            } else if (currentPlayerClass === 'archer' && weapon === 'bow') {
                damage = 15;
            } else if (currentPlayerClass === 'mage' && weapon === 'staff') {
                damage = 12;
            }
            
            room.requestPresenceUpdate(playerId, {
                type: 'damage',
                amount: damage
            });
            
            // Send hit event
            room.send({
                type: 'playerHit',
                target: playerId,
                weapon: weapon,
                damage: damage
            });
        }
    }
}

function defend() {
    if (!gameActive) return;
    
    console.log('Player defending');
    
    // Update player state to defending
    room.updatePresence({
        action: 'defending',
        defenseStart: Date.now()
    });
    
    // Send defend event
    room.send({
        type: 'playerAction',
        action: 'defend'
    });
}

function selectTeam(team) {
    if (team === 'auto') {
        // Auto-assign based on current team counts
        const redTeamCount = Object.values(room.presence).filter(p => p.team === 'red').length;
        const blueTeamCount = Object.values(room.presence).filter(p => p.team === 'blue').length;
        
        team = redTeamCount <= blueTeamCount ? 'red' : 'blue';
    }
    
    currentPlayerTeam = team;
    
    // Update team indicator
    const teamIndicator = document.getElementById('team-indicator');
    teamIndicator.style.backgroundColor = team === 'red' ? '#ff5555' : '#5555ff';
    
    // Hide team select, show class select
    teamSelectModal.classList.add('hidden');
    classSelectModal.classList.remove('hidden');
}

function selectClass(className) {
    currentPlayerClass = className;
    
    // Initialize player with class-specific attributes
    let initialWeapon, health, speed;
    
    switch (className) {
        case 'knight':
            initialWeapon = 'sword';
            health = 150;
            speed = 0.8;
            break;
        case 'archer':
            initialWeapon = 'bow';
            health = 100;
            speed = 1.2;
            break;
        case 'mage':
            initialWeapon = 'staff';
            health = 80;
            speed = 1.0;
            break;
    }
    
    // Update player in presence
    room.updatePresence({
        team: currentPlayerTeam,
        class: className,
        weapon: initialWeapon,
        health: health,
        maxHealth: health,
        speed: speed,
        position: { 
            x: currentPlayerTeam === 'red' ? -30 : 30,
            y: 1,
            z: 0
        },
        rotation: { x: 0, y: 0, z: 0 },
        ammo: className === 'archer' ? 10 : 0,
        action: 'idle',
        alive: true
    });
    
    // Hide class select
    classSelectModal.classList.add('hidden');
    
    // Start the game
    gameActive = true;
    
    // Update health UI
    updateHealthUI(health);
    
    // Setup first-person controls
    setupFirstPersonControls();
}

function updateHealthUI(health) {
    const maxHealth = room.presence[room.clientId].maxHealth;
    const healthPercent = (health / maxHealth) * 100;
    
    const healthBar = document.getElementById('health-value');
    healthBar.style.width = `${healthPercent}%`;
    
    // Change color based on health
    if (healthPercent > 60) {
        healthBar.style.backgroundColor = '#2ecc71';
    } else if (healthPercent > 30) {
        healthBar.style.backgroundColor = '#f39c12';
    } else {
        healthBar.style.backgroundColor = '#e74c3c';
    }
}

function setupFirstPersonControls() {
    // Remove orbit controls if they exist
    if (controls) {
        controls.dispose();
    }
    
    // Create first person controls
    controls = new FirstPersonControls(camera, renderer.domElement);
    controls.movementSpeed = room.presence[room.clientId].speed * 5;
    controls.lookSpeed = 0.1;
    
    // Position camera at player position
    const playerPosition = room.presence[room.clientId].position;
    camera.position.set(playerPosition.x, playerPosition.y + 1.7, playerPosition.z);
    
    // Lock pointer for first-person controls
    renderer.domElement.requestPointerLock();
    
    // Add pointer lock event listeners
    document.addEventListener('pointerlockchange', handlePointerLockChange);
}

function handlePointerLockChange() {
    if (document.pointerLockElement === renderer.domElement) {
        controls.enabled = true;
    } else {
        controls.enabled = false;
        
        // If game is active, request pointer lock again
        if (gameActive) {
            renderer.domElement.requestPointerLock();
        }
    }
}

function subscribeToMultiplayerState() {
    room.subscribePresence((presence) => {
        // Update player models based on presence
        updatePlayerModels();
        
        // Check if player died
        const myPresence = presence[room.clientId];
        if (myPresence && !myPresence.alive && gameActive) {
            handlePlayerDeath();
        }
    });
    
    room.subscribeRoomState((roomState) => {
        // Update game elements based on room state
        updateGameElements(roomState);
        
        // Check for score updates
        if (roomState.score) {
            updateScoreUI(roomState.score);
        }
        
        // Check for game over
        if (roomState.gameStatus === 'ended') {
            endGame(roomState.winner);
        }
    });
    
    room.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
        if (updateRequest.type === 'damage') {
            handleDamageRequest(updateRequest.amount);
        }
    });
    
    // Setup message handling for events
    room.onmessage = (event) => {
        const data = event.data;
        
        switch (data.type) {
            case 'connected':
                console.log(`Player connected: ${data.username} (${data.clientId})`);
                break;
                
            case 'disconnected':
                console.log(`Player disconnected: ${data.username} (${data.clientId})`);
                break;
                
            case 'playerAttack':
                // Show attack animation/effect
                showAttackEffect(data);
                break;
                
            case 'playerHit':
                // Show hit animation/effect
                showHitEffect(data);
                break;
                
            case 'flagCaptured':
                // Update flag status UI
                updateFlagStatusUI(data.team === 'red' ? 'blue' : 'red', 'Captured');
                
                // Play capture sound effect
                // Would implement audio playback here
                break;
                
            case 'flagReturned':
                // Update flag status UI
                updateFlagStatusUI(data.team, 'Safe');
                break;
                
            case 'flagScored':
                // Update score
                if (data.team === 'red') {
                    redScore++;
                } else {
                    blueScore++;
                }
                
                updateScoreUI({ red: redScore, blue: blueScore });
                
                // Reset flag status
                updateFlagStatusUI(data.team === 'red' ? 'blue' : 'red', 'Safe');
                break;
        }
    };
}

function showAttackEffect(data) {
    // This would create a visual effect for attacks
    // Simplified version - would need THREE.js particles or animation
    console.log(`Attack effect from ${data.team} team using ${data.weapon}`);
}

function showHitEffect(data) {
    // This would create a visual effect for hits
    console.log(`Hit effect on ${data.target} with ${data.weapon} for ${data.damage} damage`);
}

function updateFlagStatusUI(team, status) {
    const flagStatus = document.getElementById(`${team}-flag-status`);
    flagStatus.textContent = `Flag ${status}`;
    
    // Add visual indication
    flagStatus.style.color = status === 'Safe' ? 'white' : '#ffcc00';
}

function updateScoreUI(score) {
    document.getElementById('red-team-score').textContent = score.red;
    document.getElementById('blue-team-score').textContent = score.blue;
}

function handleDamageRequest(amount) {
    // Get current health
    const currentPresence = room.presence[room.clientId];
    const newHealth = Math.max(0, currentPresence.health - amount);
    
    // Update health in presence
    room.updatePresence({
        health: newHealth,
        alive: newHealth > 0
    });
    
    // Update health UI
    updateHealthUI(newHealth);
    
    // If health is 0, player dies
    if (newHealth <= 0) {
        handlePlayerDeath();
    }
}

function handlePlayerDeath() {
    console.log('Player died');
    
    // Send death event
    room.send({
        type: 'playerDied',
        player: room.clientId,
        team: currentPlayerTeam
    });
    
    // If carrying flag, drop it
    if (room.roomState.flags && 
        room.roomState.flags[currentPlayerTeam === 'red' ? 'blue' : 'red'] && 
        room.roomState.flags[currentPlayerTeam === 'red' ? 'blue' : 'red'].carrier === room.clientId) {
        
        // Update room state to drop flag
        room.updateRoomState({
            flags: {
                [currentPlayerTeam === 'red' ? 'blue' : 'red']: {
                    status: 'dropped',
                    position: room.presence[room.clientId].position,
                    carrier: null
                }
            }
        });
        
        // Send flag dropped event
        room.send({
            type: 'flagDropped',
            team: currentPlayerTeam === 'red' ? 'blue' : 'red',
            position: room.presence[room.clientId].position
        });
    }
    
    // Wait for respawn
    setTimeout(() => {
        respawnPlayer();
    }, 5000);
}

function respawnPlayer() {
    // Respawn at team base
    const spawnPosition = {
        x: currentPlayerTeam === 'red' ? -30 : 30,
        y: 1,
        z: 0
    };
    
    // Reset player state
    const maxHealth = room.presence[room.clientId].maxHealth;
    room.updatePresence({
        health: maxHealth,
        alive: true,
        position: spawnPosition,
        action: 'idle',
        ammo: currentPlayerClass === 'archer' ? 10 : 0
    });
    
    // Update health UI
    updateHealthUI(maxHealth);
    
    // Update ammo UI if archer
    if (currentPlayerClass === 'archer') {
        document.getElementById('ammo-count').textContent = '10';
    }
    
    // Move camera to respawn position
    camera.position.set(spawnPosition.x, spawnPosition.y + 1.7, spawnPosition.z);
}

function updatePlayerModels() {
    // In a real game, this would update 3D models of all players
    Object.entries(room.presence).forEach(([clientId, playerData]) => {
        if (clientId !== room.clientId && playerData.position) {
            // Create or update player models based on their presence data
            createOrUpdatePlayerModel(clientId, playerData);
        }
    });
}

function createOrUpdatePlayerModel(clientId, playerData) {
    // Check if player model exists
    let playerModel = scene.getObjectByName(`player-${clientId}`);
    
    if (!playerModel) {
        // Create new player model
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshStandardMaterial({ 
            color: playerData.team === 'red' ? 0xff5555 : 0x5555ff 
        });
        playerModel = new THREE.Mesh(geometry, material);
        playerModel.name = `player-${clientId}`;
        playerModel.castShadow = true;
        scene.add(playerModel);
        
        // Add player name label
        const username = room.peers[clientId]?.username || 'Player';
        addPlayerNameLabel(playerModel, username, playerData.team);
    }
    
    // Update player position and rotation
    if (playerData.position) {
        playerModel.position.set(
            playerData.position.x,
            playerData.position.y,
            playerData.position.z
        );
    }
    
    if (playerData.rotation) {
        playerModel.rotation.set(
            playerData.rotation.x,
            playerData.rotation.y,
            playerData.rotation.z
        );
    }
}

function addPlayerNameLabel(playerModel, username, team) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    
    // Draw name background
    context.fillStyle = team === 'red' ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 0, 255, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw name text
    context.font = '30px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(username, canvas.width / 2, canvas.height / 2);
    
    // Create sprite texture
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.position.y = 2.5; // Position above player
    sprite.scale.set(2, 0.5, 1);
    
    playerModel.add(sprite);
}

function updateGameElements(roomState) {
    // Update game elements based on room state
    // This includes flag positions, captured objectives, etc.
    console.log('Updated game elements based on room state:', roomState);
    
    // Update timer if present
    if (roomState.timer !== undefined) {
        updateTimerUI(roomState.timer);
    }
}

function updateTimerUI(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    
    document.getElementById('timer').textContent = 
        `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function initializePlayerState() {
    // Initialize room state if not already set
    if (!room.roomState.score) {
        room.updateRoomState({
            score: { red: 0, blue: 0 },
            flags: {
                red: { status: 'safe', carrier: null },
                blue: { status: 'safe', carrier: null }
            },
            gameStatus: 'active',
            timer: gameTime
        });
        
        // Start game timer
        startGameTimer();
    }
}

function startGameTimer() {
    // Check if we're the first client
    const clientIds = Object.keys(room.peers);
    const isFirstClient = clientIds[0] === room.clientId;
    
    // Only first client updates the timer to avoid conflicts
    if (isFirstClient) {
        const timerInterval = setInterval(() => {
            const currentTime = room.roomState.timer;
            
            if (currentTime > 0) {
                room.updateRoomState({
                    timer: currentTime - 1
                });
            } else {
                clearInterval(timerInterval);
                
                // End game
                const winner = determineWinner();
                room.updateRoomState({
                    gameStatus: 'ended',
                    winner: winner
                });
            }
        }, 1000);
    }
}

function determineWinner() {
    const redScore = room.roomState.score.red;
    const blueScore = room.roomState.score.blue;
    
    if (redScore > blueScore) {
        return 'red';
    } else if (blueScore > redScore) {
        return 'blue';
    } else {
        return 'tie';
    }
}

function endGame(winner) {
    gameActive = false;
    
    // Update UI
    document.getElementById('winning-team').textContent = 
        winner === 'tie' ? "It's a Tie!" : `${winner.charAt(0).toUpperCase() + winner.slice(1)} Team Wins!`;
        
    document.getElementById('final-red-score').textContent = room.roomState.score.red;
    document.getElementById('final-blue-score').textContent = room.roomState.score.blue;
    
    // Show game over modal
    gameOverModal.classList.remove('hidden');
    
    // Release pointer lock
    document.exitPointerLock();
}

function restartGame() {
    // Hide game over modal
    gameOverModal.classList.add('hidden');
    
    // Reset game state
    room.updateRoomState({
        score: { red: 0, blue: 0 },
        flags: {
            red: { status: 'safe', carrier: null },
            blue: { status: 'safe', carrier: null }
        },
        gameStatus: 'active',
        timer: gameTime
    });
    
    // Show team select again
    teamSelectModal.classList.remove('hidden');
    
    // Reset scores
    redScore = 0;
    blueScore = 0;
    updateScoreUI({ red: 0, blue: 0 });
    
    // Reset flag status
    updateFlagStatusUI('red', 'Safe');
    updateFlagStatusUI('blue', 'Safe');
    
    // Reset player
    currentPlayerTeam = null;
    currentPlayerClass = null;
    
    // Start game timer
    startGameTimer();
}

function startRenderLoop() {
    function animate() {
        requestAnimationFrame(animate);
        
        // Update controls
        if (controls) {
            controls.update(1); // Update with delta time (1 second)
            
            // Sync camera position to player position in presence
            if (gameActive) {
                room.updatePresence({
                    position: {
                        x: camera.position.x,
                        y: camera.position.y - 1.7, // Adjust for eye height
                        z: camera.position.z
                    },
                    rotation: {
                        x: camera.rotation.x,
                        y: camera.rotation.y,
                        z: camera.rotation.z
                    }
                });
            }
        }
        
        renderer.render(scene, camera);
    }
    
    animate();
}

// Start the game
init();
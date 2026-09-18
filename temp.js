// --- DEVICE DETECTION & UI ---
const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
if (isMobile) {
    document.getElementById('mobileControls').style.display = 'block';
    document.getElementById('fireBtn').classList.add('mobile-btn');
    document.getElementById('jumpBtn').classList.add('mobile-btn');
    document.getElementById('slideBtn').classList.add('mobile-btn');
}

// --- GAME SYSTEM STATE ---
let health = 100, score = 0, kills = 0;
let ammo = 30, reserveAmmo = 90;
let isDead = false, isPaused = false, gameActive = false;

let lastDamageTime = Date.now(), lastRegenTime = 0;
const REGEN_DELAY = 5000, REGEN_INTERVAL = 1000, REGEN_AMOUNT = 5;      

// Movement & Camera
let yaw = 0, pitch = 0;
let moveSpeed = 0.12, baseLookSpeed = 0.003;
const sprintMultiplier = 1.7, crouchMultiplier = 0.55;
let graphicsQuality = 'medium';
let isAiming = false;
const normalFov = 75, sniperAimFov = 42;
let moveVector = { x: 0, y: 0 };
let yVelocity = 0, isGrounded = true;
const jumpForce = 0.22, gravity = 0.015;
let walkCycle = 0;
const lastSafePosition = new THREE.Vector3(0, 2, 0);
let blockedMovementFrames = 0;
let fpsFrameCount = 0, fpsLastUpdate = performance.now();

const keys = { w: false, a: false, s: false, d: false, space: false, shift: false, crouch: false };
let isSliding = false, slideTimer = 0;
const SLIDE_DURATION = 35; 

// Weapon Stats
let selectedWeaponType = 'rifle'; 
let fireRate = 150, weaponDamage = 1, maxAmmo = 30;
let isFiring = false, lastFireTime = 0, isReloading = false, reloadStartTime = 0;
const reloadDuration = 1000; 

// --- WEAPON SELECTION UI ---
const btnRifle = document.getElementById('selRifle');
const btnSMG = document.getElementById('selSMG');
const btnM16 = document.getElementById('selM16');
const btnBarrett = document.getElementById('selBarrett');
const btnPistol = document.getElementById('selPistol');
const btnRifleDeath = document.getElementById('selRifleDeath');
const btnSMGDeath = document.getElementById('selSMGDeath');
const btnM16Death = document.getElementById('selM16Death');
const btnBarrettDeath = document.getElementById('selBarrettDeath');
const btnPistolDeath = document.getElementById('selPistolDeath');

if(btnRifle) btnRifle.addEventListener('click', () => selectWeapon('rifle'));
if(btnSMG) btnSMG.addEventListener('click', () => selectWeapon('smg'));
if(btnM16) btnM16.addEventListener('click', () => selectWeapon('m16'));
if(btnBarrett) btnBarrett.addEventListener('click', () => selectWeapon('barrett'));
if(btnPistol) btnPistol.addEventListener('click', () => selectWeapon('pistol'));
if(btnRifleDeath) btnRifleDeath.addEventListener('click', () => selectWeapon('rifle'));
if(btnSMGDeath) btnSMGDeath.addEventListener('click', () => selectWeapon('smg'));
if(btnM16Death) btnM16Death.addEventListener('click', () => selectWeapon('m16'));
if(btnBarrettDeath) btnBarrettDeath.addEventListener('click', () => selectWeapon('barrett'));
if(btnPistolDeath) btnPistolDeath.addEventListener('click', () => selectWeapon('pistol'));

function selectWeapon(type) {
    selectedWeaponType = type;
    isAiming = false;
    if(type === 'rifle') {
        fireRate = 150; weaponDamage = 1; maxAmmo = 30;
    } else if(type === 'smg') {
        fireRate = 75; weaponDamage = 1; maxAmmo = 45;
    } else if(type === 'm16') {
        fireRate = 110; weaponDamage = 1; maxAmmo = 30;
    } else if(type === 'barrett') {
        fireRate = 700; weaponDamage = 3; maxAmmo = 5;
    } else {
        fireRate = 250; weaponDamage = 1; maxAmmo = 12;
    }
    const names = { rifle: 'GUN009 ASSAULT', smg: 'GUN010 MACHINE GUN', m16: 'GUN007 RIFLE', barrett: 'GUN008 SNIPER', pistol: 'GUN007 SIDEARM' };
    document.getElementById('currentWepName').innerText = names[type];
    ammo = Math.min(ammo, maxAmmo);
    updateHUD();
    [btnRifle, btnSMG, btnM16, btnBarrett, btnPistol, btnRifleDeath, btnSMGDeath, btnM16Death, btnBarrettDeath, btnPistolDeath].forEach(button => button?.classList.remove('selected'));
    [btnRifle, btnSMG, btnM16, btnBarrett, btnPistol].find(button => button?.id === `sel${type === 'rifle' ? 'Rifle' : type === 'smg' ? 'SMG' : type === 'm16' ? 'M16' : type === 'barrett' ? 'Barrett' : 'Pistol'}`)?.classList.add('selected');
    [btnRifleDeath, btnSMGDeath, btnM16Death, btnBarrettDeath, btnPistolDeath].find(button => button?.id === `sel${type === 'rifle' ? 'Rifle' : type === 'smg' ? 'SMG' : type === 'm16' ? 'M16' : type === 'barrett' ? 'Barrett' : 'Pistol'}Death`)?.classList.add('selected');
    updateWeaponVisibility();
}

function applyGraphicsQuality(level) {
    const pixelRatios = { low: 0.75, medium: 1, ultra: isMobile ? 1.25 : Math.min(window.devicePixelRatio, 2) };
    graphicsQuality = level;
    renderer.setPixelRatio(pixelRatios[level]);
    document.querySelectorAll('.settings-option[data-quality]').forEach(button => button.classList.toggle('selected', button.dataset.quality === level));
}

const qualityLow = document.getElementById('qualityLow');
const qualityMedium = document.getElementById('qualityMedium');
const qualityUltra = document.getElementById('qualityUltra');
qualityLow.addEventListener('click', () => applyGraphicsQuality('low'));
qualityMedium.addEventListener('click', () => applyGraphicsQuality('medium'));
qualityUltra.addEventListener('click', () => applyGraphicsQuality('ultra'));

const sensitivitySlider = document.getElementById('sensitivitySlider');
const sensitivityValue = document.getElementById('sensitivityValue');
sensitivitySlider.addEventListener('input', () => {
    baseLookSpeed = Number(sensitivitySlider.value);
    sensitivityValue.value = baseLookSpeed.toFixed(4);
    sensitivityValue.innerText = baseLookSpeed.toFixed(4);
});

document.getElementById('pauseRifle').addEventListener('click', () => selectWeapon('rifle'));
document.getElementById('pauseSMG').addEventListener('click', () => selectWeapon('smg'));
document.getElementById('pauseM16').addEventListener('click', () => selectWeapon('m16'));
document.getElementById('pauseBarrett').addEventListener('click', () => selectWeapon('barrett'));
document.getElementById('pausePistol').addEventListener('click', () => selectWeapon('pistol'));

function updateHUD() {
    document.getElementById('healthVal').innerText = Math.max(0, Math.floor(health));
    document.getElementById('scoreVal').innerText = score;
    document.getElementById('killsVal').innerText = kills;
    document.getElementById('ammoVal').innerText = ammo;
    document.getElementById('reserveVal').innerText = reserveAmmo;

    const vignette = document.getElementById('vignette');
    const healthBox = document.getElementById('healthDisplay');
    if (health <= 30 && health > 0) {
        vignette.style.display = 'block';
        healthBox.style.backgroundColor = "rgba(150, 0, 0, 0.7)";
        playHeartbeat();
    } else {
        vignette.style.display = 'none';
        healthBox.style.backgroundColor = "rgba(10, 15, 20, 0.75)";
    }
}

function triggerHealingEffect() {
    const healingFlash = document.getElementById('healingFlash');
    healingFlash.classList.remove('active');
    void healingFlash.offsetWidth;
    healingFlash.classList.add('active');
}

function showHitMarker() {
    const hitMarker = document.getElementById('hitMarker');
    hitMarker.classList.remove('active');
    void hitMarker.offsetWidth;
    hitMarker.classList.add('active');
}

// --- AUDIO ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let gunAudioBuffer = null, lastHeartbeatTime = 0;

fetch('./audio/firing.mp3')
    .then(response => {
        if (!response.ok) throw new Error("Audio file missing");
        return response.arrayBuffer();
    })
    .then(data => audioCtx.decodeAudioData(data))
    .then(buffer => { gunAudioBuffer = buffer; })
    .catch(e => {});

function playProcedural(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    if (type === 'hit') {
        osc.type = 'square'; osc.frequency.setValueAtTime(700, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
        osc.start(); osc.stop(audioCtx.currentTime + 0.04);
    } else if (type === 'heart') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(50, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(); osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'reload') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    }
}

function playGunshot() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (gunAudioBuffer) {
        const source = audioCtx.createBufferSource(), gain = audioCtx.createGain();
        source.buffer = gunAudioBuffer; gain.gain.value = 0.65;
        source.connect(gain); gain.connect(audioCtx.destination);
        source.start(0);
    } else {
        playProcedural('hit'); 
    }
}
function playHitMarker() { playProcedural('hit'); }
function playHeartbeat() { if (Date.now() - lastHeartbeatTime > 1000) { lastHeartbeatTime = Date.now(); playProcedural('heart'); } }
function playReloadSound() { playProcedural('reload'); }

// --- THREE.JS ENGINE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 2.0; camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.25)); 
document.body.appendChild(renderer.domElement);

const skyGeo = new THREE.SphereGeometry(600, 32, 32);
const textureLoader = new THREE.TextureLoader();
textureLoader.load('./images/backgroundsky.jpg', (texture) => {
    scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide })));
}, undefined, () => { scene.background = new THREE.Color(0x2a3036); });

const collidables = [], coverMeshes = [], obstacleMeshes = [];

// --- FULLY AUTOMATIC CASTLE MAP COLLISION LOADER ---
scene.add(new THREE.AmbientLight(0xffffff, 0.8)); 
const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(50, 100, 50);
scene.add(dirLight);

const wallMeshes = [], collisionMeshes = [], groundMeshes = []; 

const mapLoader = new THREE.GLTFLoader();
mapLoader.load('castle.glb', function(gltf) {
    const castle = gltf.scene;
    castle.scale.set(1.5, 1.5, 1.5); 
    castle.position.set(0, -2, 0); 
    
    // Convert materials to MeshBasicMaterial so they display true flat colors without overexposing
    castle.traverse((node) => {
        if (node.isMesh && node.material) {
            const oldMat = node.material;
            node.material = new THREE.MeshBasicMaterial({
                map: oldMat.map || null,
                color: oldMat.color || 0xffffff,
                side: THREE.DoubleSide
            });
            node.updateMatrixWorld();
            wallMeshes.push(node);

            const box = new THREE.Box3().setFromObject(node);
            const size = new THREE.Vector3();
            box.getSize(size);
            if (!(size.x > 40 && size.z > 40)) collisionMeshes.push(node);
            if (size.x > 40 && size.z > 40) groundMeshes.push(node);
        }
    });

    scene.add(castle);
    castle.updateMatrixWorld(true);
}, undefined, function(error) {
    console.error("Error loading castle map:", error);
});

// --- INVISIBLE LEVEL BOUNDARIES ---
const wallMat = new THREE.MeshBasicMaterial({ visible: false });

const bounds = 70;
const wallThickness = 4;

const nWall = new THREE.Mesh(new THREE.BoxGeometry(bounds, 20, wallThickness), wallMat); nWall.position.set(0, 5, -bounds/2);
const sWall = new THREE.Mesh(new THREE.BoxGeometry(bounds, 20, wallThickness), wallMat); sWall.position.set(0, 5, bounds/2);
const wWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, 20, bounds), wallMat); wWall.position.set(-bounds/2, 5, 0);
const eWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, 20, bounds), wallMat); eWall.position.set(bounds/2, 5, 0);

[nWall, sWall, wWall, eWall].forEach(w => { 
    scene.add(w); w.updateMatrixWorld(); collidables.push(new THREE.Box3().setFromObject(w)); 
});

// --- GLTF WEAPON LOADER ---
const gunGroup = new THREE.Group();
gunGroup.position.set(0.12, -0.15, -0.2); 
camera.add(gunGroup); scene.add(camera);

const muzzleLight = new THREE.PointLight(0xffaa00, 0, 6);
muzzleLight.position.set(0.34, -0.18, -0.9); gunGroup.add(muzzleLight);

let ak47Model = new THREE.Group();
let mp5Model = new THREE.Group();
let m16Model = new THREE.Group();
let barrettModel = new THREE.Group();
let pistolModel = new THREE.Group();
gunGroup.add(ak47Model, mp5Model, m16Model, barrettModel, pistolModel);
ak47Model.visible = true; mp5Model.visible = false; m16Model.visible = false; barrettModel.visible = false; pistolModel.visible = false;

function updateWeaponVisibility() {
    ak47Model.visible = (selectedWeaponType === 'rifle');
    mp5Model.visible = (selectedWeaponType === 'smg');
    m16Model.visible = (selectedWeaponType === 'm16');
    barrettModel.visible = (selectedWeaponType === 'barrett');
    pistolModel.visible = (selectedWeaponType === 'pistol');
}

const weaponLoader = new THREE.GLTFLoader();
weaponLoader.load('./lp_mini_pack_modern_weaponswith_bullets_part_2.glb', function(gltf) {
    const model = gltf.scene;
    const ak47 = model.getObjectByName('Gun009');
    const mp5 = model.getObjectByName('Gun010');
    const m16 = model.getObjectByName('Gun007');
    const barrett = model.getObjectByName('Gun008');
    const pistolSource = model.getObjectByName('Gun007');
    const pistol = pistolSource ? pistolSource.clone(true) : null;

    const weaponEntries = [[ak47, ak47Model], [mp5, mp5Model], [m16, m16Model], [barrett, barrettModel], [pistol, pistolModel]];
    weaponEntries.forEach(([weapon, target]) => {
        if (!weapon) return;
        const box = new THREE.Box3().setFromObject(weapon), center = new THREE.Vector3();
        const size = new THREE.Vector3(); box.getSize(size);
        box.getCenter(center); weapon.position.sub(center);
        const targetSize = target === barrettModel ? 0.68 : target === pistolModel ? 0.55 : 0.8;
        const modelScale = targetSize / Math.max(size.x, size.y, size.z);
        const targetZ = target === barrettModel ? -0.25 : -0.22;
        const targetY = target === barrettModel ? -0.01 : -0.06;
        target.position.set(0.12, targetY, targetZ); target.scale.setScalar(modelScale);
        target.rotation.set(0, Math.PI, 0);
        target.add(weapon);
        weapon.traverse(part => { if (part.isMesh) part.castShadow = false; });
    });
    updateWeaponVisibility();
}, undefined, function(error) { console.error("Error loading weapon:", error); });

// --- PARTICLES & COMBAT ---
const particles = [], bulletTracers = [], enemyProjectiles = [];
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 }), bloodMat = new THREE.MeshBasicMaterial({ color: 0x8b0000 }); 
const gooMat = new THREE.MeshStandardMaterial({ color: 0x65ff38, emissive: 0x1b6b0b, emissiveIntensity: 1.4, roughness: 0.35 });

function spawnBulletTracer(start, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color: 0xffffb0, transparent: true, opacity: 1 });
    const tracer = new THREE.Line(geometry, material);
    scene.add(tracer);
    bulletTracers.push({ mesh: tracer, life: 1 });
}

function spawnSparks(x, y, z, isBlood = false) {
    const particleCount = isMobile ? 4 : 6;
    for(let i=0; i<particleCount; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), isBlood ? bloodMat : sparkMat);
        p.position.set(x, y, z); scene.add(p);
        particles.push({ mesh: p, life: 1.0, velocity: new THREE.Vector3((Math.random()-0.5)*0.3, Math.random()*0.3, (Math.random()-0.5)*0.3) });
    }
}

function triggerGooHit() {
    const gooHit = document.getElementById('gooHit');
    gooHit.classList.remove('active');
    void gooHit.offsetWidth;
    gooHit.classList.add('active');
}

function shootEnemyProjectile(enemyObj) {
    const start = enemyObj.group.position.clone().setY(enemyObj.group.position.y + 1.45);
    const projectile = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), gooMat);
    projectile.position.copy(start);
    const velocity = new THREE.Vector3().subVectors(camera.position, start).normalize().multiplyScalar(0.28);
    scene.add(projectile);
    enemyProjectiles.push({ mesh: projectile, velocity, life: 140 });
}

// --- ENEMIES ---
function createEnemyHealthBar() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 18;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false }));
    sprite.position.y = 2.8; sprite.scale.set(1.25, 0.18, 1);
    const update = healthValue => {
        context.clearRect(0, 0, 128, 18);
        context.fillStyle = 'rgba(5, 10, 8, 0.9)'; context.fillRect(0, 0, 128, 18);
        context.fillStyle = healthValue > 1 ? '#34e27a' : '#ff4757'; context.fillRect(3, 3, 122 * Math.max(0, healthValue) / 3, 12);
        context.strokeStyle = '#ffffff'; context.lineWidth = 2; context.strokeRect(1, 1, 126, 16);
        texture.needsUpdate = true;
    };
    update(3);
    return { sprite, update };
}

const hitFlashMat = new THREE.MeshStandardMaterial({ color: 0xff0000 }); 
const enemies = [];
const characterTemplates = [];

// Load the newly exported characters.glb file
new THREE.GLTFLoader().load('characters.glb', gltf => {
    // Extract each valid character model from the file bundle
    gltf.scene.children.forEach(child => {
        if (child.name !== 'Camera' && child.name !== 'Light') {
            child.traverse(node => {
                if (node.isMesh || node.isSkinnedMesh) {
                    // Clone materials so they can flash red individually when hit
                    node.material = node.material.clone();
                    node.userData.originalMaterial = node.material;
                }
            });
            characterTemplates.push(child);
        }
    });

    // If game is running, spawn enemies immediately
    if (typeof gameActive !== 'undefined' && gameActive && enemies.length === 0) {
        const enemyCount = isMobile ? 4 : 6;
        for (let index = 0; index < enemyCount; index++) spawnEnemy();
    }
}, undefined, error => console.error('Error loading characters.glb:', error));

function spawnEnemy() {
    if (characterTemplates.length === 0) return; 

    const group = new THREE.Group();
    const template = characterTemplates[Math.floor(Math.random() * characterTemplates.length)];
    const modelRoot = (typeof THREE.SkeletonUtils !== 'undefined') ? THREE.SkeletonUtils.clone(template) : template.clone();
    
    const modelContainer = new THREE.Group();
    modelContainer.add(modelRoot);
    group.add(modelContainer);
    
    const meshes = [];
    modelRoot.traverse(node => {
        if (node.isMesh || node.isSkinnedMesh) {
            node.userData.originalMaterial = node.material;
            meshes.push(node);
        }
    });

    const healthBar = createEnemyHealthBar();
    group.add(healthBar.sprite);
    
    group.position.set((Math.random() - 0.5) * 60, -1, (Math.random() - 0.5) * 60);
    while (group.position.distanceTo(camera.position) < 9) {
        group.position.set((Math.random() - 0.5) * 60, -1, (Math.random() - 0.5) * 60);
    }
    scene.add(group);

    modelContainer.scale.setScalar(1.0); 
    modelContainer.position.y = 0; 
    
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.2, 1.35), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.userData.isHitbox = true;
    hitbox.position.y = 1.1; 
    group.add(hitbox);
    meshes.push(hitbox);
    
    enemies.push({
        group, modelRoot, modelContainer, meshes, hitbox, healthBar, 
        animated: true, 
        hp: 3, hitTime: 0, state: 'idle', walkTime: Math.random() * 10,
        lastShotTime: 0, preferredRange: 10 + Math.random() * 8,
        strafeDirection: Math.random() > 0.5 ? 1 : -1, nextDecisionTime: 0,
        speed: 0.035 + Math.random() * 0.02, orbitPhase: Math.random() * Math.PI * 2,
        wanderTarget: new THREE.Vector3(), nextWanderTime: 0
    });
}

// --- PLAYER WEAPON LOGIC ---
const raycaster = new THREE.Raycaster();
const collisionRaycaster = new THREE.Raycaster();
const enemyGroundRaycaster = new THREE.Raycaster();
const projectileRaycaster = new THREE.Raycaster();
let collisionFrame = 0;
const lastCollisionResults = { x: false, z: false };

function mapBlocksMovement(nextX, nextZ, axis) {
    if (collisionMeshes.length === 0) return false;
    if (collisionFrame % (isMobile ? 3 : 2) === 0) return lastCollisionResults[axis];

    const direction = new THREE.Vector3(nextX - camera.position.x, 0, nextZ - camera.position.z);
    const distance = direction.length();
    if (distance === 0) return false;
    direction.normalize();

    const origin = new THREE.Vector3(camera.position.x, 1.2, camera.position.z);
    collisionRaycaster.set(origin, direction);
    collisionRaycaster.far = distance + 0.35;
    lastCollisionResults[axis] = collisionRaycaster.intersectObjects(collisionMeshes, true).length > 0;
    return lastCollisionResults[axis];
}

function triggerReload() {
    if (isReloading || ammo >= maxAmmo || reserveAmmo <= 0) return;
    isReloading = true; reloadStartTime = Date.now();
    document.getElementById('reloadUI').style.display = 'block'; document.getElementById('crosshair').style.opacity = '0.2';
    playReloadSound();
}

function shootWeapon() {
    if (isReloading || ammo <= 0) { if(ammo <= 0) triggerReload(); return; }
    const now = Date.now(); if (now - lastFireTime < fireRate) return;
    lastFireTime = now; ammo--; updateHUD(); playGunshot();
    muzzleLight.intensity = 4.0; setTimeout(() => { muzzleLight.intensity = 0; }, 40);

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const shotDirection = raycaster.ray.direction.clone();

    gunGroup.position.z = -0.15; gunGroup.rotation.x = 0.15; 
    pitch += 0.006; yaw += (Math.random() - 0.5) * 0.002;
    pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, pitch)); camera.rotation.set(pitch, yaw, 0);

    const enemyHitboxes = enemies.map(e => e.meshes).flat();
    const intersects = raycaster.intersectObjects([...enemyHitboxes, ...coverMeshes, ...obstacleMeshes]);
    const muzzlePosition = muzzleLight.getWorldPosition(new THREE.Vector3());
    const tracerEnd = camera.position.clone().add(shotDirection.multiplyScalar(80));
    
    if (intersects.length > 0) tracerEnd.copy(intersects[0].point);
    spawnBulletTracer(muzzlePosition, tracerEnd);

    let hitEnemy = false;
    let hitPoint = intersects.length > 0 ? intersects[0].point : tracerEnd;

    if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            const belongsToEnemy = enemy.meshes.includes(hitObj) || (enemy.modelRoot && enemy.modelRoot.getObjectById(hitObj.id));
            if (belongsToEnemy) {
                hitEnemy = true;
                applyDamageToEnemy(enemy, i);
                break;
            }
        }
    }

    if (!hitEnemy) {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            const enemyCenter = enemy.group.position.clone().setY(enemy.group.position.y + 1.2);
            const closestPointOnRay = raycaster.ray.closestPointToPoint(enemyCenter, new THREE.Vector3());
            const horizontalDist = Math.hypot(closestPointOnRay.x - enemyCenter.x, closestPointOnRay.z - enemyCenter.z);
            const verticalDist = Math.abs(closestPointOnRay.y - enemyCenter.y);
            
            if (horizontalDist < 1.5 && verticalDist < 1.4 && camera.position.distanceTo(enemy.group.position) < 80) {
                hitEnemy = true;
                hitPoint.copy(closestPointOnRay);
                applyDamageToEnemy(enemy, i);
                break;
            }
        }
    }

    if (hitEnemy) playHitMarker();
    spawnSparks(hitPoint.x, hitPoint.y, hitPoint.z, hitEnemy);
}

function applyDamageToEnemy(enemy, index) {
    enemy.hp -= weaponDamage; 
    enemy.hitTime = Date.now(); 
    showHitMarker();
    enemy.healthBar.update(enemy.hp);
    
    const knockback = new THREE.Vector3(enemy.group.position.x - camera.position.x, 0, enemy.group.position.z - camera.position.z).normalize();
    enemy.group.position.add(knockback.multiplyScalar(0.5));
    
    if (enemy.hp <= 0) {
        scene.remove(enemy.group); 
        enemies.splice(index, 1);
        score += 150; 
        kills++; 
        reserveAmmo = Math.min(180, reserveAmmo + 15); 
        updateHUD(); 
        spawnEnemy(); 
    }
}

// --- INPUT HANDLING ---
function togglePause() {
    if (isDead || !gameActive) return;
    isPaused = !isPaused; document.getElementById('pauseScreen').style.display = isPaused ? 'flex' : 'none';
    if (!isPaused && !isMobile) document.body.requestPointerLock();
    else if (isPaused && document.pointerLockElement) document.exitPointerLock();
}

document.getElementById('resumeBtn').addEventListener('click', togglePause);
window.addEventListener('keydown', e => { if(e.code==='KeyW')keys.w=true; if(e.code==='KeyA')keys.a=true; if(e.code==='KeyS')keys.s=true; if(e.code==='KeyD')keys.d=true; if(e.code==='Space')keys.space=true; if(e.code==='ShiftLeft' || e.code==='ShiftRight')keys.shift=true; if(e.code==='KeyC')keys.crouch=true; if(e.code==='KeyR') triggerReload(); if(e.code==='Escape') togglePause(); });
window.addEventListener('keyup', e => { if(e.code==='KeyW')keys.w=false; if(e.code==='KeyA')keys.a=false; if(e.code==='KeyS')keys.s=false; if(e.code==='KeyD')keys.d=false; if(e.code==='Space')keys.space=false; if(e.code==='ShiftLeft' || e.code==='ShiftRight')keys.shift=false; if(e.code==='KeyC')keys.crouch=false; });
window.addEventListener('mousedown', (e) => {
    if (e.button === 2 && gameActive && !isDead && !isPaused && selectedWeaponType === 'barrett') isAiming = true;
    if (e.button === 0 && gameActive && !isDead) { if (!isPaused && document.pointerLockElement !== document.body && !isMobile) { document.body.requestPointerLock(); } else if (!isPaused) { isFiring = true; shootWeapon(); } }
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) isFiring = false; if (e.button === 2) isAiming = false; }); 
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== document.body && gameActive && !isDead && !isPaused && !isMobile) togglePause(); });
document.addEventListener('mousemove', (e) => { if(document.pointerLockElement === document.body && !isDead && !isPaused) { yaw -= e.movementX * baseLookSpeed; pitch -= e.movementY * baseLookSpeed; pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, pitch)); camera.rotation.set(pitch, yaw, 0); } });

// Mobile Inputs
document.getElementById('ammoDisplay').addEventListener('touchstart', (e) => { e.preventDefault(); triggerReload(); });
let joystickTouchId = null; const joyZone = document.getElementById('joystickZone'), joyKnob = document.getElementById('joystickKnob'); let joyCenter = {x:0,y:0}, joyMaxRadius=40;
joyZone.addEventListener('touchstart', e => { e.preventDefault(); for(let i=0;i<e.changedTouches.length;i++){ if(joystickTouchId===null){ joystickTouchId = e.changedTouches[i].identifier; let rect = joyZone.getBoundingClientRect(); joyCenter = {x: rect.left+rect.width/2, y: rect.top+rect.height/2}; updateJoystick(e.changedTouches[i]); break; } } });
joyZone.addEventListener('touchmove', e => { e.preventDefault(); for(let i=0;i<e.changedTouches.length;i++){ if(e.changedTouches[i].identifier===joystickTouchId) updateJoystick(e.changedTouches[i]); } });
joyZone.addEventListener('touchend', e => { e.preventDefault(); for(let i=0;i<e.changedTouches.length;i++){ if(e.changedTouches[i].identifier===joystickTouchId){ joystickTouchId=null; joyKnob.style.transform=`translate(0px,0px)`; moveVector={x:0,y:0}; } } });
function updateJoystick(t) { let dx=t.clientX-joyCenter.x, dy=t.clientY-joyCenter.y, dist=Math.sqrt(dx*dx+dy*dy); if(dist>joyMaxRadius){dx=(dx/dist)*joyMaxRadius; dy=(dy/dist)*joyMaxRadius;} joyKnob.style.transform=`translate(${dx}px, ${dy}px)`; moveVector.x=dx/joyMaxRadius; moveVector.y=-(dy/joyMaxRadius); }
let lookTouchId = null, lastTouchX=0, lastTouchY=0; const lookZone = document.getElementById('lookZone');
lookZone.addEventListener('touchstart', e => { e.preventDefault(); for(let i=0;i<e.changedTouches.length;i++){ if(lookTouchId===null){ lookTouchId=e.changedTouches[i].identifier; lastTouchX=e.changedTouches[i].clientX; lastTouchY=e.changedTouches[i].clientY; break; } } });
lookZone.addEventListener('touchmove', e => { e.preventDefault(); for(let i=0;i<e.changedTouches.length;i++){ if(lookTouchId===e.changedTouches[i].identifier){ yaw-=(e.changedTouches[i].clientX-lastTouchX)*baseLookSpeed; pitch-=(e.changedTouches[i].clientY-lastTouchY)*baseLookSpeed; pitch=Math.max(-Math.PI/2+0.1, Math.min(Math.PI/2-0.1, pitch)); camera.rotation.set(pitch,yaw,0); lastTouchX=e.changedTouches[i].clientX; lastTouchY=e.changedTouches[i].clientY; } } });
lookZone.addEventListener('touchend', e => { e.preventDefault(); for(let i=0;i<e.changedTouches.length;i++){ if(lookTouchId===e.changedTouches[i].identifier) lookTouchId=null; } });
document.getElementById('jumpBtn').addEventListener('touchstart', (e)=>{e.preventDefault(); keys.space=true;}); document.getElementById('jumpBtn').addEventListener('touchend', (e)=>{e.preventDefault(); keys.space=false;});
document.getElementById('slideBtn').addEventListener('touchstart', (e)=>{e.preventDefault(); keys.shift=true;}); document.getElementById('slideBtn').addEventListener('touchend', (e)=>{e.preventDefault(); keys.shift=false;});
document.getElementById('fireBtn').addEventListener('touchstart', (e)=>{ e.preventDefault(); e.stopPropagation(); isFiring = true; shootWeapon(); }); document.getElementById('fireBtn').addEventListener('touchend', (e)=>{e.preventDefault(); isFiring = false;});

// --- HUD CUSTOMIZATION LOGIC ---
let isCustomizing = false;
const saveHudBtn = document.getElementById('saveHudBtn');
const customizeUiBtn = document.getElementById('customizeUiBtn');
const uiLayer = document.getElementById('uiLayer');

// List of element IDs the player is allowed to move
const draggableElements = [
    'healthDisplay', 'scoreDisplay', 'killsDisplay', 'ammoDisplay', 'fpsDisplay',
    'weaponDisplay', 'fireBtn', 'jumpBtn', 'slideBtn', 'joystickZone',
    'mobilePauseBtn', 'mobileFullscreenBtn'
];

// Load saved positions on startup
function loadHudPositions() {
    draggableElements.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const savedPos = localStorage.getItem('hud_' + id);
        if (savedPos) {
            const { left, top } = JSON.parse(savedPos);
            // Remove existing bottom/right CSS conflicts and apply saved absolute pixel positions
            el.style.bottom = 'auto';
            el.style.right = 'auto';
            el.style.transform = 'none'; 
            el.style.left = left;
            el.style.top = top;
        }
    });
}
loadHudPositions();

if (customizeUiBtn) {
    customizeUiBtn.addEventListener('click', () => {
        isCustomizing = true;
        document.getElementById('pauseScreen').style.display = 'none';
        saveHudBtn.style.display = 'block';
        uiLayer.classList.add('customizing');
        setupDraggables();
    });
}

if (saveHudBtn) {
    saveHudBtn.addEventListener('click', () => {
        isCustomizing = false;
        saveHudBtn.style.display = 'none';
        uiLayer.classList.remove('customizing');
        document.getElementById('pauseScreen').style.display = 'flex'; 

        // Save new positions to the browser
        draggableElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                localStorage.setItem('hud_' + id, JSON.stringify({
                    left: el.style.left,
                    top: el.style.top
                }));
            }
        });
    });
}

function setupDraggables() {
    draggableElements.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.dragAttached) return; // Prevent attaching multiple listeners
        
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        const dragStart = (e) => {
            if (!isCustomizing) return;
            e.preventDefault();
            isDragging = true;
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            
            const rect = el.getBoundingClientRect();
            // Convert everything to top/left pixels so dragging math works flawlessly
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            el.style.transform = 'none';
            el.style.left = rect.left + 'px';
            el.style.top = rect.top + 'px';
            
            initialLeft = rect.left;
            initialTop = rect.top;
        };

        const dragMove = (e) => {
            if (!isDragging || !isCustomizing) return;
            e.preventDefault();
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const dx = clientX - startX;
            const dy = clientY - startY;
            
            el.style.left = (initialLeft + dx) + 'px';
            el.style.top = (initialTop + dy) + 'px';
        };

        const dragEnd = () => { isDragging = false; };

        // Attach mouse events
        el.addEventListener('mousedown', dragStart);
        window.addEventListener('mousemove', dragMove);
        window.addEventListener('mouseup', dragEnd);
        
        // Attach touch events
        el.addEventListener('touchstart', dragStart, { passive: false });
        window.addEventListener('touchmove', dragMove, { passive: false });
        window.addEventListener('touchend', dragEnd);
        
        el.dataset.dragAttached = 'true';
    });
}
// --- CORE GAME LOOP ---
function animate() {
    requestAnimationFrame(animate); 
    const targetFov = isAiming && selectedWeaponType === 'barrett' ? sniperAimFov : normalFov;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
        camera.fov += (targetFov - camera.fov) * 0.18;
        camera.updateProjectionMatrix();
    }
    fpsFrameCount++;
    const fpsNow = performance.now();
    if (fpsNow - fpsLastUpdate >= 1000) {
        document.getElementById('fpsVal').innerText = Math.round(fpsFrameCount * 1000 / (fpsNow - fpsLastUpdate));
        fpsFrameCount = 0;
        fpsLastUpdate = fpsNow;
    }
    if (gameActive && !isDead && !isPaused) {
        
        const isCrouching = keys.crouch && isGrounded;
        let currentSpeed = moveSpeed * (keys.shift ? sprintMultiplier : 1);
        if (isCrouching) currentSpeed *= crouchMultiplier;

        let fwd = (keys.w ? 1 : 0) - (keys.s ? 1 : 0) + moveVector.y, rgt = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + moveVector.x;
        fwd = Math.max(-1, Math.min(1, fwd)); rgt = Math.max(-1, Math.min(1, rgt));

        if (fwd !== 0 || rgt !== 0) {
            collisionFrame++;
            let nextX = camera.position.x - Math.sin(yaw)*fwd*currentSpeed + Math.cos(yaw)*rgt*currentSpeed;
            let nextZ = camera.position.z - Math.cos(yaw)*fwd*currentSpeed - Math.sin(yaw)*rgt*currentSpeed;
            let canMoveX = true, canMoveZ = true;
            const playerRadius = 0.8;
            const playerY = camera.position.y;

           for(let box of collidables) {
                if (playerY >= box.min.y && playerY <= box.max.y + 2.0) {
                    if(nextX + playerRadius > box.min.x && nextX - playerRadius < box.max.x && camera.position.z + playerRadius > box.min.z && camera.position.z - playerRadius < box.max.z) canMoveX = false;
                    if(camera.position.x + playerRadius > box.min.x && camera.position.x - playerRadius < box.max.x && nextZ + playerRadius > box.min.z && nextZ - playerRadius < box.max.z) canMoveZ = false;
                }
            }
            const mapBlockedX = !canMoveX || mapBlocksMovement(nextX, camera.position.z, 'x');
            if (!mapBlockedX) camera.position.x = nextX;
            const mapBlockedZ = !canMoveZ || mapBlocksMovement(camera.position.x, nextZ, 'z');
            if (!mapBlockedZ) camera.position.z = nextZ;
            const movedOnAtLeastOneAxis = camera.position.x !== lastSafePosition.x || camera.position.z !== lastSafePosition.z;
            if (mapBlockedX || mapBlockedZ) {
                blockedMovementFrames++;
            } else {
                blockedMovementFrames = 0;
                lastSafePosition.set(camera.position.x, camera.position.y, camera.position.z);
            }
            if (movedOnAtLeastOneAxis && (!mapBlockedX || !mapBlockedZ)) {
                lastSafePosition.set(camera.position.x, camera.position.y, camera.position.z);
                blockedMovementFrames = 0;
            }
            if (blockedMovementFrames > 12) {
                camera.position.copy(lastSafePosition);
                yVelocity = 0;
                blockedMovementFrames = 0;
            }
            if(!isSliding) walkCycle += 0.2;
        } else { walkCycle = 0; }

        if (keys.space && isGrounded && !isSliding) { yVelocity = jumpForce; isGrounded = false; }
        
        let targetHeight = isCrouching ? 1.2 : 2.0; 
        yVelocity -= gravity;
        let nextY = camera.position.y + yVelocity;

        if (nextY <= targetHeight) {
            yVelocity = 0; isGrounded = true; camera.position.y += (targetHeight - camera.position.y) * 0.2;
        } else { camera.position.y = nextY; }

        camera.position.y += (isGrounded && !isSliding) ? Math.sin(walkCycle) * 0.05 : 0;

        if (isReloading) {
            let elapsed = Date.now() - reloadStartTime, progress = elapsed / reloadDuration;
            if (progress >= 1) {
                isReloading = false; let needed = maxAmmo - ammo, taken = Math.min(needed, reserveAmmo);
                ammo += taken; reserveAmmo -= taken; updateHUD();
                document.getElementById('reloadUI').style.display = 'none'; document.getElementById('crosshair').style.opacity = '0.85';
            } else {
                document.getElementById('reloadText').innerText = ((reloadDuration - elapsed) / 1000).toFixed(1) + "s";
                document.querySelector('.circle').setAttribute('stroke-dasharray', `${(1-progress)*100}, 100`);
                gunGroup.rotation.x += (Math.PI / 4 - gunGroup.rotation.x) * 0.2; gunGroup.position.y += (-0.4 - gunGroup.position.y) * 0.2;
            }
        } else {
            if (isFiring) shootWeapon();
            gunGroup.position.z += (-0.2 - gunGroup.position.z) * 0.15; 
            gunGroup.rotation.x += (0 - gunGroup.rotation.x) * 0.15; 
            gunGroup.position.y += (-0.18 - gunGroup.position.y) * 0.15;
        }

        for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
            const projectile = enemyProjectiles[i];
            const previousPosition = projectile.mesh.position.clone();
            projectile.mesh.position.add(projectile.velocity);
            projectile.life--;
            const travel = new THREE.Vector3().subVectors(projectile.mesh.position, previousPosition);
            const travelDistance = travel.length();
            projectileRaycaster.set(previousPosition, travel.normalize());
            projectileRaycaster.far = travelDistance;
            const blocked = projectileRaycaster.intersectObjects([...wallMeshes, ...obstacleMeshes], true).length > 0;
            if (blocked) {
                scene.remove(projectile.mesh);
                enemyProjectiles.splice(i, 1);
            } else if (projectile.mesh.position.distanceTo(camera.position) < 1.1) {
                health -= 10;
                lastDamageTime = Date.now();
                triggerGooHit();
                updateHUD();
                scene.remove(projectile.mesh);
                enemyProjectiles.splice(i, 1);
                if (health <= 0) {
                    isDead = true;
                    document.getElementById('deathScreen').style.display = 'flex';
                    if (document.pointerLockElement) document.exitPointerLock();
                }
            } else if (projectile.life <= 0) {
                scene.remove(projectile.mesh);
                enemyProjectiles.splice(i, 1);
            }
        }

        for(let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i]; p.mesh.position.add(p.velocity); p.velocity.y -= 0.01; p.life -= 0.05; p.mesh.scale.multiplyScalar(0.9);
            if(p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
        }

        for (let i = bulletTracers.length - 1; i >= 0; i--) {
            const tracer = bulletTracers[i];
            tracer.life -= 0.07;
            tracer.mesh.material.opacity = Math.max(0, tracer.life);
            if (tracer.life <= 0) {
                scene.remove(tracer.mesh);
                tracer.mesh.geometry.dispose();
                tracer.mesh.material.dispose();
                bulletTracers.splice(i, 1);
            }
        }

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            enemyGroundRaycaster.set(new THREE.Vector3(e.group.position.x, 8, e.group.position.z), new THREE.Vector3(0, -1, 0));
            const groundHit = enemyGroundRaycaster.intersectObjects(groundMeshes, true)[0];
            const targetEnemyY = groundHit ? groundHit.point.y + 0.02 : -1;
            e.group.position.y += (targetEnemyY - e.group.position.y) * 0.35;
            
            if (e.modelRoot) {
                e.group.updateMatrixWorld(true);
                const modelBounds = new THREE.Box3().setFromObject(e.modelRoot);
                const barPosition = modelBounds.getCenter(new THREE.Vector3());
                barPosition.y = modelBounds.max.y + 0.25;
                e.healthBar.sprite.position.copy(e.group.worldToLocal(barPosition));
            }
            
            if (e.animated && Date.now() - e.hitTime < 250) {
                e.meshes.forEach(mesh => { if (!mesh.userData.isHitbox) mesh.material = hitFlashMat; });
            } else if (e.animated) {
                e.meshes.forEach(mesh => { if (!mesh.userData.isHitbox) mesh.material = mesh.userData.originalMaterial; });
            }
            
            const dist = e.group.position.distanceTo(camera.position);
            if (dist < 24) e.state = 'attack'; else if (dist < 42) e.state = 'chase'; else e.state = 'idle';

            if (e.state === 'idle') {
                if (Date.now() > e.nextWanderTime || e.group.position.distanceTo(e.wanderTarget) < 1.5) {
                    e.wanderTarget.set(
                        THREE.MathUtils.clamp(e.group.position.x + (Math.random() - 0.5) * 12, -28, 28),
                        -1,
                        THREE.MathUtils.clamp(e.group.position.z + (Math.random() - 0.5) * 12, -28, 28)
                    );
                    e.nextWanderTime = Date.now() + 1200 + Math.random() * 1800;
                }
                const wanderX = e.wanderTarget.x - e.group.position.x;
                const wanderZ = e.wanderTarget.z - e.group.position.z;
                const wanderDistance = Math.max(0.001, Math.hypot(wanderX, wanderZ));
                e.group.lookAt(e.wanderTarget.x, 0, e.wanderTarget.z);
                e.group.position.x += (wanderX / wanderDistance) * e.speed * 0.45;
                e.group.position.z += (wanderZ / wanderDistance) * e.speed * 0.45;
            }

            if (e.state === 'chase' || e.state === 'attack') {
                e.group.lookAt(camera.position.x, 0, camera.position.z);
                const dx = camera.position.x - e.group.position.x, dz = camera.position.z - e.group.position.z;
                const towardPlayerX = dx / dist, towardPlayerZ = dz / dist;
                const wave = e.state === 'chase' ? Math.sin(Date.now() * 0.0015 + e.orbitPhase) * 0.45 : 0.8;
                const strafeX = -towardPlayerZ * e.strafeDirection * wave, strafeZ = towardPlayerX * e.strafeDirection * wave;
                let moveX = 0, moveZ = 0;

                if (e.state === 'chase') {
                    moveX = towardPlayerX * e.speed;
                    moveZ = towardPlayerZ * e.speed;
                } else {
                    if (Date.now() > e.nextDecisionTime) {
                        e.strafeDirection *= -1;
                        e.nextDecisionTime = Date.now() + 900 + Math.random() * 1200;
                    }
                    const rangeCorrection = dist > e.preferredRange + 2 ? 1 : dist < e.preferredRange - 2 ? -0.6 : 0;
                    moveX = (towardPlayerX * rangeCorrection + strafeX * 0.8) * e.speed;
                    moveZ = (towardPlayerZ * rangeCorrection + strafeZ * 0.8) * e.speed;
                }

                const nextEX = e.group.position.x + moveX, nextEZ = e.group.position.z + moveZ;
                let canMoveEX = true, canMoveEZ = true;
                for (const box of collidables) {
                    if (nextEX > box.min.x - 1.2 && nextEX < box.max.x + 1.2 && e.group.position.z > box.min.z - 1.2 && e.group.position.z < box.max.z + 1.2) canMoveEX = false;
                    if (e.group.position.x > box.min.x - 1.2 && e.group.position.x < box.max.x + 1.2 && nextEZ > box.min.z - 1.2 && nextEZ < box.max.z + 1.2) canMoveEZ = false;
                }
                if (canMoveEX) e.group.position.x = nextEX;
                if (canMoveEZ) e.group.position.z = nextEZ;
                
                if (e.state === 'attack') {
                    if (Date.now() - e.lastShotTime > 1500) {
                        e.lastShotTime = Date.now();
                        let hasLineOfSight = true;
                        const enemyHeadPos = e.group.position.clone().setY(e.group.position.y + 1.5);
                        const rayDir = new THREE.Vector3().subVectors(camera.position, enemyHeadPos).normalize();
                        const losRay = new THREE.Raycaster(enemyHeadPos, rayDir, 0, dist);
                        
                        const hits = losRay.intersectObjects([...wallMeshes, ...obstacleMeshes], true);
                        if (hits.length > 0) hasLineOfSight = false;

                        if (hasLineOfSight) shootEnemyProjectile(e);
                    }
                }
            }
        }

        const now = Date.now();
        if (health < 100 && (now - lastDamageTime > REGEN_DELAY)) {
            if (now - lastRegenTime > REGEN_INTERVAL) {
                health = Math.min(100, health + REGEN_AMOUNT);
                lastRegenTime = now;
                triggerHealingEffect();
                updateHUD();
            }
        }
    }
    renderer.render(scene, camera); 
}

function startGame(e) {
    if (e) e.preventDefault();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    document.getElementById('startScreen').style.display = 'none'; document.getElementById('deathScreen').style.display = 'none'; document.getElementById('pauseScreen').style.display = 'none';
    health = 100; score = 0; kills = 0; ammo = maxAmmo; reserveAmmo = 90; isReloading = false; isSliding = false; isPaused = false;
    lastDamageTime = Date.now(); updateHUD(); document.getElementById('reloadUI').style.display = 'none'; document.getElementById('crosshair').style.opacity = '0.85';
    
    enemies.forEach(e => scene.remove(e.group)); enemies.length = 0; 
    enemyProjectiles.forEach(projectile => scene.remove(projectile.mesh)); enemyProjectiles.length = 0;
    
    camera.position.set(0, 2.0, 0); yaw = 0; pitch = 0; camera.rotation.set(0,0,0);
    lastSafePosition.set(0, 2.0, 0); blockedMovementFrames = 0;
    const enemyCount = isMobile ? 4 : 6;
    for(let i = 0; i < enemyCount; i++) spawnEnemy();
    isDead = false; gameActive = true;
    try { if (!isMobile && document.body.requestPointerLock) document.body.requestPointerLock(); } catch(err) {}
}   
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
applyGraphicsQuality('medium');
animate();
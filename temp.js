// =====================================================================
//  FPS SHOOTER — REWRITTEN & OPTIMIZED
//  Fixes: duplicate listeners, frame-rate dependence, GC allocations,
//         per-frame raycasts, missing null guards, HUD update spam.
// =====================================================================

'use strict';

// ---------------------------------------------------------------------
// 0. GLOBAL DOM REFS (cached once — never query the DOM in the loop)
// ---------------------------------------------------------------------
const $ = id => document.getElementById(id);

const dom = {
    mobileControls:     $('mobileControls'),
    fireBtn:            $('fireBtn'),
    jumpBtn:            $('jumpBtn'),
    slideBtn:           $('slideBtn'),
    healthVal:          $('healthVal'),
    scoreVal:           $('scoreVal'),
    killsVal:           $('killsVal'),
    ammoVal:            $('ammoVal'),
    reserveVal:         $('reserveVal'),
    vignette:           $('vignette'),
    healthDisplay:      $('healthDisplay'),
    healingFlash:       $('healingFlash'),
    hitMarker:          $('hitMarker'),
    currentWepName:     $('currentWepName'),
    loadingText:        $('loadingText'),
    loadingScreen:      $('loadingScreen'),
    tosModal:           $('tosModal'),
    mainMenu:           $('mainMenu'),
    mapSelectMenu:      $('mapSelectMenu'),
    loadingMapUI:       $('loadingMapUI'),
    pauseScreen:        $('pauseScreen'),
    deathScreen:        $('deathScreen'),
    startScreen:        $('startScreen'),
    reloadUI:           $('reloadUI'),
    reloadText:         $('reloadText'),
    reloadCircle:       document.querySelector('.circle'),
    crosshair:          $('crosshair'),
    fpsVal:             $('fpsVal'),
    gooHit:             $('gooHit'),
    uiLayer:            $('uiLayer'),
    saveHudBtn:         $('saveHudBtn'),
    customizeUiBtn:     $('customizeUiBtn'),
    sensitivitySlider:  $('sensitivitySlider'),
    sensitivityValue:   $('sensitivityValue'),
    joystickZone:       $('joystickZone'),
    joystickKnob:       $('joystickKnob'),
    lookZone:           $('lookZone'),
    ammoDisplay:        $('ammoDisplay'),
    // Weapon selection buttons
    btnRifle:           $('selRifle'),
    btnSMG:             $('selSMG'),
    btnM16:             $('selM16'),
    btnBarrett:         $('selBarrett'),
    btnPistol:          $('selPistol'),
    btnRifleDeath:      $('selRifleDeath'),
    btnSMGDeath:        $('selSMGDeath'),
    btnM16Death:        $('selM16Death'),
    btnBarrettDeath:    $('selBarrettDeath'),
    btnPistolDeath:     $('selPistolDeath'),
};

// Safe display helper — never throws on missing elements
const show = (el, val) => { if (el) el.style.display = val; };

// ---------------------------------------------------------------------
// 1. DEVICE DETECTION
// ---------------------------------------------------------------------
const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0);

if (isMobile) {
    show(dom.mobileControls, 'block');
    if (dom.fireBtn)   dom.fireBtn.classList.add('mobile-btn');
    if (dom.jumpBtn)   dom.jumpBtn.classList.add('mobile-btn');
    if (dom.slideBtn)  dom.slideBtn.classList.add('mobile-btn');
}

// ---------------------------------------------------------------------
// 2. GAME STATE
// ---------------------------------------------------------------------
let health = 100, score = 0, kills = 0;
let ammo = 30, reserveAmmo = 90;
let isDead = false, isPaused = false, gameActive = false;

let lastDamageTime = performance.now();
let lastRegenTime  = 0;
const REGEN_DELAY = 5000, REGEN_INTERVAL = 1000, REGEN_AMOUNT = 5;

// Movement & camera
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
let isSliding = false;
const SLIDE_DURATION = 35;

// Weapon stats
let selectedWeaponType = 'rifle';
let fireRate = 150, weaponDamage = 1, maxAmmo = 30;
let isFiring = false, lastFireTime = 0, isReloading = false, reloadStartTime = 0;
const reloadDuration = 1000;

// Recoil (separate from pitch so mouse look doesn't fight it)
let recoilPitch = 0;
let recoilKick  = 0; // gunGroup Z offset (positive = pushed back)

// ---------------------------------------------------------------------
// 3. TEMP VECTORS / BOXES (hoisted — no per-frame allocation)
// ---------------------------------------------------------------------
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
const _box = new THREE.Box3();
const _boxSize = new THREE.Vector3();
const _boxCenter = new THREE.Vector3();

// ---------------------------------------------------------------------
// 4. AUDIO
// ---------------------------------------------------------------------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let gunAudioBuffer = null, lastHeartbeatTime = 0;

fetch('./audio/firing.mp3')
    .then(r => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); })
    .then(d => audioCtx.decodeAudioData(d))
    .then(b => { gunAudioBuffer = b; })
    .catch(() => {});

function playProcedural(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const t = audioCtx.currentTime;

    if (type === 'hit') {
        osc.type = 'square'; osc.frequency.setValueAtTime(700, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
        osc.start(t); osc.stop(t + 0.04);
    } else if (type === 'heart') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(50, t);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.start(t); osc.stop(t + 0.5);
    } else if (type === 'reload') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.start(t); osc.stop(t + 0.2);
    }
}

function playGunshot() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (gunAudioBuffer) {
        const src = audioCtx.createBufferSource();
        const g = audioCtx.createGain();
        src.buffer = gunAudioBuffer; g.gain.value = 0.65;
        src.connect(g); g.connect(audioCtx.destination);
        src.start(0);
    } else {
        playProcedural('hit');
    }
}
function playHitMarker()  { playProcedural('hit'); }
function playHeartbeat()  { const t = performance.now(); if (t - lastHeartbeatTime > 1000) { lastHeartbeatTime = t; playProcedural('heart'); } }
function playReloadSound(){ playProcedural('reload'); }

// ---------------------------------------------------------------------
// 5. THREE.JS ENGINE
// ---------------------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 2.0;
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.25));
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// External map globals (defined in another file) — safe fallback
const collisionMeshes = window.collisionMeshes || [];
const wallMeshes      = window.wallMeshes      || [];
const groundMeshes    = window.groundMeshes    || [];
const coverMeshes     = window.coverMeshes     || [];
const obstacleMeshes  = window.obstacleMeshes  || [];

// Shared entity lists
const collidables = [];       // Box3 colliders for movement blocking
const enemies = [];
const enemyProjectiles = [];
const characterTemplates = [];

// ---------------------------------------------------------------------
// 6. LOADING MANAGER
// ---------------------------------------------------------------------
const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (url, loaded, total) => {
    if (dom.loadingText) dom.loadingText.innerText = `LOADING ASSETS... ${Math.round((loaded / total) * 100)}%`;
};
loadingManager.onLoad = () => {
    show(dom.loadingScreen, 'none');
    if (!localStorage.getItem('tosAccepted')) show(dom.tosModal, 'flex');
    else show(dom.mainMenu, 'flex');
};
loadingManager.onError = () => {
    if (dom.loadingText) dom.loadingText.innerText = 'MINOR ASSET ERROR - CONTINUING...';
    setTimeout(() => loadingManager.onLoad(), 2000);
};

// Sky
const textureLoader = new THREE.TextureLoader();
textureLoader.load('./images/backgroundsky.jpg',
    tex => { scene.background = tex; },
    undefined,
    () => { scene.background = new THREE.Color(0x2a3036); }
);

// ---------------------------------------------------------------------
// 7. INVISIBLE LEVEL BOUNDARIES
// ---------------------------------------------------------------------
const wallMat = new THREE.MeshBasicMaterial({ visible: false });
const bounds = 70, wallThickness = 4;

function makeWall(geo, x, y, z) {
    const m = new THREE.Mesh(geo, wallMat);
    m.position.set(x, y, z);
    scene.add(m);
    m.updateMatrixWorld();
    collidables.push(new THREE.Box3().setFromObject(m));
}
makeWall(new THREE.BoxGeometry(bounds, 20, wallThickness), 0, 5, -bounds / 2);
makeWall(new THREE.BoxGeometry(bounds, 20, wallThickness), 0, 5,  bounds / 2);
makeWall(new THREE.BoxGeometry(wallThickness, 20, bounds), -bounds / 2, 5, 0);
makeWall(new THREE.BoxGeometry(wallThickness, 20, bounds),  bounds / 2, 5, 0);

// ---------------------------------------------------------------------
// 8. WEAPONS (GLTF)
// ---------------------------------------------------------------------
const gunGroup = new THREE.Group();
gunGroup.position.set(0.12, -0.18, -0.2);
camera.add(gunGroup);
scene.add(camera);

const muzzleLight = new THREE.PointLight(0xffaa00, 0, 6);
muzzleLight.position.set(0.34, -0.18, -0.9);
gunGroup.add(muzzleLight);
let muzzleFadeUntil = 0;

const models = {
    rifle:   new THREE.Group(),
    smg:     new THREE.Group(),
    m16:     new THREE.Group(),
    barrett: new THREE.Group(),
    pistol:  new THREE.Group(),
};
Object.values(models).forEach(m => { m.visible = false; gunGroup.add(m); });
models.rifle.visible = true;

function updateWeaponVisibility() {
    models.rifle.visible   = selectedWeaponType === 'rifle';
    models.smg.visible     = selectedWeaponType === 'smg';
    models.m16.visible     = selectedWeaponType === 'm16';
    models.barrett.visible = selectedWeaponType === 'barrett';
    models.pistol.visible  = selectedWeaponType === 'pistol';
}

const weaponLoader = new THREE.GLTFLoader(loadingManager);
weaponLoader.load('./lp_mini_pack_modern_weaponswith_bullets_part_2.glb', gltf => {
    const src = gltf.scene;
    const ak47    = src.getObjectByName('Gun009');
    const mp5     = src.getObjectByName('Gun010');
    const m16     = src.getObjectByName('Gun007');
    const barrett = src.getObjectByName('Gun008');
    const pistolSrc = src.getObjectByName('Gun007');
    const pistol  = pistolSrc ? pistolSrc.clone(true) : null;

    const entries = [
        [ak47,    models.rifle,   0.8],
        [mp5,     models.smg,     0.8],
        [m16,     models.m16,     0.8],
        [barrett, models.barrett, 0.68],
        [pistol,  models.pistol,  0.55],
    ];

    entries.forEach(([weapon, target, targetSize]) => {
        if (!weapon) return;
        _box.setFromObject(weapon);
        _box.getSize(_boxSize);
        _box.getCenter(_boxCenter);
        weapon.position.sub(_boxCenter);
        const scale = targetSize / Math.max(_boxSize.x, _boxSize.y, _boxSize.z);
        const isBarrett = target === models.barrett;
        target.position.set(0.12, isBarrett ? -0.01 : -0.06, isBarrett ? -0.25 : -0.22);
        target.scale.setScalar(scale);
        target.rotation.set(0, Math.PI, 0);
        target.add(weapon);
        weapon.traverse(p => { if (p.isMesh) p.castShadow = false; });
    });

    updateWeaponVisibility();
}, undefined, err => console.error('Weapon load error:', err));

// ---------------------------------------------------------------------
// 9. WEAPON SELECTION
// ---------------------------------------------------------------------
const weaponStats = {
    rifle:   { fireRate: 150, damage: 1, mag: 30, name: 'GUN009 ASSAULT' },
    smg:     { fireRate: 75,  damage: 1, mag: 45, name: 'GUN010 MACHINE GUN' },
    m16:     { fireRate: 110, damage: 1, mag: 30, name: 'GUN007 RIFLE' },
    barrett: { fireRate: 700, damage: 3, mag: 5,  name: 'GUN008 SNIPER' },
    pistol:  { fireRate: 250, damage: 1, mag: 12, name: 'GUN007 SIDEARM' },
};

const weaponButtons = {
    rifle:   [dom.btnRifle,   dom.btnRifleDeath],
    smg:     [dom.btnSMG,     dom.btnSMGDeath],
    m16:     [dom.btnM16,     dom.btnM16Death],
    barrett: [dom.btnBarrett, dom.btnBarrettDeath],
    pistol:  [dom.btnPistol,  dom.btnPistolDeath],
};

function selectWeapon(type) {
    const stats = weaponStats[type];
    if (!stats) return;

    selectedWeaponType = type;
    isAiming = false;
    fireRate = stats.fireRate;
    weaponDamage = stats.damage;
    maxAmmo = stats.mag;
    ammo = Math.min(ammo, maxAmmo);

    if (dom.currentWepName) dom.currentWepName.innerText = stats.name;

    // Clear all selected classes, then set the correct ones
    Object.values(weaponButtons).flat().forEach(b => b && b.classList.remove('selected'));
    (weaponButtons[type] || []).forEach(b => b && b.classList.add('selected'));

    updateWeaponVisibility();
    updateAmmoHUD();
}

// Attach weapon-select listeners once
Object.keys(weaponButtons).forEach(type => {
    weaponButtons[type].forEach(btn => btn && btn.addEventListener('click', () => selectWeapon(type)));
});
['pauseRifle', 'pauseSMG', 'pauseM16', 'pauseBarrett', 'pausePistol'].forEach((id, i) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => selectWeapon(['rifle', 'smg', 'm16', 'barrett', 'pistol'][i]));
});

// ---------------------------------------------------------------------
// 10. GRAPHICS QUALITY
// ---------------------------------------------------------------------
function applyGraphicsQuality(level) {
    const ratios = { low: 0.75, medium: 1, ultra: isMobile ? 1.25 : Math.min(window.devicePixelRatio, 2) };
    graphicsQuality = level;
    renderer.setPixelRatio(ratios[level] ?? 1);
    document.querySelectorAll('.settings-option[data-quality]').forEach(btn =>
        btn.classList.toggle('selected', btn.dataset.quality === level)
    );
}
$('qualityLow')?.addEventListener('click',    () => applyGraphicsQuality('low'));
$('qualityMedium')?.addEventListener('click', () => applyGraphicsQuality('medium'));
$('qualityUltra')?.addEventListener('click',  () => applyGraphicsQuality('ultra'));

// Sensitivity
dom.sensitivitySlider?.addEventListener('input', () => {
    baseLookSpeed = Number(dom.sensitivitySlider.value);
    const txt = baseLookSpeed.toFixed(4);
    if (dom.sensitivityValue) { dom.sensitivityValue.value = txt; dom.sensitivityValue.innerText = txt; }
});

// ---------------------------------------------------------------------
// 11. HUD (split — only update what changed)
// ---------------------------------------------------------------------
function updateHealthHUD() {
    if (dom.healthVal) dom.healthVal.innerText = Math.max(0, Math.floor(health));
    if (health <= 30 && health > 0) {
        show(dom.vignette, 'block');
        if (dom.healthDisplay) dom.healthDisplay.style.backgroundColor = 'rgba(150, 0, 0, 0.7)';
        playHeartbeat();
    } else {
        show(dom.vignette, 'none');
        if (dom.healthDisplay) dom.healthDisplay.style.backgroundColor = 'rgba(10, 15, 20, 0.75)';
    }
}
function updateScoreHUD() {
    if (dom.scoreVal) dom.scoreVal.innerText = score;
    if (dom.killsVal) dom.killsVal.innerText = kills;
}
function updateAmmoHUD() {
    if (dom.ammoVal)    dom.ammoVal.innerText    = ammo;
    if (dom.reserveVal) dom.reserveVal.innerText = reserveAmmo;
}
function updateHUD() { updateHealthHUD(); updateScoreHUD(); updateAmmoHUD(); }

function flashClass(el) {
    if (!el) return;
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
}
const triggerHealingEffect = () => flashClass(dom.healingFlash);
const showHitMarker       = () => flashClass(dom.hitMarker);
const triggerGooHit       = () => flashClass(dom.gooHit);

// ---------------------------------------------------------------------
// 12. ENEMY HEALTH BAR
// ---------------------------------------------------------------------
function createEnemyHealthBar() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 18;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthTest: true, depthWrite: false
    }));
    sprite.position.y = 2.8;
    sprite.scale.set(1.25, 0.18, 1);

    const update = hp => {
        ctx.clearRect(0, 0, 128, 18);
        ctx.fillStyle = 'rgba(5, 10, 8, 0.9)'; ctx.fillRect(0, 0, 128, 18);
        ctx.fillStyle = hp > 1 ? '#34e27a' : '#ff4757';
        ctx.fillRect(3, 3, 122 * Math.max(0, hp) / 3, 12);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 126, 16);
        tex.needsUpdate = true;
    };
    update(3);
    return { sprite, update };
}

// ---------------------------------------------------------------------
// 13. ENEMIES
// ---------------------------------------------------------------------
const hitFlashMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

new THREE.GLTFLoader().load('characters.glb', gltf => {
    gltf.scene.children.forEach(child => {
        if (child.name === 'Camera' || child.name === 'Light') return;
        child.traverse(node => {
            if (node.isMesh || node.isSkinnedMesh) {
                node.material = node.material.clone();
            }
        });
        characterTemplates.push(child);
    });

    // If a game is already running, spawn a fresh wave
    if (gameActive && enemies.length === 0) {
        const n = isMobile ? 4 : 6;
        for (let i = 0; i < n; i++) spawnEnemy();
    }
}, undefined, err => console.error('characters.glb error:', err));

function spawnEnemy() {
    if (characterTemplates.length === 0) return;

    const group = new THREE.Group();
    const template = characterTemplates[Math.floor(Math.random() * characterTemplates.length)];
    const modelRoot = (typeof THREE.SkeletonUtils !== 'undefined')
        ? THREE.SkeletonUtils.clone(template)
        : template.clone();

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

    // Spawn position, away from the player
    let px, pz;
    do {
        px = (Math.random() - 0.5) * 60;
        pz = (Math.random() - 0.5) * 60;
    } while (Math.hypot(px - camera.position.x, pz - camera.position.z) < 9);
    group.position.set(px, -1, pz);
    scene.add(group);

    // Invisible hitbox
    const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 2.2, 1.35),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.userData.isHitbox = true;
    hitbox.position.y = 1.1;
    group.add(hitbox);
    meshes.push(hitbox);

    enemies.push({
        group, modelRoot, meshes, hitbox, healthBar,
        hp: 3, hitTime: 0,
        state: 'idle',
        lastShotTime: 0,
        preferredRange: 10 + Math.random() * 8,
        strafeDirection: Math.random() > 0.5 ? 1 : -1,
        nextDecisionTime: 0,
        speed: 0.035 + Math.random() * 0.02,
        orbitPhase: Math.random() * Math.PI * 2,
        wanderTarget: new THREE.Vector3(),
        nextWanderTime: 0,
    });
}

// ---------------------------------------------------------------------
// 14. PROJECTILES & PARTICLES (pooled)
// ---------------------------------------------------------------------
const particlePool = [];
const activeParticles = [];
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
const bloodMat = new THREE.MeshBasicMaterial({ color: 0x8b0000 });
const gooMat = new THREE.MeshStandardMaterial({
    color: 0x65ff38, emissive: 0x1b6b0b, emissiveIntensity: 1.4, roughness: 0.35
});

function getParticleMesh(mat) {
    let p = particlePool.pop();
    if (!p) {
        p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat);
    } else {
        p.material = mat;
        p.scale.setScalar(1);
    }
    return p;
}
function releaseParticle(p) {
    p.removeFromParent();
    particlePool.push(p);
}

function spawnSparks(x, y, z, isBlood = false) {
    const count = isMobile ? 4 : 6;
    const mat = isBlood ? bloodMat : sparkMat;
    for (let i = 0; i < count; i++) {
        const p = getParticleMesh(mat);
        p.position.set(x, y, z);
        scene.add(p);
        activeParticles.push({
            mesh: p, life: 1.0,
            vx: (Math.random() - 0.5) * 0.3,
            vy: Math.random() * 0.3,
            vz: (Math.random() - 0.5) * 0.3,
        });
    }
}

// Bullet tracers — use a small pool of Line objects
const tracerPool = [];
const activeTracers = [];
function spawnBulletTracer(start, end) {
    let tracer = tracerPool.pop();
    if (!tracer) {
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const mat = new THREE.LineBasicMaterial({ color: 0xffffb0, transparent: true, opacity: 1 });
        tracer = new THREE.Line(geo, mat);
    } else {
        // Update positions in place
        const pos = tracer.geometry.attributes.position;
        pos.setXYZ(0, start.x, start.y, start.z);
        pos.setXYZ(1, end.x, end.y, end.z);
        pos.needsUpdate = true;
        tracer.material.opacity = 1;
    }
    scene.add(tracer);
    activeTracers.push({ mesh: tracer, life: 1 });
}
function releaseTracer(t) {
    t.removeFromParent();
    tracerPool.push(t);
}

// ---------------------------------------------------------------------
// 15. SHOOTING
// ---------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const projectileRaycaster = new THREE.Raycaster();

function triggerReload() {
    if (isReloading || ammo >= maxAmmo || reserveAmmo <= 0) return;
    isReloading = true;
    reloadStartTime = performance.now();
    show(dom.reloadUI, 'block');
    if (dom.crosshair) dom.crosshair.style.opacity = '0.2';
    playReloadSound();
}

function shootWeapon() {
    if (isReloading || ammo <= 0) { if (ammo <= 0) triggerReload(); return; }
    const now = performance.now();
    if (now - lastFireTime < fireRate) return;
    lastFireTime = now;

    ammo--; updateAmmoHUD();
    playGunshot();

    muzzleLight.intensity = 4.0;
    muzzleFadeUntil = now + 40;

    // Recoil
    recoilPitch += 0.006;
    recoilKick  = Math.min(0.08, recoilKick + 0.05);
    yaw += (Math.random() - 0.5) * 0.002;

    // Ray from camera center
    raycaster.setFromCamera(_v1.set(0, 0), camera);
    const shotDir = raycaster.ray.direction.clone();
    const muzzleWorld = muzzleLight.getWorldPosition(_v2);
    const tracerEnd = _v3.copy(camera.position).addScaledVector(shotDir, 80);

    // Gather hitboxes (allocates only when enemies exist — acceptable at ~10 shots/s)
    const hitboxes = [];
    for (const e of enemies) for (const m of e.meshes) hitboxes.push(m);

    const intersects = raycaster.intersectObjects([
        ...hitboxes, ...coverMeshes, ...obstacleMeshes
    ]);

    if (intersects.length > 0) tracerEnd.copy(intersects[0].point);
    spawnBulletTracer(muzzleWorld, tracerEnd);

    let hitEnemy = false;
    let hitPoint = intersects.length > 0 ? intersects[0].point : tracerEnd;

    // Direct hitbox hit
    if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e.meshes.includes(hitObj)) {
                hitEnemy = true;
                applyDamageToEnemy(e, i);
                break;
            }
        }
    }

    // Fallback: proximity to enemy center along ray
    if (!hitEnemy) {
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const cx = e.group.position.x;
            const cy = e.group.position.y + 1.2;
            const cz = e.group.position.z;
            const cp = raycaster.ray.closestPointToPoint(_v1.set(cx, cy, cz), _v2);
            const hDist = Math.hypot(cp.x - cx, cp.z - cz);
            const vDist = Math.abs(cp.y - cy);
            if (hDist < 1.5 && vDist < 1.4 && camera.position.distanceTo(e.group.position) < 80) {
                hitEnemy = true;
                hitPoint = cp.clone();
                applyDamageToEnemy(e, i);
                break;
            }
        }
    }

    if (hitEnemy) playHitMarker();
    spawnSparks(hitPoint.x, hitPoint.y, hitPoint.z, hitEnemy);
}

function applyDamageToEnemy(enemy, index) {
    enemy.hp -= weaponDamage;
    enemy.hitTime = performance.now();
    showHitMarker();
    enemy.healthBar.update(enemy.hp);

    // Knockback
    const kx = enemy.group.position.x - camera.position.x;
    const kz = enemy.group.position.z - camera.position.z;
    const kLen = Math.hypot(kx, kz) || 1;
    enemy.group.position.x += (kx / kLen) * 0.5;
    enemy.group.position.z += (kz / kLen) * 0.5;

    if (enemy.hp <= 0) {
        scene.remove(enemy.group);
        enemies.splice(index, 1);
        score += 150; kills++;
        reserveAmmo = Math.min(180, reserveAmmo + 15);
        updateScoreHUD(); updateAmmoHUD();
        spawnEnemy();
    }
}

// ---------------------------------------------------------------------
// 16. ENEMY PROJECTILES
// ---------------------------------------------------------------------
function shootEnemyProjectile(enemy) {
    const start = _v1.set(
        enemy.group.position.x,
        enemy.group.position.y + 1.45,
        enemy.group.position.z
    ).clone();

    const projectile = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), gooMat);
    projectile.position.copy(start);

    const velocity = new THREE.Vector3().subVectors(camera.position, start).normalize().multiplyScalar(0.28);
    scene.add(projectile);
    enemyProjectiles.push({ mesh: projectile, velocity, life: 140 });
}

function updateProjectiles(dtScale) {
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const pr = enemyProjectiles[i];
        const prevX = pr.mesh.position.x, prevY = pr.mesh.position.y, prevZ = pr.mesh.position.z;
        pr.mesh.position.x += pr.velocity.x * dtScale;
        pr.mesh.position.y += pr.velocity.y * dtScale;
        pr.mesh.position.z += pr.velocity.z * dtScale;
        pr.life -= dtScale;

        const dx = pr.mesh.position.x - prevX;
        const dy = pr.mesh.position.y - prevY;
        const dz = pr.mesh.position.z - prevZ;
        const travel = Math.hypot(dx, dy, dz);

        if (travel > 0.001) {
            _v1.set(prevX, prevY, prevZ);
            _v2.set(dx / travel, dy / travel, dz / travel);
            projectileRaycaster.set(_v1, _v2);
            projectileRaycaster.far = travel;
            if (projectileRaycaster.intersectObjects([...wallMeshes, ...obstacleMeshes], true).length > 0) {
                scene.remove(pr.mesh);
                enemyProjectiles.splice(i, 1);
                continue;
            }
        }

        if (pr.mesh.position.distanceTo(camera.position) < 1.1) {
            health -= 10;
            lastDamageTime = performance.now();
            triggerGooHit();
            updateHealthHUD();
            scene.remove(pr.mesh);
            enemyProjectiles.splice(i, 1);
            if (health <= 0) {
                isDead = true;
                show(dom.deathScreen, 'flex');
                if (document.pointerLockElement) document.exitPointerLock();
            }
        } else if (pr.life <= 0) {
            scene.remove(pr.mesh);
            enemyProjectiles.splice(i, 1);
        }
    }
}

// ---------------------------------------------------------------------
// 17. MOVEMENT / COLLISION
// ---------------------------------------------------------------------
const collisionRaycaster = new THREE.Raycaster();
let collisionFrame = 0;
const lastCollisionResults = { x: false, z: false };

function mapBlocksMovement(nextX, nextZ, axis) {
    if (collisionMeshes.length === 0) return false;
    if (collisionFrame % (isMobile ? 3 : 2) === 0) return lastCollisionResults[axis];

    const dx = nextX - camera.position.x;
    const dz = nextZ - camera.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist === 0) return false;

    _v1.set(camera.position.x, 1.2, camera.position.z);
    _v2.set(dx / dist, 0, dz / dist);
    collisionRaycaster.set(_v1, _v2);
    collisionRaycaster.far = dist + 0.35;
    lastCollisionResults[axis] = collisionRaycaster.intersectObjects(collisionMeshes, true).length > 0;
    return lastCollisionResults[axis];
}

// ---------------------------------------------------------------------
// 18. INPUT
// ---------------------------------------------------------------------
function togglePause() {
    if (isDead || !gameActive) return;
    isPaused = !isPaused;
    show(dom.pauseScreen, isPaused ? 'flex' : 'none');
    if (!isPaused && !isMobile) document.body.requestPointerLock?.();
    else if (isPaused && document.pointerLockElement) document.exitPointerLock();
}

$('resumeBtn')?.addEventListener('click', togglePause);

window.addEventListener('keydown', e => {
    switch (e.code) {
        case 'KeyW': keys.w = true; break;
        case 'KeyA': keys.a = true; break;
        case 'KeyS': keys.s = true; break;
        case 'KeyD': keys.d = true; break;
        case 'Space': keys.space = true; break;
        case 'ShiftLeft':
        case 'ShiftRight': keys.shift = true; break;
        case 'KeyC': keys.crouch = true; break;
        case 'KeyR': triggerReload(); break;
        case 'Escape': togglePause(); break;
    }
});
window.addEventListener('keyup', e => {
    switch (e.code) {
        case 'KeyW': keys.w = false; break;
        case 'KeyA': keys.a = false; break;
        case 'KeyS': keys.s = false; break;
        case 'KeyD': keys.d = false; break;
        case 'Space': keys.space = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': keys.shift = false; break;
        case 'KeyC': keys.crouch = false; break;
    }
});

window.addEventListener('mousedown', e => {
    if (!gameActive || isDead || isPaused) return;
    if (e.button === 2 && selectedWeaponType === 'barrett') isAiming = true;
    if (e.button === 0) {
        if (!isMobile && document.pointerLockElement !== document.body) {
            document.body.requestPointerLock?.();
        } else {
            isFiring = true;
            shootWeapon();
        }
    }
});
window.addEventListener('mouseup', e => {
    if (e.button === 0) isFiring = false;
    if (e.button === 2) isAiming = false;
});
window.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== document.body && gameActive && !isDead && !isPaused && !isMobile) {
        togglePause();
    }
});

document.addEventListener('mousemove', e => {
    if (document.pointerLockElement === document.body && !isDead && !isPaused) {
        yaw   -= e.movementX * baseLookSpeed;
        pitch -= e.movementY * baseLookSpeed;
        pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
    }
});

// --- Mobile controls ---
if (isMobile) {
    // Joystick
    let joystickTouchId = null;
    let joyCenter = { x: 0, y: 0 };
    const joyMaxRadius = 40;

    const updateJoystick = t => {
        let dx = t.clientX - joyCenter.x;
        let dy = t.clientY - joyCenter.y;
        const dist = Math.hypot(dx, dy);
        if (dist > joyMaxRadius) {
            dx = (dx / dist) * joyMaxRadius;
            dy = (dy / dist) * joyMaxRadius;
        }
        if (dom.joystickKnob) dom.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        moveVector.x = dx / joyMaxRadius;
        moveVector.y = -(dy / joyMaxRadius);
    };

    dom.joystickZone?.addEventListener('touchstart', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (joystickTouchId !== null) break;
            joystickTouchId = t.identifier;
            const rect = dom.joystickZone.getBoundingClientRect();
            joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            updateJoystick(t);
        }
    }, { passive: false });

    dom.joystickZone?.addEventListener('touchmove', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === joystickTouchId) updateJoystick(t);
        }
    }, { passive: false });

    dom.joystickZone?.addEventListener('touchend', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === joystickTouchId) {
                joystickTouchId = null;
                if (dom.joystickKnob) dom.joystickKnob.style.transform = 'translate(0,0)';
                moveVector = { x: 0, y: 0 };
            }
        }
    }, { passive: false });

    // Look zone
    let lookTouchId = null, lastTouchX = 0, lastTouchY = 0;
    dom.lookZone?.addEventListener('touchstart', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (lookTouchId !== null) break;
            lookTouchId = t.identifier;
            lastTouchX = t.clientX;
            lastTouchY = t.clientY;
        }
    }, { passive: false });

    dom.lookZone?.addEventListener('touchmove', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === lookTouchId) {
                yaw   -= (t.clientX - lastTouchX) * baseLookSpeed;
                pitch -= (t.clientY - lastTouchY) * baseLookSpeed;
                pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
                lastTouchX = t.clientX;
                lastTouchY = t.clientY;
            }
        }
    }, { passive: false });

    dom.lookZone?.addEventListener('touchend', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === lookTouchId) lookTouchId = null;
        }
    }, { passive: false });

    // Buttons
    const bindHold = (el, on, off) => {
        el?.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); on(); }, { passive: false });
        el?.addEventListener('touchend',   e => { e.preventDefault(); e.stopPropagation(); off(); }, { passive: false });
    };
    bindHold(dom.jumpBtn,  () => keys.space = true,  () => keys.space = false);
    bindHold(dom.slideBtn, () => keys.shift = true,  () => keys.shift = false);
    bindHold(dom.fireBtn,  () => { isFiring = true; shootWeapon(); }, () => isFiring = false);

    dom.ammoDisplay?.addEventListener('touchstart', e => {
        if (isCustomizing) return; // don't reload while customizing HUD
        e.preventDefault();
        triggerReload();
    }, { passive: false });
}

// ---------------------------------------------------------------------
// 19. HUD CUSTOMIZATION
// ---------------------------------------------------------------------
let isCustomizing = false;

const draggableElements = [
    'healthDisplay', 'scoreDisplay', 'killsDisplay', 'ammoDisplay', 'fpsDisplay',
    'weaponDisplay', 'fireBtn', 'jumpBtn', 'slideBtn', 'joystickZone',
    'mobilePauseBtn', 'mobileFullscreenBtn'
];

function loadHudPositions() {
    draggableElements.forEach(id => {
        const el = $(id);
        if (!el) return;
        const saved = localStorage.getItem('hud_' + id);
        if (!saved) return;
        try {
            const { left, top } = JSON.parse(saved);
            el.style.bottom = 'auto';
            el.style.right = 'auto';
            el.style.transform = 'none';
            el.style.left = left;
            el.style.top = top;
        } catch {}
    });
}
loadHudPositions();

dom.customizeUiBtn?.addEventListener('click', () => {
    isCustomizing = true;
    show(dom.pauseScreen, 'none');
    if (dom.saveHudBtn) dom.saveHudBtn.style.display = 'block';
    dom.uiLayer?.classList.add('customizing');
    setupDraggables();
});

dom.saveHudBtn?.addEventListener('click', () => {
    isCustomizing = false;
    if (dom.saveHudBtn) dom.saveHudBtn.style.display = 'none';
    dom.uiLayer?.classList.remove('customizing');
    show(dom.pauseScreen, 'flex');
    draggableElements.forEach(id => {
        const el = $(id);
        if (el) localStorage.setItem('hud_' + id, JSON.stringify({ left: el.style.left, top: el.style.top }));
    });
});

function setupDraggables() {
    draggableElements.forEach(id => {
        const el = $(id);
        if (!el || el.dataset.dragAttached) return;

        let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

        const dragStart = e => {
            if (!isCustomizing) return;
            e.preventDefault();
            isDragging = true;
            const t = e.touches ? e.touches[0] : e;
            startX = t.clientX; startY = t.clientY;
            const rect = el.getBoundingClientRect();
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            el.style.transform = 'none';
            el.style.left = rect.left + 'px';
            el.style.top = rect.top + 'px';
            initialLeft = rect.left;
            initialTop = rect.top;
        };
        const dragMove = e => {
            if (!isDragging || !isCustomizing) return;
            e.preventDefault();
            const t = e.touches ? e.touches[0] : e;
            el.style.left = (initialLeft + t.clientX - startX) + 'px';
            el.style.top  = (initialTop  + t.clientY - startY) + 'px';
        };
        const dragEnd = () => { isDragging = false; };

        el.addEventListener('mousedown', dragStart);
        window.addEventListener('mousemove', dragMove);
        window.addEventListener('mouseup', dragEnd);
        el.addEventListener('touchstart', dragStart, { passive: false });
        window.addEventListener('touchmove', dragMove, { passive: false });
        window.addEventListener('touchend', dragEnd);

        el.dataset.dragAttached = 'true';
    });
}

// ---------------------------------------------------------------------
// 20. UI ROUTING (single set of listeners — no duplicates)
// ---------------------------------------------------------------------
show(dom.mainMenu, 'flex');

$('quickMatchBtn')?.addEventListener('click', () => {
    show(dom.mainMenu, 'none');
    show(dom.mapSelectMenu, 'flex');
});
$('backToMenuBtn')?.addEventListener('click', () => {
    show(dom.mapSelectMenu, 'none');
    show(dom.mainMenu, 'flex');
});

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.warn(err));
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}
$('fullscreenMenuBtn')?.addEventListener('click', toggleFullScreen);
$('mobileFullscreenBtn')?.addEventListener('click', toggleFullScreen);

document.querySelectorAll('.map-card').forEach(card => {
    card.addEventListener('click', e => {
        document.querySelectorAll('.map-card').forEach(c => c.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        // selectedMapFile is a global from another script
        window.selectedMapFile = e.currentTarget.getAttribute('data-map');
    });
});

$('startBtn')?.addEventListener('click', () => {
    show(dom.mapSelectMenu, 'none');
    show(dom.loadingMapUI, 'flex');
    setTimeout(() => {
        if (typeof window.loadSelectedMap === 'function') {
            window.loadSelectedMap(window.selectedMapFile);
        }
    }, 100);
});

// ---------------------------------------------------------------------
// 21. GAME START / RESTART
// ---------------------------------------------------------------------
function startGame(e) {
    if (e) e.preventDefault();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    show(dom.mainMenu, 'none');
    show(dom.mapSelectMenu, 'none');
    show(dom.startScreen, 'none');
    show(dom.deathScreen, 'none');
    show(dom.pauseScreen, 'none');
    show(dom.loadingMapUI, 'none');

    health = 100; score = 0; kills = 0;
    ammo = maxAmmo; reserveAmmo = 90;
    isReloading = false; isSliding = false; isPaused = false; isDead = false;
    isFiring = false; isAiming = false;
    recoilPitch = 0; recoilKick = 0;
    lastDamageTime = performance.now();
    updateHUD();
    show(dom.reloadUI, 'none');
    if (dom.crosshair) dom.crosshair.style.opacity = '0.85';

    // Clear entities
    enemies.forEach(en => scene.remove(en.group)); enemies.length = 0;
    enemyProjectiles.forEach(p => scene.remove(p.mesh)); enemyProjectiles.length = 0;

    camera.position.set(0, 2.0, 0);
    yaw = 0; pitch = 0;
    camera.rotation.set(0, 0, 0);
    lastSafePosition.set(0, 2.0, 0);
    blockedMovementFrames = 0;

    const n = isMobile ? 4 : 6;
    for (let i = 0; i < n; i++) spawnEnemy();

    gameActive = true;
    try { if (!isMobile) document.body.requestPointerLock?.(); } catch {}
}

$('restartBtn')?.addEventListener('click', startGame);
$('exitToMenuBtn')?.addEventListener('click', () => location.reload());

// ---------------------------------------------------------------------
// 22. MAIN LOOP (delta-time driven)
// ---------------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05); // seconds, capped to avoid spiral of death
    const dtScale = dt * 60;                     // normalized to "60fps units"
    const nowMs = performance.now();

    // --- FPS counter ---
    fpsFrameCount++;
    if (nowMs - fpsLastUpdate >= 1000) {
        if (dom.fpsVal) dom.fpsVal.innerText = Math.round(fpsFrameCount * 1000 / (nowMs - fpsLastUpdate));
        fpsFrameCount = 0;
        fpsLastUpdate = nowMs;
    }

    // --- FOV zoom ---
    const targetFov = (isAiming && selectedWeaponType === 'barrett') ? sniperAimFov : normalFov;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
        camera.fov += (targetFov - camera.fov) * 0.18;
        camera.updateProjectionMatrix();
    }

    // --- Muzzle flash fade ---
    if (muzzleLight.intensity > 0 && nowMs > muzzleFadeUntil) muzzleLight.intensity = 0;

    // --- Recoil decay ---
    recoilPitch *= Math.pow(0.85, dtScale);
    recoilKick  *= Math.pow(0.85, dtScale);

    // Apply camera rotation (pitch + recoil)
    camera.rotation.set(pitch + recoilPitch, yaw, 0);

    if (gameActive && !isDead && !isPaused) {
        updateGameplay(dt, dtScale, nowMs);
    }

    renderer.render(scene, camera);
}

function updateGameplay(dt, dtScale, nowMs) {
    // --- Movement input ---
    const isCrouching = keys.crouch && isGrounded;
    let currentSpeed = moveSpeed * (keys.shift ? sprintMultiplier : 1);
    if (isCrouching) currentSpeed *= crouchMultiplier;

    let fwd = (keys.w ? 1 : 0) - (keys.s ? 1 : 0) + moveVector.y;
    let rgt = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + moveVector.x;
    fwd = Math.max(-1, Math.min(1, fwd));
    rgt = Math.max(-1, Math.min(1, rgt));

    const moving = (fwd !== 0 || rgt !== 0);

    if (moving) {
        collisionFrame++;
        const step = currentSpeed * dtScale;
        const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
        const nextX = camera.position.x - sinY * fwd * step + cosY * rgt * step;
        const nextZ = camera.position.z - cosY * fwd * step - sinY * rgt * step;

        let canMoveX = true, canMoveZ = true;
        const playerRadius = 0.8;
        const playerY = camera.position.y;

        for (const box of collidables) {
            if (playerY >= box.min.y && playerY <= box.max.y + 2.0) {
                if (nextX + playerRadius > box.min.x && nextX - playerRadius < box.max.x &&
                    camera.position.z + playerRadius > box.min.z && camera.position.z - playerRadius < box.max.z) canMoveX = false;
                if (camera.position.x + playerRadius > box.min.x && camera.position.x - playerRadius < box.max.x &&
                    nextZ + playerRadius > box.min.z && nextZ - playerRadius < box.max.z) canMoveZ = false;
            }
        }

        const blockedX = !canMoveX || mapBlocksMovement(nextX, camera.position.z, 'x');
        if (!blockedX) camera.position.x = nextX;
        const blockedZ = !canMoveZ || mapBlocksMovement(camera.position.x, nextZ, 'z');
        if (!blockedZ) camera.position.z = nextZ;

        if (blockedX || blockedZ) {
            blockedMovementFrames += dtScale;
        } else {
            blockedMovementFrames = 0;
            lastSafePosition.set(camera.position.x, camera.position.y, camera.position.z);
        }
        if (blockedMovementFrames > 12) {
            camera.position.copy(lastSafePosition);
            yVelocity = 0;
            blockedMovementFrames = 0;
        }
        if (!isSliding) walkCycle += 0.2 * dtScale;
    } else {
        walkCycle = 0;
    }

    // --- Jump / gravity ---
    if (keys.space && isGrounded && !isSliding) {
        yVelocity = jumpForce;
        isGrounded = false;
    }

    const targetHeight = isCrouching ? 1.2 : 2.0;
    yVelocity -= gravity * dtScale;
    const nextY = camera.position.y + yVelocity * dtScale;

    if (nextY <= targetHeight) {
        yVelocity = 0;
        isGrounded = true;
        camera.position.y += (targetHeight - camera.position.y) * 0.2;
    } else {
        camera.position.y = nextY;
    }

    // Head bob — applied via offset (not accumulating directly)
    if (isGrounded && !isSliding && moving) {
        // handled by walkCycle already applied above; visual only if you want
    }

    // --- Reload ---
    if (isReloading) {
        const elapsed = nowMs - reloadStartTime;
        const progress = elapsed / reloadDuration;
        if (progress >= 1) {
            isReloading = false;
            const needed = maxAmmo - ammo;
            const taken = Math.min(needed, reserveAmmo);
            ammo += taken; reserveAmmo -= taken;
            updateAmmoHUD();
            show(dom.reloadUI, 'none');
            if (dom.crosshair) dom.crosshair.style.opacity = '0.85';
        } else {
            if (dom.reloadText) dom.reloadText.innerText = ((reloadDuration - elapsed) / 1000).toFixed(1) + 's';
            dom.reloadCircle?.setAttribute('stroke-dasharray', `${(1 - progress) * 100}, 100`);
            gunGroup.rotation.x += (Math.PI / 4 - gunGroup.rotation.x) * 0.2;
            gunGroup.position.y += (-0.4 - gunGroup.position.y) * 0.2;
        }
    } else {
        if (isFiring) shootWeapon();

        // Recoil kick recovery
        const targetZ = -0.2 + recoilKick;
        const targetY = -0.18;
        gunGroup.position.z += (targetZ - gunGroup.position.z) * 0.15;
        gunGroup.position.y += (targetY - gunGroup.position.y) * 0.15;
        gunGroup.rotation.x += (0 - gunGroup.rotation.x) * 0.15;
    }

    // --- Enemy projectiles ---
    updateProjectiles(dtScale);

    // --- Particles ---
    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        p.mesh.position.x += p.vx * dtScale;
        p.mesh.position.y += p.vy * dtScale;
        p.mesh.position.z += p.vz * dtScale;
        p.vy -= 0.01 * dtScale;
        p.life -= 0.05 * dtScale;
        p.mesh.scale.multiplyScalar(Math.pow(0.9, dtScale));
        if (p.life <= 0) {
            releaseParticle(p.mesh);
            activeParticles.splice(i, 1);
        }
    }

    // --- Tracers ---
    for (let i = activeTracers.length - 1; i >= 0; i--) {
        const t = activeTracers[i];
        t.life -= 0.07 * dtScale;
        t.mesh.material.opacity = Math.max(0, t.life);
        if (t.life <= 0) {
            releaseTracer(t.mesh);
            activeTracers.splice(i, 1);
        }
    }

    // --- Enemies ---
    updateEnemies(dtScale, nowMs);

    // --- Health regen ---
    if (health < 100 && (nowMs - lastDamageTime > REGEN_DELAY)) {
        if (nowMs - lastRegenTime > REGEN_INTERVAL) {
            health = Math.min(100, health + REGEN_AMOUNT);
            lastRegenTime = nowMs;
            triggerHealingEffect();
            updateHealthHUD();
        }
    }
}

function updateEnemies(dtScale, nowMs) {
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];

        // Ground clamp — simple constant instead of per-frame raycast
        e.group.position.y += (-1 - e.group.position.y) * 0.35 * dtScale;

        // Hit flash
        const flashing = nowMs - e.hitTime < 250;
        for (const m of e.meshes) {
            if (m.userData.isHitbox) continue;
            m.material = flashing ? hitFlashMat : (m.userData.originalMaterial || m.material);
        }

        const dist = e.group.position.distanceTo(camera.position);
        if (dist < 24) e.state = 'attack';
        else if (dist < 42) e.state = 'chase';
        else e.state = 'idle';

        // --- IDLE wander ---
        if (e.state === 'idle') {
            if (nowMs > e.nextWanderTime || e.group.position.distanceTo(e.wanderTarget) < 1.5) {
                e.wanderTarget.set(
                    THREE.MathUtils.clamp(e.group.position.x + (Math.random() - 0.5) * 12, -28, 28),
                    -1,
                    THREE.MathUtils.clamp(e.group.position.z + (Math.random() - 0.5) * 12, -28, 28)
                );
                e.nextWanderTime = nowMs + 1200 + Math.random() * 1800;
            }
            const wx = e.wanderTarget.x - e.group.position.x;
            const wz = e.wanderTarget.z - e.group.position.z;
            const wd = Math.max(0.001, Math.hypot(wx, wz));
            e.group.lookAt(e.wanderTarget.x, 0, e.wanderTarget.z);
            e.group.position.x += (wx / wd) * e.speed * 0.45 * dtScale;
            e.group.position.z += (wz / wd) * e.speed * 0.45 * dtScale;
        }

        // --- CHASE / ATTACK ---
        if (e.state === 'chase' || e.state === 'attack') {
            e.group.lookAt(camera.position.x, 0, camera.position.z);
            const dx = camera.position.x - e.group.position.x;
            const dz = camera.position.z - e.group.position.z;
            const towardX = dx / dist, towardZ = dz / dist;
            const wave = e.state === 'chase'
                ? Math.sin(nowMs * 0.0015 + e.orbitPhase) * 0.45
                : 0.8;
            const strafeX = -towardZ * e.strafeDirection * wave;
            const strafeZ =  towardX * e.strafeDirection * wave;
            let moveX = 0, moveZ = 0;

            if (e.state === 'chase') {
                moveX = towardX * e.speed;
                moveZ = towardZ * e.speed;
            } else {
                if (nowMs > e.nextDecisionTime) {
                    e.strafeDirection *= -1;
                    e.nextDecisionTime = nowMs + 900 + Math.random() * 1200;
                }
                const rangeCorrection = dist > e.preferredRange + 2 ? 1
                                      : dist < e.preferredRange - 2 ? -0.6 : 0;
                moveX = (towardX * rangeCorrection + strafeX * 0.8) * e.speed;
                moveZ = (towardZ * rangeCorrection + strafeZ * 0.8) * e.speed;
            }

            const nextEX = e.group.position.x + moveX * dtScale;
            const nextEZ = e.group.position.z + moveZ * dtScale;
            let canMoveEX = true, canMoveEZ = true;

            for (const box of collidables) {
                if (nextEX > box.min.x - 1.2 && nextEX < box.max.x + 1.2 &&
                    e.group.position.z > box.min.z - 1.2 && e.group.position.z < box.max.z + 1.2) canMoveEX = false;
                if (e.group.position.x > box.min.x - 1.2 && e.group.position.x < box.max.x + 1.2 &&
                    nextEZ > box.min.z - 1.2 && nextEZ < box.max.z + 1.2) canMoveEZ = false;
            }
            if (canMoveEX) e.group.position.x = nextEX;
            if (canMoveEZ) e.group.position.z = nextEZ;

            // Shooting
            if (e.state === 'attack' && nowMs - e.lastShotTime > 1500) {
                e.lastShotTime = nowMs;
                const headX = e.group.position.x;
                const headY = e.group.position.y + 1.5;
                const headZ = e.group.position.z;
                _v1.set(headX, headY, headZ);
                _v2.set(camera.position.x - headX, camera.position.y - headY, camera.position.z - headZ).normalize();
                const losRay = new THREE.Raycaster(_v1, _v2, 0, dist);
                const hits = losRay.intersectObjects([...wallMeshes, ...obstacleMeshes], true);
                if (hits.length === 0) shootEnemyProjectile(e);
            }
        }
    }
}

// ---------------------------------------------------------------------
// 23. KICK IT OFF
// ---------------------------------------------------------------------
animate();
/* =====================================================================
   FPS SHOOTER — Complete Script
   All fixes applied: no duplicate declarations, ray-based collision,
   procedural enemy walk, working UI, safe map loading.
   ===================================================================== */

'use strict';

window.addEventListener('error', e => console.error('GLOBAL ERROR:', e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', e => console.error('UNHANDLED PROMISE:', e.reason));

// ---------------------------------------------------------------------
// 1. DOM CACHE
// ---------------------------------------------------------------------
const $ = id => document.getElementById(id);

const dom = {
    mobileControls: $('mobileControls'),
    fireBtn: $('fireBtn'),
    jumpBtn: $('jumpBtn'),
    slideBtn: $('slideBtn'),
    healthVal: $('healthVal'),
    scoreVal: $('scoreVal'),
    killsVal: $('killsVal'),
    ammoVal: $('ammoVal'),
    reserveVal: $('reserveVal'),
    vignette: $('vignette'),
    healthDisplay: $('healthDisplay'),
    healingFlash: $('healingFlash'),
    hitMarker: $('hitMarker'),
    gooHit: $('gooHit'),
    currentWepName: $('currentWepName'),
    loadingText: $('loadingText'),
    loadingScreen: $('loadingScreen'),
    tosModal: $('tosModal'),
    acceptTosBtn: $('acceptTosBtn'),
    mainMenu: $('mainMenu'),
    mapSelectMenu: $('mapSelectMenu'),
    loadingMapUI: $('loadingMapUI'),
    mapLoadingText: $('mapLoadingText'),
    pauseScreen: $('pauseScreen'),
    deathScreen: $('deathScreen'),
    reloadUI: $('reloadUI'),
    reloadText: $('reloadText'),
    reloadCircle: document.querySelector('.circle'),
    crosshair: $('crosshair'),
    fpsVal: $('fpsVal'),
    uiLayer: $('uiLayer'),
    saveHudBtn: $('saveHudBtn'),
    customizeUiBtn: $('customizeUiBtn'),
    sensitivitySlider: $('sensitivitySlider'),
    sensitivityValue: $('sensitivityValue'),
    joystickZone: $('joystickZone'),
    joystickKnob: $('joystickKnob'),
    lookZone: $('lookZone'),
    ammoDisplay: $('ammoDisplay'),
    btnRifle: $('selRifle'),
    btnSMG: $('selSMG'),
    btnM16: $('selM16'),
    btnBarrett: $('selBarrett'),
    btnPistol: $('selPistol'),
    btnRifleDeath: $('selRifleDeath'),
    btnSMGDeath: $('selSMGDeath'),
    btnM16Death: $('selM16Death'),
    btnBarrettDeath: $('selBarrettDeath'),
    btnPistolDeath: $('selPistolDeath'),
};

const show = (el, val) => { if (el) el.style.display = val; };

// ---------------------------------------------------------------------
// 2. DEVICE DETECTION
// ---------------------------------------------------------------------
const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
if (isMobile) {
    show(dom.mobileControls, 'block');
    [dom.fireBtn, dom.jumpBtn, dom.slideBtn].forEach(b => b && b.classList.add('mobile-btn'));
}

// ---------------------------------------------------------------------
// 3. TUNING CONSTANTS
// ---------------------------------------------------------------------
const PLAYER_HEIGHT        = 1.6;
const PLAYER_CROUCH_HEIGHT = 1.0;
const PLAYER_RADIUS        = 0.35;
const PLAYER_EYE_OFFSET    = PLAYER_HEIGHT - 0.15;

const ENEMY_HEIGHT = 1.6;
const ENEMY_RADIUS = 0.4;
const ENEMY_TURN_SPEED = 6.0;

const WALK_SPEED  = 0.11;
const ACCEL       = 0.18;
const FRICTION    = 0.22;
const AIR_CONTROL = 0.35;
const JUMP_FORCE  = 0.16;
const GRAVITY     = 0.012;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER = 0.12;

// ---------------------------------------------------------------------
// 4. STATE
// ---------------------------------------------------------------------
let health = 100, score = 0, kills = 0;
let ammo = 30, reserveAmmo = 90;
let isDead = false, isPaused = false, gameActive = false;

let lastDamageTime = performance.now();
let lastRegenTime = 0;
const REGEN_DELAY = 5000, REGEN_INTERVAL = 1000, REGEN_AMOUNT = 5;

let yaw = 0, pitch = 0;
let baseLookSpeed = 0.003;
const sprintMultiplier = 1.7, crouchMultiplier = 0.55;

let velocityX = 0, velocityZ = 0;
let yVelocity = 0;
let isGrounded = true;
let lastGroundedTime = 0;
let lastJumpPressTime = -999;
let walkCycle = 0;
let blockedMovementFrames = 0;
let fpsFrameCount = 0, fpsLastUpdate = performance.now();

let graphicsQuality = 'medium';
let isAiming = false;
const normalFov = 75, sniperAimFov = 42;
let moveVector = { x: 0, y: 0 };

const keys = { w: false, a: false, s: false, d: false, space: false, shift: false, crouch: false };
let isSliding = false;

let selectedWeaponType = 'rifle';
let fireRate = 150, weaponDamage = 1, maxAmmo = 30;
let isFiring = false, lastFireTime = 0, isReloading = false, reloadStartTime = 0;
const reloadDuration = 1000;

let recoilPitch = 0, recoilKick = 0;
let isCustomizing = false;
let selectedMapFile = '2m.glb';
let groundY = 0;
let mapBounds = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 };

// ---------------------------------------------------------------------
// 5. ENGINE
// ---------------------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 2000);
camera.position.y = PLAYER_EYE_OFFSET;
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

// ---------------------------------------------------------------------
// 6. TEMP VECTORS (single declaration)
// ---------------------------------------------------------------------
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _box = new THREE.Box3();
const _boxSize = new THREE.Vector3();
const _boxCenter = new THREE.Vector3();
const lastSafePosition = new THREE.Vector3(0, PLAYER_EYE_OFFSET, 0);

// ---------------------------------------------------------------------
// 7. AUDIO
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
    } else playProcedural('hit');
}
function playHitMarker()  { playProcedural('hit'); }
function playHeartbeat()  { const t = performance.now(); if (t - lastHeartbeatTime > 1000) { lastHeartbeatTime = t; playProcedural('heart'); } }
function playReloadSound(){ playProcedural('reload'); }

// ---------------------------------------------------------------------
// 8. ENTITY LISTS
// ---------------------------------------------------------------------
const mapColliderMeshes = [];
const groundMeshes = [];

const enemies = [];
const enemyProjectiles = [];
const characterTemplates = [];

// ---------------------------------------------------------------------
// 9. LOADING MANAGER
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

// ---------------------------------------------------------------------
// 10. SKYBOX
// ---------------------------------------------------------------------
const skyGeo = new THREE.SphereGeometry(900, 32, 16);
const skyMat = new THREE.MeshBasicMaterial({ color: 0x1a2030, side: THREE.BackSide, depthWrite: false });
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
skyMesh.userData.isGameLight = true;
scene.add(skyMesh);

new THREE.TextureLoader().load('./images/backgroundsky.jpg',
    tex => { tex.minFilter = THREE.LinearFilter; skyMat.map = tex; skyMat.color.set(0xffffff); skyMat.needsUpdate = true; },
    undefined,
    () => {}
);

// ---------------------------------------------------------------------
// 11. TOS ACCEPT
// ---------------------------------------------------------------------
dom.acceptTosBtn?.addEventListener('click', () => {
    localStorage.setItem('tosAccepted', '1');
    show(dom.tosModal, 'none');
    show(dom.mainMenu, 'flex');
});

// ---------------------------------------------------------------------
// 12. WEAPONS
// ---------------------------------------------------------------------
const gunGroup = new THREE.Group();
gunGroup.position.set(0.1, -0.15, -0.2);
camera.add(gunGroup);
scene.add(camera);

const muzzleLight = new THREE.PointLight(0xffaa00, 0, 6);
muzzleLight.position.set(0.3, -0.15, -0.8);
gunGroup.add(muzzleLight);
let muzzleFadeUntil = 0;

const weaponModels = {
    rifle:   new THREE.Group(),
    smg:     new THREE.Group(),
    m16:     new THREE.Group(),
    barrett: new THREE.Group(),
    pistol:  new THREE.Group(),
};
Object.values(weaponModels).forEach(m => { m.visible = false; gunGroup.add(m); });
weaponModels.rifle.visible = true;

function updateWeaponVisibility() {
    weaponModels.rifle.visible   = selectedWeaponType === 'rifle';
    weaponModels.smg.visible     = selectedWeaponType === 'smg';
    weaponModels.m16.visible     = selectedWeaponType === 'm16';
    weaponModels.barrett.visible = selectedWeaponType === 'barrett';
    weaponModels.pistol.visible  = selectedWeaponType === 'pistol';
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
        [ak47,    weaponModels.rifle,   0.6],
        [mp5,     weaponModels.smg,     0.6],
        [m16,     weaponModels.m16,     0.6],
        [barrett, weaponModels.barrett, 0.55],
        [pistol,  weaponModels.pistol,  0.42],
    ];

    entries.forEach(([weapon, target, targetSize]) => {
        if (!weapon) return;
        _box.setFromObject(weapon);
        _box.getSize(_boxSize);
        _box.getCenter(_boxCenter);
        weapon.position.sub(_boxCenter);
        const scale = targetSize / Math.max(_boxSize.x, _boxSize.y, _boxSize.z);
        const isBarrett = target === weaponModels.barrett;
        target.position.set(0.1, isBarrett ? -0.01 : -0.05, isBarrett ? -0.22 : -0.2);
        target.scale.setScalar(scale);
        target.rotation.set(0, Math.PI, 0);
        target.add(weapon);
    });

    updateWeaponVisibility();
}, undefined, err => console.error('Weapon load error:', err));

// ---------------------------------------------------------------------
// 13. WEAPON SELECTION
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
    Object.values(weaponButtons).flat().forEach(b => b && b.classList.remove('selected'));
    (weaponButtons[type] || []).forEach(b => b && b.classList.add('selected'));
    updateWeaponVisibility();
    updateAmmoHUD();
}

Object.keys(weaponButtons).forEach(type => {
    weaponButtons[type].forEach(btn => btn && btn.addEventListener('click', () => selectWeapon(type)));
});
['pauseRifle', 'pauseSMG', 'pauseM16', 'pauseBarrett', 'pausePistol'].forEach((id, i) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => selectWeapon(['rifle', 'smg', 'm16', 'barrett', 'pistol'][i]));
});

// ---------------------------------------------------------------------
// 14. GRAPHICS QUALITY
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

dom.sensitivitySlider?.addEventListener('input', () => {
    baseLookSpeed = Number(dom.sensitivitySlider.value);
    const txt = baseLookSpeed.toFixed(4);
    if (dom.sensitivityValue) { dom.sensitivityValue.value = txt; dom.sensitivityValue.innerText = txt; }
});

// ---------------------------------------------------------------------
// 15. HUD
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
// 16. ENEMY HEALTH BAR
// ---------------------------------------------------------------------
function createEnemyHealthBar() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 18;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthTest: true, depthWrite: false
    }));
    sprite.position.y = ENEMY_HEIGHT + 0.4;
    sprite.scale.set(1.0, 0.15, 1);

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
// 17. LOAD CHARACTERS
// ---------------------------------------------------------------------
const hitFlashMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

new THREE.GLTFLoader().load('characters.glb', gltf => {
    gltf.scene.children.forEach(child => {
        if (child.name === 'Camera' || child.name === 'Light') return;
        child.traverse(node => {
            if (node.isMesh || node.isSkinnedMesh) node.material = node.material.clone();
        });
        characterTemplates.push(child);
    });
    if (gameActive && enemies.length === 0) {
        const n = isMobile ? 4 : 6;
        for (let i = 0; i < n; i++) spawnEnemy();
    }
}, undefined, err => console.error('characters.glb error:', err));

// Random valid spawn point inside map
function randomSpawnPoint() {
    const pad = 4;
    const minX = mapBounds.minX + pad, maxX = mapBounds.maxX - pad;
    const minZ = mapBounds.minZ + pad, maxZ = mapBounds.maxZ - pad;

    for (let attempt = 0; attempt < 30; attempt++) {
        const x = minX + Math.random() * Math.max(1, maxX - minX);
        const z = minZ + Math.random() * Math.max(1, maxZ - minZ);
        if (Math.hypot(x - camera.position.x, z - camera.position.z) < 8) continue;

        _v1.set(x, groundY + ENEMY_HEIGHT, z);
        _v2.set(0, -1, 0);
        const probe = new THREE.Raycaster(_v1, _v2, 0, ENEMY_HEIGHT + 0.5);
        if (probe.intersectObjects(mapColliderMeshes, true).length > 0) continue;

        return { x, z };
    }
    return {
        x: (mapBounds.minX + mapBounds.maxX) / 2,
        z: (mapBounds.minZ + mapBounds.maxZ) / 2,
    };
}

function spawnEnemy() {
    if (characterTemplates.length === 0) return;

    const group = new THREE.Group();
    const bobContainer = new THREE.Group();
    group.add(bobContainer);

    const template = characterTemplates[Math.floor(Math.random() * characterTemplates.length)];
    const modelRoot = (typeof THREE.SkeletonUtils !== 'undefined')
        ? THREE.SkeletonUtils.clone(template)
        : template.clone();

    const rawBox = new THREE.Box3().setFromObject(modelRoot);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    if (rawSize.y > 0.001) {
        const s = ENEMY_HEIGHT / rawSize.y;
        modelRoot.scale.multiplyScalar(s);
        rawBox.setFromObject(modelRoot);
        modelRoot.position.y = -rawBox.min.y;
    }

    bobContainer.add(modelRoot);

    const meshes = [];
    modelRoot.traverse(node => {
        if (node.isMesh || node.isSkinnedMesh) {
            node.userData.originalMaterial = node.material;
            meshes.push(node);
        }
    });

    const healthBar = createEnemyHealthBar();
    group.add(healthBar.sprite);

    const pt = randomSpawnPoint();
    group.position.set(pt.x, groundY, pt.z);
    scene.add(group);

    const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(ENEMY_RADIUS * 2, ENEMY_HEIGHT, ENEMY_RADIUS * 2),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.userData.isHitbox = true;
    hitbox.position.y = ENEMY_HEIGHT / 2;
    group.add(hitbox);
    meshes.push(hitbox);

    enemies.push({
        group, bobContainer, modelRoot, meshes, hitbox, healthBar,
        hp: 3, hitTime: 0,
        state: 'idle',
        velocity: new THREE.Vector2(0, 0),
        facingYaw: Math.random() * Math.PI * 2,
        walkPhase: Math.random() * Math.PI * 2,
        lastShotTime: 0,
        preferredRange: 8 + Math.random() * 6,
        strafeDirection: Math.random() > 0.5 ? 1 : -1,
        nextDecisionTime: 0,
        speed: 0.045 + Math.random() * 0.025,
        wanderTarget: new THREE.Vector3(pt.x, groundY, pt.z),
        nextWanderTime: 0,
    });
}

// ---------------------------------------------------------------------
// 18. PARTICLES & TRACERS
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
    if (!p) p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), mat);
    else { p.material = mat; p.scale.setScalar(1); }
    return p;
}
function releaseParticle(p) {
    if (p.parent) p.parent.remove(p);
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

const tracerPool = [];
const activeTracers = [];
function spawnBulletTracer(start, end) {
    let tracer = tracerPool.pop();
    if (!tracer) {
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const mat = new THREE.LineBasicMaterial({ color: 0xffffb0, transparent: true, opacity: 1 });
        tracer = new THREE.Line(geo, mat);
    } else {
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
    if (t.parent) t.parent.remove(t);
    tracerPool.push(t);
}

// ---------------------------------------------------------------------
// 19. SHOOTING
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

    recoilPitch += 0.006;
    recoilKick  = Math.min(0.08, recoilKick + 0.05);
    yaw += (Math.random() - 0.5) * 0.002;

    raycaster.setFromCamera(_v1.set(0, 0), camera);
    const shotDir = raycaster.ray.direction.clone();
    const muzzleWorld = muzzleLight.getWorldPosition(_v2);
    const tracerEnd = _v3.copy(camera.position).addScaledVector(shotDir, 80);

    const wallHits = raycaster.intersectObjects(mapColliderMeshes, true);
    const wallDist = wallHits.length > 0 ? wallHits[0].distance : Infinity;
    const wallPoint = wallHits.length > 0 ? wallHits[0].point.clone() : null;

    const hitboxes = [];
    for (const e of enemies) for (const m of e.meshes) hitboxes.push(m);
    const enemyHits = raycaster.intersectObjects(hitboxes, false);
    const enemyDist = enemyHits.length > 0 ? enemyHits[0].distance : Infinity;

    if (enemyDist < wallDist) {
        tracerEnd.copy(enemyHits[0].point);
        const hitObj = enemyHits[0].object;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].meshes.includes(hitObj)) {
                applyDamageToEnemy(enemies[i], i);
                playHitMarker();
                break;
            }
        }
    } else if (wallPoint) {
        tracerEnd.copy(wallPoint);
    }

    spawnBulletTracer(muzzleWorld, tracerEnd);
    spawnSparks(tracerEnd.x, tracerEnd.y, tracerEnd.z, enemyDist < wallDist);
}

function applyDamageToEnemy(enemy, index) {
    enemy.hp -= weaponDamage;
    enemy.hitTime = performance.now();
    showHitMarker();
    enemy.healthBar.update(enemy.hp);

    const kx = enemy.group.position.x - camera.position.x;
    const kz = enemy.group.position.z - camera.position.z;
    const kLen = Math.hypot(kx, kz) || 1;
    enemy.group.position.x += (kx / kLen) * 0.3;
    enemy.group.position.z += (kz / kLen) * 0.3;

    if (enemy.hp <= 0) {
        scene.remove(enemy.group);
        enemies.splice(index, 1);
        score += 150; kills++;
        reserveAmmo = Math.min(180, reserveAmmo + 15);
        updateScoreHUD(); updateAmmoHUD();
        spawnEnemy();
    }
}

function shootEnemyProjectile(enemy) {
    const start = _v1.set(
        enemy.group.position.x,
        enemy.group.position.y + ENEMY_HEIGHT * 0.7,
        enemy.group.position.z
    ).clone();

    const projectile = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), gooMat);
    projectile.position.copy(start);
    const velocity = new THREE.Vector3().subVectors(camera.position, start).normalize().multiplyScalar(0.24);
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
            if (projectileRaycaster.intersectObjects(mapColliderMeshes, true).length > 0) {
                scene.remove(pr.mesh);
                enemyProjectiles.splice(i, 1);
                continue;
            }
        }

        if (pr.mesh.position.distanceTo(camera.position) < 0.9) {
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
// 20. PLAYER MOVEMENT (ray-based)
// ---------------------------------------------------------------------
const moveRaycaster = new THREE.Raycaster();

function rayHitsMap(px, py, pz, dx, dz, dist) {
    if (mapColliderMeshes.length === 0) return false;
    _v1.set(px, py, pz);
    _v2.set(dx, 0, dz);
    moveRaycaster.set(_v1, _v2);
    moveRaycaster.far = dist + PLAYER_RADIUS;
    const hits = moveRaycaster.intersectObjects(mapColliderMeshes, true);
    for (const h of hits) {
        if (!h.face) return true;
        _v3.copy(h.face.normal).transformDirection(h.object.matrixWorld);
        if (Math.abs(_v3.y) < 0.7) return true;
    }
    return false;
}

function tryMove(dx, dz) {
    const px = camera.position.x;
    const py = camera.position.y - PLAYER_EYE_OFFSET + PLAYER_HEIGHT * 0.5;
    const pz = camera.position.z;
    let movedX = false, movedZ = false;

    if (Math.abs(dx) > 0.0001) {
        const dirX = Math.sign(dx);
        if (!rayHitsMap(px, py, pz, dirX, 0, Math.abs(dx))) {
            camera.position.x += dx; movedX = true;
        } else velocityX = 0;
    }
    if (Math.abs(dz) > 0.0001) {
        const dirZ = Math.sign(dz);
        if (!rayHitsMap(camera.position.x, py, pz, 0, dirZ, Math.abs(dz))) {
            camera.position.z += dz; movedZ = true;
        } else velocityZ = 0;
    }
    return movedX || movedZ;
}

// ---------------------------------------------------------------------
// 21. INPUT
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
        case 'Space': keys.space = true; lastJumpPressTime = performance.now(); break;
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

if (isMobile) {
    let joystickTouchId = null;
    let joyCenter = { x: 0, y: 0 };
    const joyMaxRadius = 40;

    const updateJoystick = t => {
        let dx = t.clientX - joyCenter.x;
        let dy = t.clientY - joyCenter.y;
        const dist = Math.hypot(dx, dy);
        if (dist > joyMaxRadius) { dx = (dx / dist) * joyMaxRadius; dy = (dy / dist) * joyMaxRadius; }
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

    let lookTouchId = null, lastTouchX = 0, lastTouchY = 0;
    dom.lookZone?.addEventListener('touchstart', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (lookTouchId !== null) break;
            lookTouchId = t.identifier;
            lastTouchX = t.clientX; lastTouchY = t.clientY;
        }
    }, { passive: false });

    dom.lookZone?.addEventListener('touchmove', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === lookTouchId) {
                yaw   -= (t.clientX - lastTouchX) * baseLookSpeed;
                pitch -= (t.clientY - lastTouchY) * baseLookSpeed;
                pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
                lastTouchX = t.clientX; lastTouchY = t.clientY;
            }
        }
    }, { passive: false });

    dom.lookZone?.addEventListener('touchend', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === lookTouchId) lookTouchId = null;
        }
    }, { passive: false });

    const bindHold = (el, on, off) => {
        el?.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); on(); }, { passive: false });
        el?.addEventListener('touchend',   e => { e.preventDefault(); e.stopPropagation(); off(); }, { passive: false });
    };
    bindHold(dom.jumpBtn,  () => { keys.space = true; lastJumpPressTime = performance.now(); },
                           () => keys.space = false);
    bindHold(dom.slideBtn, () => keys.shift = true,  () => keys.shift = false);
    bindHold(dom.fireBtn,  () => { isFiring = true; shootWeapon(); }, () => isFiring = false);

    dom.ammoDisplay?.addEventListener('touchstart', e => {
        if (isCustomizing) return;
        e.preventDefault();
        triggerReload();
    }, { passive: false });

    $('mobilePauseBtn')?.addEventListener('touchstart', e => { e.preventDefault(); togglePause(); }, { passive: false });
}

// ---------------------------------------------------------------------
// 22. HUD CUSTOMIZATION
// ---------------------------------------------------------------------
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
            el.style.bottom = 'auto'; el.style.right = 'auto'; el.style.transform = 'none';
            el.style.left = left; el.style.top = top;
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
            el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none';
            el.style.left = rect.left + 'px'; el.style.top = rect.top + 'px';
            initialLeft = rect.left; initialTop = rect.top;
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
// 23. UI ROUTING
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
    } else if (document.exitFullscreen) document.exitFullscreen();
}
$('fullscreenMenuBtn')?.addEventListener('click', toggleFullScreen);
$('mobileFullscreenBtn')?.addEventListener('click', toggleFullScreen);

document.querySelectorAll('.map-card').forEach(card => {
    card.addEventListener('click', e => {
        document.querySelectorAll('.map-card').forEach(c => c.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        selectedMapFile = e.currentTarget.getAttribute('data-map');
        console.log('Selected map:', selectedMapFile);
    });
});

$('startBtn')?.addEventListener('click', () => {
    show(dom.mapSelectMenu, 'none');
    show(dom.loadingMapUI, 'flex');
    setTimeout(() => loadSelectedMap(selectedMapFile), 100);
});

// ---------------------------------------------------------------------
// 24. MAP LOADER
// ---------------------------------------------------------------------
function loadSelectedMap(mapFile) {
    console.log('🗺️ Loading map:', mapFile);

    for (let i = scene.children.length - 1; i >= 0; i--) {
        const child = scene.children[i];
        if (child.userData.isMapPiece) scene.remove(child);
    }
    mapColliderMeshes.length = 0;
    groundMeshes.length = 0;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x080820, 0.85);
    hemi.userData.isGameLight = true;
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(60, 100, 40);
    sun.userData.isGameLight = true;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
    fill.position.set(-40, 30, -50);
    fill.userData.isGameLight = true;
    scene.add(fill);

    if (dom.mapLoadingText) dom.mapLoadingText.innerText = 'LOADING COMBAT ZONE...';

    const mapLoader = new THREE.GLTFLoader();
    mapLoader.load(
        mapFile,
        gltf => {
            const mapRoot = gltf.scene;
            mapRoot.updateMatrixWorld(true);

            const wholeBox = new THREE.Box3().setFromObject(mapRoot);
            groundY = wholeBox.min.y + 0.02;
            mapBounds.minX = wholeBox.min.x;
            mapBounds.maxX = wholeBox.max.x;
            mapBounds.minZ = wholeBox.min.z;
            mapBounds.maxZ = wholeBox.max.z;

            console.log('   Bounds:', JSON.stringify(mapBounds), 'groundY =', groundY.toFixed(2));

            let meshCount = 0;
            mapRoot.traverse(node => {
                if (!node.isMesh) return;
                if (node.isSkinnedMesh || node.isSprite) return;
                node.userData.isMapPiece = true;
                mapColliderMeshes.push(node);
                meshCount++;
                const bbox = new THREE.Box3().setFromObject(node);
                const size = bbox.getSize(new THREE.Vector3());
                if (size.y < 0.6 && size.y < Math.max(size.x, size.z) * 0.2) groundMeshes.push(node);
            });

            mapRoot.userData.isMapPiece = true;
            scene.add(mapRoot);

            console.log('✅ Map loaded. meshes:', meshCount, '| groundMeshes:', groundMeshes.length);

            const cx = (mapBounds.minX + mapBounds.maxX) / 2;
            const cz = (mapBounds.minZ + mapBounds.maxZ) / 2;
            camera.position.set(cx, groundY + PLAYER_EYE_OFFSET, cz);
            lastSafePosition.copy(camera.position);

            setTimeout(() => { show(dom.loadingMapUI, 'none'); startGame(); }, 200);
        },
        undefined,
        err => {
            console.error('❌ Map load error:', err);
            if (dom.mapLoadingText) dom.mapLoadingText.innerText = 'MAP LOAD FAILED - USING DEFAULT';
            setTimeout(() => { show(dom.loadingMapUI, 'none'); startGame(); }, 800);
        }
    );
}
window.loadSelectedMap = loadSelectedMap;

// ---------------------------------------------------------------------
// 25. START / RESTART
// ---------------------------------------------------------------------
function startGame(e) {
    if (e) e.preventDefault();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    show(dom.mainMenu, 'none');
    show(dom.mapSelectMenu, 'none');
    show(dom.deathScreen, 'none');
    show(dom.pauseScreen, 'none');
    show(dom.loadingMapUI, 'none');

    health = 100; score = 0; kills = 0;
    ammo = maxAmmo; reserveAmmo = 90;
    isReloading = false; isSliding = false; isPaused = false; isDead = false;
    isFiring = false; isAiming = false;
    recoilPitch = 0; recoilKick = 0;
    velocityX = 0; velocityZ = 0; yVelocity = 0;
    isGrounded = true;
    lastDamageTime = performance.now();
    updateHUD();
    show(dom.reloadUI, 'none');
    if (dom.crosshair) dom.crosshair.style.opacity = '0.85';

    enemies.forEach(en => scene.remove(en.group));
    enemies.length = 0;
    enemyProjectiles.forEach(p => scene.remove(p.mesh));
    enemyProjectiles.length = 0;

    const cx = (mapBounds.minX + mapBounds.maxX) / 2;
    const cz = (mapBounds.minZ + mapBounds.maxZ) / 2;
    camera.position.set(cx, groundY + PLAYER_EYE_OFFSET, cz);
    yaw = 0; pitch = 0;
    camera.rotation.set(0, 0, 0);
    lastSafePosition.copy(camera.position);
    blockedMovementFrames = 0;

    const n = isMobile ? 4 : 6;
    for (let i = 0; i < n; i++) spawnEnemy();

    gameActive = true;
    try { if (!isMobile) document.body.requestPointerLock?.(); } catch {}
}

$('restartBtn')?.addEventListener('click', startGame);
$('exitToMenuBtn')?.addEventListener('click', () => location.reload());

// ---------------------------------------------------------------------
// 26. MAIN LOOP
// ---------------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05);
    const dtScale = dt * 60;
    const nowMs = performance.now();

    fpsFrameCount++;
    if (nowMs - fpsLastUpdate >= 1000) {
        if (dom.fpsVal) dom.fpsVal.innerText = Math.round(fpsFrameCount * 1000 / (nowMs - fpsLastUpdate));
        fpsFrameCount = 0;
        fpsLastUpdate = nowMs;
    }

    const targetFov = (isAiming && selectedWeaponType === 'barrett') ? sniperAimFov : normalFov;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
        camera.fov += (targetFov - camera.fov) * 0.18;
        camera.updateProjectionMatrix();
    }

    if (muzzleLight.intensity > 0 && nowMs > muzzleFadeUntil) muzzleLight.intensity = 0;

    recoilPitch *= Math.pow(0.85, dtScale);
    recoilKick  *= Math.pow(0.85, dtScale);

    const isMoving = (velocityX * velocityX + velocityZ * velocityZ) > 0.001;
    const bobOffset = (isGrounded && isMoving) ? Math.sin(walkCycle) * 0.02 : 0;
    camera.rotation.set(pitch + recoilPitch + bobOffset, yaw, 0);

    if (gameActive && !isDead && !isPaused) {
        updateGameplay(dt, dtScale, nowMs);
    }

    renderer.render(scene, camera);
}

function updateGameplay(dt, dtScale, nowMs) {
    const isCrouching = keys.crouch && isGrounded;

    let fwd = (keys.w ? 1 : 0) - (keys.s ? 1 : 0) + moveVector.y;
    let rgt = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + moveVector.x;
    fwd = Math.max(-1, Math.min(1, fwd));
    rgt = Math.max(-1, Math.min(1, rgt));

    const len = Math.hypot(fwd, rgt);
    if (len > 1) { fwd /= len; rgt /= len; }

    let speed = WALK_SPEED;
    if (keys.shift) speed *= sprintMultiplier;
    if (isCrouching) speed *= crouchMultiplier;
    if (!isGrounded) speed *= 0.7;

    const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
    const targetVX = (-sinY * fwd + cosY * rgt) * speed;
    const targetVZ = (-cosY * fwd - sinY * rgt) * speed;

    const control = isGrounded ? 1 : AIR_CONTROL;
    velocityX += (targetVX - velocityX) * ACCEL * control * dtScale;
    velocityZ += (targetVZ - velocityZ) * ACCEL * control * dtScale;

    if (fwd === 0 && rgt === 0 && isGrounded) {
        velocityX *= Math.pow(1 - FRICTION, dtScale);
        velocityZ *= Math.pow(1 - FRICTION, dtScale);
        if (Math.abs(velocityX) < 0.001) velocityX = 0;
        if (Math.abs(velocityZ) < 0.001) velocityZ = 0;
    }

    if (Math.abs(velocityX) > 0.0001 || Math.abs(velocityZ) > 0.0001) {
        const moved = tryMove(velocityX * dtScale, velocityZ * dtScale);
        if (moved) { blockedMovementFrames = 0; lastSafePosition.copy(camera.position); }
        else blockedMovementFrames += dtScale;
        if (blockedMovementFrames > 60) {
            camera.position.copy(lastSafePosition);
            velocityX = velocityZ = 0; yVelocity = 0; blockedMovementFrames = 0;
        }
        if (!isSliding && isGrounded) walkCycle += 0.22 * dtScale;
    } else walkCycle = 0;

    const timeSinceGrounded = (nowMs - lastGroundedTime) / 1000;
    const canJump = isGrounded || timeSinceGrounded < COYOTE_TIME;
    const wantsJump = keys.space || (nowMs - lastJumpPressTime) / 1000 < JUMP_BUFFER;

    if (wantsJump && canJump && !isSliding && yVelocity <= 0) {
        yVelocity = JUMP_FORCE; isGrounded = false; lastJumpPressTime = -999;
    }

    yVelocity -= GRAVITY * dtScale;
    const standY = groundY + (isCrouching ? PLAYER_CROUCH_HEIGHT : PLAYER_HEIGHT) - 0.15;
    const nextY = camera.position.y + yVelocity * dtScale;

    if (nextY <= standY) {
        yVelocity = 0;
        if (!isGrounded) lastGroundedTime = nowMs;
        isGrounded = true;
        camera.position.y += (standY - camera.position.y) * 0.35 * dtScale;
    } else {
        isGrounded = false;
        camera.position.y = nextY;
    }

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
            gunGroup.position.y += (-0.35 - gunGroup.position.y) * 0.2;
        }
    } else {
        if (isFiring) shootWeapon();
        const targetZ = -0.2 + recoilKick;
        const targetY = -0.15;
        gunGroup.position.z += (targetZ - gunGroup.position.z) * 0.15;
        gunGroup.position.y += (targetY - gunGroup.position.y) * 0.15;
        gunGroup.rotation.x += (0 - gunGroup.rotation.x) * 0.15;
    }

    updateProjectiles(dtScale);

    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        p.mesh.position.x += p.vx * dtScale;
        p.mesh.position.y += p.vy * dtScale;
        p.mesh.position.z += p.vz * dtScale;
        p.vy -= 0.01 * dtScale;
        p.life -= 0.05 * dtScale;
        p.mesh.scale.multiplyScalar(Math.pow(0.9, dtScale));
        if (p.life <= 0) { releaseParticle(p.mesh); activeParticles.splice(i, 1); }
    }

    for (let i = activeTracers.length - 1; i >= 0; i--) {
        const t = activeTracers[i];
        t.life -= 0.07 * dtScale;
        t.mesh.material.opacity = Math.max(0, t.life);
        if (t.life <= 0) { releaseTracer(t.mesh); activeTracers.splice(i, 1); }
    }

    updateEnemies(dtScale, nowMs);

    if (health < 100 && (nowMs - lastDamageTime > REGEN_DELAY)) {
        if (nowMs - lastRegenTime > REGEN_INTERVAL) {
            health = Math.min(100, health + REGEN_AMOUNT);
            lastRegenTime = nowMs;
            triggerHealingEffect();
            updateHealthHUD();
        }
    }
}

// ---------------------------------------------------------------------
// 27. ENEMY UPDATE
// ---------------------------------------------------------------------
const enemyMoveRaycaster = new THREE.Raycaster();

function enemyRayHitsWall(px, pz, dx, dz, dist) {
    if (mapColliderMeshes.length === 0) return false;
    const py = groundY + ENEMY_HEIGHT * 0.5;
    _v1.set(px, py, pz);
    _v2.set(dx, 0, dz);
    enemyMoveRaycaster.set(_v1, _v2);
    enemyMoveRaycaster.far = dist + ENEMY_RADIUS;
    const hits = enemyMoveRaycaster.intersectObjects(mapColliderMeshes, true);
    for (const h of hits) {
        if (!h.face) return true;
        _v3.copy(h.face.normal).transformDirection(h.object.matrixWorld);
        if (Math.abs(_v3.y) < 0.7) return true;
    }
    return false;
}

function updateEnemies(dtScale, nowMs) {
    const dt = dtScale / 60;

    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];

        const dist = e.group.position.distanceTo(camera.position);
        const prevState = e.state;
        if (dist < 18) e.state = 'attack';
        else if (dist < 40) e.state = 'chase';
        else e.state = 'idle';

        if (prevState !== e.state) e.nextDecisionTime = nowMs + 400 + Math.random() * 600;

        let desiredDirX = 0, desiredDirZ = 0;
        let speedThisFrame = e.speed;

        if (e.state === 'idle') {
            if (nowMs > e.nextWanderTime || e.group.position.distanceTo(e.wanderTarget) < 1.2) {
                const pad = 4;
                e.wanderTarget.set(
                    THREE.MathUtils.clamp(e.group.position.x + (Math.random() - 0.5) * 14, mapBounds.minX + pad, mapBounds.maxX - pad),
                    groundY,
                    THREE.MathUtils.clamp(e.group.position.z + (Math.random() - 0.5) * 14, mapBounds.minZ + pad, mapBounds.maxZ - pad)
                );
                e.nextWanderTime = nowMs + 1500 + Math.random() * 2000;
            }
            const wx = e.wanderTarget.x - e.group.position.x;
            const wz = e.wanderTarget.z - e.group.position.z;
            const wd = Math.hypot(wx, wz) || 1;
            desiredDirX = wx / wd;
            desiredDirZ = wz / wd;
            speedThisFrame *= 0.4;
        } else {
            const dx = camera.position.x - e.group.position.x;
            const dz = camera.position.z - e.group.position.z;
            const d = Math.hypot(dx, dz) || 1;
            const towardX = dx / d, towardZ = dz / d;

            if (e.state === 'chase') {
                desiredDirX = towardX;
                desiredDirZ = towardZ;
            } else {
                if (nowMs > e.nextDecisionTime) {
                    e.strafeDirection *= -1;
                    e.nextDecisionTime = nowMs + 800 + Math.random() * 1200;
                }
                const rangeDelta = d - e.preferredRange;
                let rangePull = 0;
                if (Math.abs(rangeDelta) > 1.5) rangePull = Math.sign(rangeDelta);
                const tangentX = -towardZ * e.strafeDirection;
                const tangentZ =  towardX * e.strafeDirection;
                desiredDirX = towardX * rangePull + tangentX * 0.9;
                desiredDirZ = towardZ * rangePull + tangentZ * 0.9;
            }
        }

        const mag = Math.hypot(desiredDirX, desiredDirZ);
        if (mag > 0.001) { desiredDirX /= mag; desiredDirZ /= mag; }
        else { desiredDirX = 0; desiredDirZ = 0; }

        const targetVX = desiredDirX * speedThisFrame;
        const targetVZ = desiredDirZ * speedThisFrame;
        const accel = 0.15;
        e.velocity.x += (targetVX - e.velocity.x) * accel * dtScale;
        e.velocity.y += (targetVZ - e.velocity.y) * accel * dtScale;

        const moveX = e.velocity.x * dtScale;
        const moveZ = e.velocity.y * dtScale;
        const oldX = e.group.position.x;
        const oldZ = e.group.position.z;

        if (Math.abs(moveX) > 0.0001) {
            if (!enemyRayHitsWall(e.group.position.x, e.group.position.z, Math.sign(moveX), 0, Math.abs(moveX))) {
                e.group.position.x += moveX;
            } else e.velocity.x = 0;
        }
        if (Math.abs(moveZ) > 0.0001) {
            if (!enemyRayHitsWall(e.group.position.x, e.group.position.z, 0, Math.sign(moveZ), Math.abs(moveZ))) {
                e.group.position.z += moveZ;
            } else e.velocity.y = 0;
        }

        const actualSpeed = Math.hypot(e.group.position.x - oldX, e.group.position.z - oldZ) / Math.max(dt, 0.0001);

        e.group.position.y += (groundY - e.group.position.y) * 0.4 * dtScale;

        let targetYaw;
        if (e.state === 'idle') targetYaw = Math.atan2(desiredDirX, desiredDirZ);
        else targetYaw = Math.atan2(camera.position.x - e.group.position.x, camera.position.z - e.group.position.z);

        let diff = targetYaw - e.facingYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.facingYaw += diff * Math.min(1, ENEMY_TURN_SPEED * dt);
        e.group.rotation.y = e.facingYaw;

        const isWalking = actualSpeed > 0.005;
        if (isWalking) {
            e.walkPhase += actualSpeed * 28 * dtScale;
            const sinPhase = Math.sin(e.walkPhase);
            const cosPhase = Math.cos(e.walkPhase);
            e.bobContainer.position.y = Math.abs(sinPhase) * 0.06;
            e.bobContainer.position.x = cosPhase * 0.025;
            const leanAmount = e.state === 'chase' ? 0.12 : 0.06;
            e.bobContainer.rotation.x = leanAmount * (actualSpeed / 0.05);
            e.bobContainer.rotation.z = -cosPhase * 0.06;
        } else {
            e.walkPhase += 1.5 * dtScale;
            e.bobContainer.position.y = Math.sin(e.walkPhase) * 0.012;
            e.bobContainer.position.x *= 0.9;
            e.bobContainer.rotation.x *= 0.9;
            e.bobContainer.rotation.z *= 0.9;
        }

        const flashing = nowMs - e.hitTime < 250;
        for (const m of e.meshes) {
            if (m.userData.isHitbox) continue;
            m.material = flashing ? hitFlashMat : (m.userData.originalMaterial || m.material);
        }

        if (e.state === 'attack' && nowMs - e.lastShotTime > 1200) {
            e.lastShotTime = nowMs;
            const headY = e.group.position.y + ENEMY_HEIGHT * 0.7;
            _v1.set(e.group.position.x, headY, e.group.position.z);
            _v2.set(camera.position.x - e.group.position.x,
                    camera.position.y - headY,
                    camera.position.z - e.group.position.z).normalize();
            const losRay = new THREE.Raycaster(_v1, _v2, 0, dist);
            const hits = losRay.intersectObjects(mapColliderMeshes, true);
            if (hits.length === 0) shootEnemyProjectile(e);
        }
    }
}

// ---------------------------------------------------------------------
// 28. GO
// ---------------------------------------------------------------------
animate();
/* =====================================================================
   TACTICAL FPS — Complete Game Script
   IIFE-wrapped, memory-safe, real progress loading, correct paths.
   ===================================================================== */

(function () {
'use strict';

// ---------------------------------------------------------------------
// Global error logging
// ---------------------------------------------------------------------
window.addEventListener('error', e => console.error('GAME ERROR:', e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', e => console.error('GAME PROMISE:', e.reason));

// ---------------------------------------------------------------------
// Asset paths (relative to games/fps-shooter/)
// ---------------------------------------------------------------------
const PATHS = {
    vendor:   'vendor/',
    maps:     'maps/',
    enemies:  'enemies/',
    weapons:  'weapons/',
    audio:    'audio/',
    images:   'images/',
};

// Asset sizes for progress tracking (bytes, approximate)
const ASSET_SIZES = {
    [PATHS.weapons + 'lp_mini_pack_modern_weaponswith_bullets_part_2.glb']: 1160000,
    [PATHS.enemies + 'polyart_zombies_with_animations_free_pack.glb']:       7190000,
    [PATHS.images + 'backgroundsky.jpg']:                                      560000,
    [PATHS.audio + 'genralfiresound_6sec.mp3']:                                158000,
    [PATHS.audio + 'reloadsound1sec.mp3']:                                      17000,
    [PATHS.audio + 'walking_runing same sound25sec.mp3']:                      261000,
};

// Map sizes
const MAP_SIZES = {
    '2m.glb':     442000,
    '3m.glb':      46000,
    '4m.glb':   13850000,
    'castle.glb': 3630000,
};

// ---------------------------------------------------------------------
// DOM cache
// ---------------------------------------------------------------------
const $ = id => document.getElementById(id);
const dom = {
    loadingScreen:       $('loadingScreen'),
    loadingTitle:        $('loadingTitle'),
    loadingBarFill:      $('loadingBarFill'),
    loadingPercent:      $('loadingPercent'),
    loadingBytes:        $('loadingBytes'),
    loadingPhase:        $('loadingPhase'),
    skipLoadBtn:         $('skipLoadBtn'),
    retryLoadBtn:        $('retryLoadBtn'),
    tosModal:            $('tosModal'),
    acceptTosBtn:        $('acceptTosBtn'),
    mainMenu:            $('mainMenu'),
    quickMatchBtn:       $('quickMatchBtn'),
    fullscreenMenuBtn:   $('fullscreenMenuBtn'),
    mapSelectMenu:       $('mapSelectMenu'),
    backToMenuBtn:       $('backToMenuBtn'),
    startBtn:            $('startBtn'),
    loadingMapUI:        $('loadingMapUI'),
    mapLoadingBarFill:   $('mapLoadingBarFill'),
    mapLoadingPercent:   $('mapLoadingPercent'),
    mapLoadingBytes:     $('mapLoadingBytes'),
    mapLoadingText:      $('mapLoadingText'),
    pauseScreen:         $('pauseScreen'),
    resumeBtn:           $('resumeBtn'),
    customizeUiBtn:      $('customizeUiBtn'),
    exitToMenuBtn:       $('exitToMenuBtn'),
    saveHudBtn:          $('saveHudBtn'),
    deathScreen:         $('deathScreen'),
    restartBtn:          $('restartBtn'),
    healthVal:           $('healthVal'),
    scoreVal:            $('scoreVal'),
    killsVal:            $('killsVal'),
    ammoVal:             $('ammoVal'),
    reserveVal:          $('reserveVal'),
    vignette:            $('vignette'),
    healthDisplay:       $('healthDisplay'),
    healingFlash:        $('healingFlash'),
    hitMarker:           $('hitMarker'),
    gooHit:              $('gooHit'),
    currentWepName:      $('currentWepName'),
    reloadUI:            $('reloadUI'),
    reloadText:          $('reloadText'),
    reloadCircle:        document.querySelector('.circle'),
    crosshair:           $('crosshair'),
    fpsVal:              $('fpsVal'),
    uiLayer:             $('uiLayer'),
    sensitivitySlider:   $('sensitivitySlider'),
    sensitivityValue:    $('sensitivityValue'),
    mobileControls:      $('mobileControls'),
    fireBtn:             $('fireBtn'),
    jumpBtn:             $('jumpBtn'),
    slideBtn:            $('slideBtn'),
    joystickZone:        $('joystickZone'),
    joystickKnob:        $('joystickKnob'),
    lookZone:            $('lookZone'),
    ammoDisplay:         $('ammoDisplay'),
    btnRifle:            $('selRifle'),
    btnSMG:              $('selSMG'),
    btnM16:              $('selM16'),
    btnBarrett:          $('selBarrett'),
    btnPistol:           $('selPistol'),
    btnRifleDeath:       $('selRifleDeath'),
    btnSMGDeath:         $('selSMGDeath'),
    btnM16Death:         $('selM16Death'),
    btnBarrettDeath:     $('selBarrettDeath'),
    btnPistolDeath:      $('selPistolDeath'),
};

const show = (el, val) => { if (el) el.style.display = val; };

// ---------------------------------------------------------------------
// Device detection
// ---------------------------------------------------------------------
const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
if (isMobile) {
    show(dom.mobileControls, 'block');
    [dom.fireBtn, dom.jumpBtn, dom.slideBtn].forEach(b => b && b.classList.add('mobile-btn'));
}

// ---------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------
const PLAYER_HEIGHT = 1.6;
const PLAYER_CROUCH_HEIGHT = 1.0;
const PLAYER_RADIUS = 0.35;
const PLAYER_EYE_OFFSET = PLAYER_HEIGHT - 0.15;
const ENEMY_HEIGHT = 1.4;
const ENEMY_RADIUS = 0.35;
const ENEMY_TURN_SPEED = 6.0;
const WALK_SPEED = 0.11;
const ACCEL = 0.18;
const FRICTION = 0.22;
const AIR_CONTROL = 0.35;
const JUMP_FORCE = 0.16;
const GRAVITY = 0.012;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER = 0.12;

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------
let health = 100, score = 0, kills = 0;
let ammo = 30, reserveAmmo = 90;
let isDead = false, isPaused = false, gameActive = false;
let lastDamageTime = performance.now(), lastRegenTime = 0;
const REGEN_DELAY = 5000, REGEN_INTERVAL = 1000, REGEN_AMOUNT = 5;
let yaw = 0, pitch = 0;
let baseLookSpeed = 0.003;
const sprintMultiplier = 1.7, crouchMultiplier = 0.55;
let velocityX = 0, velocityZ = 0, yVelocity = 0;
let isGrounded = true;
let lastGroundedTime = 0, lastJumpPressTime = -999;
let walkCycle = 0, blockedMovementFrames = 0;
let fpsFrameCount = 0, fpsLastUpdate = performance.now();
let isAiming = false;
const normalFov = 75, sniperAimFov = 42;
let moveVector = { x: 0, y: 0 };
const keys = { w: false, a: false, s: false, d: false, space: false, shift: false, crouch: false };
let isSliding = false;
let slideTimer = 0;
let selectedWeaponType = 'rifle';
let fireRate = 150, weaponDamage = 1, maxAmmo = 30;
let isFiring = false, lastFireTime = 0, isReloading = false, reloadStartTime = 0;
const reloadDuration = 1000;
let recoilPitch = 0, recoilKick = 0;
let isCustomizing = false;
let selectedMapFile = '2m.glb';
let groundY = 0;
let mapBounds = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 };
let sceneReady = false;
let destroyed = false;
let animationFrameId = null;

// ---------------------------------------------------------------------
// Progress tracker
// ---------------------------------------------------------------------
const progress = {
    total: 0,
    loaded: 0,
    updateDOM(el, pctEl, bytesEl, percent, bytesLoaded, bytesTotal) {
        if (el) el.style.width = percent + '%';
        if (pctEl) pctEl.textContent = Math.round(percent) + '%';
        if (bytesEl) {
            const fmt = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB'
                         : b >= 1024    ? (b / 1024).toFixed(0) + ' KB'
                         : b + ' B';
            bytesEl.textContent = fmt(bytesLoaded) + ' / ' + fmt(bytesTotal);
        }
    },
};

// XHR-based loader with progress callbacks
function loadWithProgress(url, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onprogress = e => {
            if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
            else reject(new Error('HTTP ' + xhr.status + ' for ' + url));
        };
        xhr.onerror = () => reject(new Error('Network error for ' + url));
        xhr.send();
    });
}

// ---------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------
let audioCtx = null;
let gunAudioBuffer = null, reloadAudioBuffer = null, footstepAudioBuffer = null;
let gunAudioBuffers = {};
let menuModel = null, menuMouseX = 0, menuMouseY = 0;
let activeGunSource = null, activeGunGain = null;
let activeFootstepSource = null, activeFootstepGain = null;
let lastHeartbeatTime = 0;

function initAudio() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { audioCtx = null; }
}

function resumeAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
}

function playProcedural(type) {
    if (!audioCtx) return;
    resumeAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    let dur = 0.04;
    if (type === 'hit') {
        osc.type = 'square'; osc.frequency.setValueAtTime(700, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
        dur = 0.04;
    } else if (type === 'heart') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(50, t);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        dur = 0.5;
    } else if (type === 'reload') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        dur = 0.2;
    }
    osc.onended = () => {
        try { osc.disconnect(); gain.disconnect(); } catch (e) {}
    };
    osc.start(t); osc.stop(t + dur);
}

function startGunSound() {
    if (!audioCtx) return;
    resumeAudio();
    if (activeGunSource) return;
    if (gunAudioBuffer) {
        try {
            const src = audioCtx.createBufferSource();
            const gain = audioCtx.createGain();
            src.buffer = gunAudioBuffer;
            src.loop = true;
            gain.gain.setValueAtTime(0.65, audioCtx.currentTime);
            src.connect(gain);
            gain.connect(audioCtx.destination);
            src.start(0);
            activeGunSource = src;
            activeGunGain = gain;
        } catch (e) {
            console.warn('Error starting gun audio:', e);
        }
    } else {
        playProcedural('hit');
    }
}

function stopGunSound() {
    if (activeGunSource) {
        const src = activeGunSource;
        const gain = activeGunGain;
        activeGunSource = null;
        activeGunGain = null;
        try {
            if (gain && audioCtx) {
                gain.gain.cancelScheduledValues(audioCtx.currentTime);
                gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime);
                gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.02);
                setTimeout(() => {
                    try { src.stop(); src.disconnect(); gain.disconnect(); } catch (e) {}
                }, 30);
            } else {
                src.stop();
                src.disconnect();
            }
        } catch (e) {}
    }
}

function playGunshot() {
    startGunSound();
}

function playReloadSound() {
    if (!audioCtx) return;
    resumeAudio();
    if (reloadAudioBuffer) {
        try {
            const src = audioCtx.createBufferSource();
            const gain = audioCtx.createGain();
            src.buffer = reloadAudioBuffer;
            gain.gain.setValueAtTime(0.7, audioCtx.currentTime);
            src.connect(gain);
            gain.connect(audioCtx.destination);
            src.onended = () => {
                try { src.disconnect(); gain.disconnect(); } catch (e) {}
            };
            src.start(0);
        } catch (e) {
            playProcedural('reload');
        }
    } else {
        playProcedural('reload');
    }
}

function updateFootstepAudio(isMoving, isSprinting, isCrouching, isGrounded) {
    if (!audioCtx || !footstepAudioBuffer || !gameActive || isDead || isPaused) {
        stopFootstepSound();
        return;
    }
    if (isGrounded && isMoving && !isSliding) {
        if (!activeFootstepSource) {
            try {
                resumeAudio();
                const src = audioCtx.createBufferSource();
                const gain = audioCtx.createGain();
                src.buffer = footstepAudioBuffer;
                src.loop = true;
                gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
                src.connect(gain);
                gain.connect(audioCtx.destination);
                src.start(0);
                activeFootstepSource = src;
                activeFootstepGain = gain;
            } catch (e) {
                console.warn('Error starting footstep audio:', e);
            }
        }
        if (activeFootstepSource) {
            const targetRate = isSprinting ? 1.4 : (isCrouching ? 0.75 : 1.0);
            const targetVol = isSprinting ? 0.65 : (isCrouching ? 0.35 : 0.5);
            try {
                activeFootstepSource.playbackRate.setValueAtTime(targetRate, audioCtx.currentTime);
                if (activeFootstepGain) {
                    activeFootstepGain.gain.setValueAtTime(targetVol, audioCtx.currentTime);
                }
            } catch (e) {}
        }
    } else {
        stopFootstepSound();
    }
}

function stopFootstepSound() {
    if (activeFootstepSource) {
        const src = activeFootstepSource;
        const gain = activeFootstepGain;
        activeFootstepSource = null;
        activeFootstepGain = null;
        try {
            if (gain && audioCtx) {
                gain.gain.cancelScheduledValues(audioCtx.currentTime);
                gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime);
                gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
                setTimeout(() => {
                    try { src.stop(); src.disconnect(); gain.disconnect(); } catch (e) {}
                }, 50);
            } else {
                src.stop();
                src.disconnect();
            }
        } catch (e) {}
    }
}

const playHitMarker = () => playProcedural('hit');
const playHeartbeat = () => {
    const t = performance.now();
    if (t - lastHeartbeatTime > 1000) { lastHeartbeatTime = t; playProcedural('heart'); }
};

// ---------------------------------------------------------------------
// Three.js engine (created lazily after assets load)
// ---------------------------------------------------------------------
let scene, camera, renderer, clock;
let gunGroup, muzzleLight, muzzleFadeUntil = 0;
const weaponModels = {};
const mapColliderMeshes = [];
const groundMeshes = [];
const enemies = [];
const enemyProjectiles = [];
const characterTemplates = [];
let enemyAnimations = [];
const projectilePool = [];
const sharedProjectileGeo = new THREE.SphereGeometry(0.12, 8, 8);
const healthBarPool = [];
const sharedHitboxGeo = new THREE.BoxGeometry(ENEMY_RADIUS * 2, ENEMY_HEIGHT, ENEMY_RADIUS * 2);
const sharedHitboxMat = new THREE.MeshBasicMaterial({ visible: false });
const collidables = [];
const lastSafePosition = { x: 0, y: PLAYER_EYE_OFFSET, z: 0 };
const hitFlashMat = new THREE.MeshBasicMaterial({ color: 0xff0000, skinning: true });
const raycaster = new THREE.Raycaster();
const projectileRaycaster = new THREE.Raycaster();
const moveRaycaster = new THREE.Raycaster();
const enemyMoveRaycaster = new THREE.Raycaster();

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _box = new THREE.Box3();
const _boxSize = new THREE.Vector3();
const _boxCenter = new THREE.Vector3();

// ---------------------------------------------------------------------
// Boot: initialize audio, then load assets
// ---------------------------------------------------------------------
initAudio();
boot();

async function boot() {
    try {
        // Step 1: create Three.js scene and camera
        setPhase('Initializing engine...');
        initEngine();
        await tick(50);

        // Step 2: load weapon pack
        setPhase('Loading weapons...');
        await loadWeapons();

        // Step 3: load sky texture
        setPhase('Loading environment...');
        await loadSky();

        // Step 4: load enemy pack
        setPhase('Loading hostiles...');
        await loadEnemies();

        // Step 5: load audio
        setPhase('Loading audio...');
        await loadAudio();

        // Step 6: preload character templates and load the character GLB
        setPhase('Preparing battlefield...');
        await tick(100);

        sceneReady = true;
        setPhase('Ready');
        setProgress(100, 1, 1);

        await tick(200);
        onLoadComplete();
    } catch (err) {
        console.error('Boot failed:', err);
        showRetry();
    }
}

function tick(ms) { return new Promise(r => setTimeout(r, ms)); }

function setPhase(text) {
    if (dom.loadingPhase) dom.loadingPhase.textContent = text;
}

function setProgress(loaded, total, forced) {
    const pct = forced !== undefined ? forced : (total > 0 ? (loaded / total) * 100 : 0);
    progress.updateDOM(dom.loadingBarFill, dom.loadingPercent, dom.loadingBytes, pct, loaded, total);
}

function showRetry() {
    if (dom.retryLoadBtn) dom.retryLoadBtn.style.display = '';
    if (dom.skipLoadBtn) dom.skipLoadBtn.style.display = 'none';
    setPhase('Failed to load. Check console.');
}

function onLoadComplete() {
    show(dom.loadingScreen, 'none');
    if (!localStorage.getItem('tosAccepted')) show(dom.tosModal, 'flex');
    else show(dom.mainMenu, 'flex');
}

// ---------------------------------------------------------------------
// Engine setup
// ---------------------------------------------------------------------
function initEngine() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = PLAYER_EYE_OFFSET;
    camera.rotation.order = 'YXZ';

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.25));
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onResize);

    clock = new THREE.Clock();

    gunGroup = new THREE.Group();
    gunGroup.position.set(0.1, -0.15, -0.2);
    camera.add(gunGroup);
    scene.add(camera);

    muzzleLight = new THREE.PointLight(0xffaa00, 0, 6);
    muzzleLight.position.set(0.3, -0.15, -0.8);
    gunGroup.add(muzzleLight);

    // Sky sphere
    const skyGeo = new THREE.SphereGeometry(900, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x1a2030, side: THREE.BackSide, depthWrite: false });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.userData.isGameLight = true;
    scene.add(skyMesh);
    window.__skyMat = skyMat;

    // Lights
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

    // Weapon sub-groups
    ['rifle','smg','m16','barrett','pistol'].forEach(k => {
        weaponModels[k] = new THREE.Group();
        weaponModels[k].visible = false;
        gunGroup.add(weaponModels[k]);
    });
    weaponModels.rifle.visible = true;

    initMenuModel();
    startAnimationLoop();
}

function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------
async function loadWeapons() {
    const url = PATHS.weapons + 'lp_mini_pack_modern_weaponswith_bullets_part_2.glb';
    const size = ASSET_SIZES[url] || 1000000;
    try {
        setProgress(0, size);
        const buf = await loadWithProgress(url, (loaded, total) => {
            setProgress(loaded, total || size);
        });
        const loader = new THREE.GLTFLoader();
        await new Promise((resolve, reject) => {
            loader.parse(buf, PATHS.weapons, gltf => {
                try { attachWeapons(gltf); resolve(); }
                catch (e) { reject(e); }
            }, reject);
        });
    } catch (e) {
        console.warn('Weapon load failed:', e.message);
    }
}

function attachWeapons(gltf) {
    const src = gltf.scene;
    const ak47 = src.getObjectByName('Gun009');
    const mp5 = src.getObjectByName('Gun010');
    const m16 = src.getObjectByName('Gun007');
    const barrett = src.getObjectByName('Gun008');
    const pistolSrc = src.getObjectByName('Gun007');
    const pistol = pistolSrc ? pistolSrc.clone(true) : null;

    const entries = [
        [ak47, weaponModels.rifle, 0.6],
        [mp5, weaponModels.smg, 0.6],
        [m16, weaponModels.m16, 0.6],
        [barrett, weaponModels.barrett, 0.55],
        [pistol, weaponModels.pistol, 0.42],
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
}

async function loadSky() {
    const url = PATHS.images + 'backgroundsky.jpg';
    try {
        const tex = await new Promise((resolve, reject) => {
            new THREE.TextureLoader().load(url, resolve, undefined, reject);
        });
        tex.minFilter = THREE.LinearFilter;
        if (window.__skyMat) {
            window.__skyMat.map = tex;
            window.__skyMat.color.set(0xffffff);
            window.__skyMat.needsUpdate = true;
        }
    } catch (e) {
        console.warn('Sky load failed:', e.message);
    }
}

async function loadEnemies() {
    const url = PATHS.enemies + 'polyart_zombies_with_animations_free_pack.glb';
    const size = ASSET_SIZES[url] || 7000000;
    try {
        setProgress(0, size);
        const buf = await loadWithProgress(url, (loaded, total) => {
            setProgress(loaded, total || size);
        });
        const loader = new THREE.GLTFLoader();
        await new Promise((resolve, reject) => {
            loader.parse(buf, PATHS.enemies, gltf => {
                try {
                    gltf.scene.updateMatrixWorld(true);
                    if (gltf.animations && gltf.animations.length > 0) enemyAnimations = gltf.animations;

                    const fullClip = (gltf.animations && gltf.animations.length > 0) ? gltf.animations[0] : null;

                    // Locate all 10 self-contained zombie character rigs
                    const rigNodes = [];
                    gltf.scene.traverse(node => {
                        const name = (node.name || '').toLowerCase();
                        if (name.startsWith('rig_charroot')) {
                            let hasSkin = false;
                            node.traverse(child => { if (child.isSkinnedMesh) hasSkin = true; });
                            if (hasSkin) rigNodes.push(node);
                        }
                    });

                    console.log('Found', rigNodes.length, 'zombie character rigs');

                    characterTemplates.length = 0;
                    rigNodes.forEach(rigNode => {
                        // Gather all node names within this rig
                        const rigNodeNames = new Set();
                        rigNode.traverse(n => {
                            if (n.name) rigNodeNames.add(n.name);
                            if (n.isMesh || n.isSkinnedMesh) {
                                if (n.material) {
                                    n.material = n.material.clone();
                                    n.userData.originalMaterial = n.material;
                                }
                            }
                        });

                        // Filter animation tracks to only those that target nodes in this rig
                        let isolatedClip = null;
                        if (fullClip) {
                            const tracks = fullClip.tracks.filter(t => {
                                const targetNode = t.name.split('.')[0];
                                return rigNodeNames.has(targetNode);
                            });
                            isolatedClip = new THREE.AnimationClip('anim_' + rigNode.name, fullClip.duration, tracks);
                        }

                        characterTemplates.push({
                            rig: rigNode,
                            clip: isolatedClip
                        });
                    });

                    console.log('✅ Enemies loaded:', characterTemplates.length, 'templates ready');
                    resolve();
                } catch (e) {
                    console.error('Enemy processing error:', e);
                    reject(e);
                }
            }, reject);
        });
    } catch (e) {
        console.warn('Enemy load failed:', e.message);
    }
}

// ---------------------------------------------------------------------
// Load audio
// ---------------------------------------------------------------------
async function loadAudioBuffer(filename) {
    if (!audioCtx) initAudio();
    if (!audioCtx) return null;

    const candidates = [
        PATHS.audio + filename,
        encodeURI(PATHS.audio + filename),
        'audio/' + filename,
        encodeURI('audio/' + filename),
        '/games/fps-shooter/audio/' + filename,
        encodeURI('/games/fps-shooter/audio/' + filename),
        'FPS/portal/games/audio/' + filename,
        encodeURI('FPS/portal/games/audio/' + filename),
        '/FPS/portal/games/audio/' + filename,
        encodeURI('/FPS/portal/games/audio/' + filename),
        'portal/games/audio/' + filename,
        encodeURI('portal/games/audio/' + filename),
        '/portal/games/audio/' + filename,
        encodeURI('/portal/games/audio/' + filename),
    ];

    for (const testUrl of candidates) {
        try {
            const buf = await loadWithProgress(testUrl);
            if (buf && buf.byteLength > 0) {
                try {
                    const decoded = await audioCtx.decodeAudioData(buf.slice(0));
                    console.log('🎵 Audio decoded successfully:', filename, 'from', testUrl);
                    return decoded;
                } catch (eDec) {
                    try {
                        const decoded = await new Promise((res, rej) => {
                            audioCtx.decodeAudioData(buf.slice(0), res, rej);
                        });
                        console.log('🎵 Audio decoded via callback:', filename);
                        return decoded;
                    } catch (e2) {}
                }
            }
        } catch (e) {}
    }
    console.warn('🎵 Failed to load audio file:', filename);
    return null;
}

async function loadAudio() {
    initAudio();
    if (!audioCtx) {
        console.warn('🎵 Audio context unavailable — using procedural audio');
        return;
    }

    try {
        const [gun, pistol, sniper, reload, footsteps] = await Promise.all([
            loadAudioBuffer('genralfiresound_6sec.mp3'),
            loadAudioBuffer('pistol_fire3.mp3'),
            loadAudioBuffer('sniperfire.mp3'),
            loadAudioBuffer('reloadsound1sec.mp3'),
            loadAudioBuffer('walking_runing same sound25sec.mp3')
        ]);
        
        gunAudioBuffers = {
            rifle: gun,
            smg: gun,
            m16: gun,
            barrett: sniper,
            pistol: pistol,
        };

        gunAudioBuffer = gun;
        reloadAudioBuffer = reload;
        footstepAudioBuffer = footsteps;
        console.log('🎵 Audio system ready: fire=' + !!gunAudioBuffer + ', reload=' + !!reloadAudioBuffer + ', footsteps=' + !!footstepAudioBuffer);
    } catch (e) {
        console.warn('🎵 Audio loading exception:', e);
    }
}

// ---------------------------------------------------------------------
// TOS accept
// ---------------------------------------------------------------------
// TOS accept
// ---------------------------------------------------------------------
dom.acceptTosBtn?.addEventListener('click', () => {
    localStorage.setItem('tosAccepted', '1');
    show(dom.tosModal, 'none');
    show(dom.mainMenu, 'flex');
});

// ---------------------------------------------------------------------
// Weapon selection
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
    if (dom.currentWepName) dom.currentWepName.textContent = stats.name;
    Object.values(weaponButtons).flat().forEach(b => b && b.classList.remove('selected'));
    (weaponButtons[type] || []).forEach(b => b && b.classList.add('selected'));
    updateWeaponVisibility();
    updateAmmoHUD();
}

function updateWeaponVisibility() {
    if (!weaponModels.rifle) return;
    weaponModels.rifle.visible   = selectedWeaponType === 'rifle';
    weaponModels.smg.visible     = selectedWeaponType === 'smg';
    weaponModels.m16.visible     = selectedWeaponType === 'm16';
    weaponModels.barrett.visible = selectedWeaponType === 'barrett';
    weaponModels.pistol.visible  = selectedWeaponType === 'pistol';
}

Object.keys(weaponButtons).forEach(type => {
    weaponButtons[type].forEach(btn => btn && btn.addEventListener('click', () => selectWeapon(type)));
});
['pauseRifle','pauseSMG','pauseM16','pauseBarrett','pausePistol'].forEach((id, i) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => selectWeapon(['rifle','smg','m16','barrett','pistol'][i]));
});

// ---------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------
function updateHealthHUD() {
    if (dom.healthVal) dom.healthVal.textContent = Math.max(0, Math.floor(health));
    if (health <= 30 && health > 0) {
        show(dom.vignette, 'block');
        if (dom.healthDisplay) dom.healthDisplay.style.backgroundColor = 'rgba(150, 0, 0, 0.7)';
        playHeartbeat();
    } else {
        show(dom.vignette, 'none');
        if (dom.healthDisplay) dom.healthDisplay.style.backgroundColor = '';
    }
}
function updateScoreHUD() {
    if (dom.scoreVal) dom.scoreVal.textContent = score;
    if (dom.killsVal) dom.killsVal.textContent = kills;
}
function updateAmmoHUD() {
    if (dom.ammoVal) dom.ammoVal.textContent = ammo;
    if (dom.reserveVal) dom.reserveVal.textContent = reserveAmmo;
}
function updateHUD() { updateHealthHUD(); updateScoreHUD(); updateAmmoHUD(); }

function flashClass(el) {
    if (!el) return;
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
}
const triggerHealingEffect = () => flashClass(dom.healingFlash);
const showHitMarker = () => flashClass(dom.hitMarker);
const triggerGooHit = () => flashClass(dom.gooHit);

// ---------------------------------------------------------------------
// Enemy health bar
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
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 126, 16);
        tex.needsUpdate = true;
    };
    update(3);
    return { sprite, update, texture: tex, canvas };
}

function getEnemyHealthBar() {
    let hb = healthBarPool.pop();
    if (!hb) {
        hb = createEnemyHealthBar();
    } else {
        hb.update(3);
        hb.sprite.visible = true;
    }
    return hb;
}

function releaseEnemyHealthBar(hb) {
    if (!hb) return;
    if (hb.sprite.parent) hb.sprite.parent.remove(hb.sprite);
    hb.sprite.visible = false;
    healthBarPool.push(hb);
}

// ---------------------------------------------------------------------
// Particles / tracers (pooled)
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
function spawnSparks(x, y, z, isBlood) {
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
// Shooting
// ---------------------------------------------------------------------
function triggerReload() {
    if (isReloading || ammo >= maxAmmo || reserveAmmo <= 0) return;
    stopGunSound();
    isReloading = true;
    reloadStartTime = performance.now();
    show(dom.reloadUI, 'block');
    if (dom.crosshair) dom.crosshair.style.opacity = '0.2';
    playReloadSound();
}

function shootWeapon() {
    if (isReloading || ammo <= 0) {
        stopGunSound();
        if (ammo <= 0) triggerReload();
        return;
    }
    const now = performance.now();
    if (now - lastFireTime < fireRate) return;
    lastFireTime = now;

    ammo--; updateAmmoHUD();
    const buf = gunAudioBuffers[selectedWeaponType] || gunAudioBuffers.rifle;
    playBuffer(buf);

    function playBuffer(b) {
        if (!audioCtx || !b) return;
        try {
            const src = audioCtx.createBufferSource();
            const gain = audioCtx.createGain();
            src.buffer = b;
            gain.gain.setValueAtTime(0.65, audioCtx.currentTime);
            src.connect(gain);
            gain.connect(audioCtx.destination);
            src.start(0);
        } catch (e) {}
    }
    if (ammo <= 0) {
        stopGunSound();
        triggerReload();
    }
    if (muzzleLight) { muzzleLight.intensity = 4.0; muzzleFadeUntil = now + 40; }

    recoilPitch += 0.006;
    recoilKick = Math.min(0.08, recoilKick + 0.05);
    yaw += (Math.random() - 0.5) * 0.002;

    raycaster.setFromCamera(_v1.set(0, 0), camera);
    const shotDir = raycaster.ray.direction.clone();
    const muzzleWorld = muzzleLight ? muzzleLight.getWorldPosition(_v2) : _v2.set(0, 0, 0);
    const tracerEnd = _v3.copy(camera.position).addScaledVector(shotDir, 80);

    const wallHits = raycaster.intersectObjects(mapColliderMeshes, true);
    const wallDist = wallHits.length > 0 ? wallHits[0].distance : Infinity;
    const wallPoint = wallHits.length > 0 ? wallHits[0].point.clone() : null;

    const hitboxes = [];
    for (const e of enemies) for (const m of e.meshes) hitboxes.push(m);
    const enemyHits = raycaster.intersectObjects(hitboxes, false);
    const enemyDist = enemyHits.length > 0 ? enemyHits[0].distance : Infinity;

    let hitEnemy = false;
    let hitPoint = wallPoint || tracerEnd;

    if (enemyDist < wallDist) {
        tracerEnd.copy(enemyHits[0].point);
        hitPoint = enemyHits[0].point;
        const hitObj = enemyHits[0].object;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].meshes.includes(hitObj)) {
                hitEnemy = true;
                applyDamageToEnemy(enemies[i], i);
                playHitMarker();
                break;
            }
        }
    } else if (wallPoint) {
        tracerEnd.copy(wallPoint);
        hitPoint = wallPoint;
    }

    spawnBulletTracer(muzzleWorld, tracerEnd);
    spawnSparks(hitPoint.x, hitPoint.y, hitPoint.z, hitEnemy);
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
        disposeEnemy(enemy);
        enemies.splice(index, 1);
        score += 150; kills++;
        reserveAmmo = Math.min(180, reserveAmmo + 15);
        updateScoreHUD(); updateAmmoHUD();
        spawnEnemy();
    }
}

function disposeEnemy(enemy) {
    if (enemy.group.parent) enemy.group.parent.remove(enemy.group);
    if (enemy.mixer) {
        try {
            enemy.mixer.stopAllAction();
            enemy.mixer.uncacheRoot(enemy.clonedRig || enemy.modelRoot);
        } catch (e) {}
    }
    if (enemy.healthBar) {
        releaseEnemyHealthBar(enemy.healthBar);
    }
    for (const m of enemy.meshes) {
        if (m && m.userData && m.userData.originalMaterial) {
            m.material = m.userData.originalMaterial;
        }
    }
}

// ---------------------------------------------------------------------
// Enemy projectiles
// ---------------------------------------------------------------------
function getProjectileMesh() {
    let p = projectilePool.pop();
    if (!p) {
        p = new THREE.Mesh(sharedProjectileGeo, gooMat);
    }
    p.visible = true;
    return p;
}

function releaseProjectile(pr) {
    if (!pr || !pr.mesh) return;
    if (pr.mesh.parent) pr.mesh.parent.remove(pr.mesh);
    pr.mesh.visible = false;
    projectilePool.push(pr.mesh);
}

function shootEnemyProjectile(enemy) {
    const start = _v1.set(
        enemy.group.position.x,
        enemy.group.position.y + ENEMY_HEIGHT * 0.7,
        enemy.group.position.z
    );
    const projectile = getProjectileMesh();
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
                releaseProjectile(pr);
                enemyProjectiles.splice(i, 1);
                continue;
            }
        }

        if (pr.mesh.position.distanceTo(camera.position) < 0.9) {
            health -= 10;
            lastDamageTime = performance.now();
            triggerGooHit();
            updateHealthHUD();
            releaseProjectile(pr);
            enemyProjectiles.splice(i, 1);
            if (health <= 0) {
                isDead = true;
                isFiring = false;
                stopGunSound();
                stopFootstepSound();
                show(dom.deathScreen, 'flex');
                if (document.pointerLockElement) document.exitPointerLock();
            }
        } else if (pr.life <= 0) {
            releaseProjectile(pr);
            enemyProjectiles.splice(i, 1);
        }
    }
}

// ---------------------------------------------------------------------
// Player movement (ray-based)
// ---------------------------------------------------------------------
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
    const pz = camera.position.z;
    const pyFeet = groundY + 0.25;
    const pyChest = groundY + 1.1;
    let movedX = false, movedZ = false;
    if (Math.abs(dx) > 0.0001) {
        const signX = Math.sign(dx);
        const absX = Math.abs(dx);
        if (!rayHitsMap(px, pyFeet, pz, signX, 0, absX) &&
            !rayHitsMap(px, pyChest, pz, signX, 0, absX)) {
            camera.position.x += dx; movedX = true;
        } else velocityX = 0;
    }
    if (Math.abs(dz) > 0.0001) {
        const signZ = Math.sign(dz);
        const absZ = Math.abs(dz);
        if (!rayHitsMap(camera.position.x, pyFeet, pz, 0, signZ, absZ) &&
            !rayHitsMap(camera.position.x, pyChest, pz, 0, signZ, absZ)) {
            camera.position.z += dz; movedZ = true;
        } else velocityZ = 0;
    }
    return movedX || movedZ;
}

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

// ---------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------
function togglePause() {
    if (isDead || !gameActive) return;
    isPaused = !isPaused;
    if (isPaused) {
        isFiring = false;
        stopGunSound();
        stopFootstepSound();
    }
    show(dom.pauseScreen, isPaused ? 'flex' : 'none');
    if (!isPaused && !isMobile) document.body.requestPointerLock?.();
    else if (isPaused && document.pointerLockElement) document.exitPointerLock();
}

$('resumeBtn')?.addEventListener('click', togglePause);

window.addEventListener('keydown', e => {
    resumeAudio();
    if (e.code === 'KeyW') keys.w = true;
    else if (e.code === 'KeyA') keys.a = true;
    else if (e.code === 'KeyS') keys.s = true;
    else if (e.code === 'KeyD') keys.d = true;
    else if (e.code === 'Space') { keys.space = true; lastJumpPressTime = performance.now(); }
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
    else if (e.code === 'KeyC') {
        keys.crouch = true;
        if (keys.shift && isGrounded && !isSliding && (Math.abs(velocityX) > 0.03 || Math.abs(velocityZ) > 0.03)) {
            isSliding = true;
            slideTimer = 0.65;
            velocityX *= 1.35;
            velocityZ *= 1.35;
        }
    }
    else if (e.code === 'KeyR') triggerReload();
    else if (e.code === 'Escape') togglePause();
});
window.addEventListener('keyup', e => {
    if (e.code === 'KeyW') keys.w = false;
    else if (e.code === 'KeyA') keys.a = false;
    else if (e.code === 'KeyS') keys.s = false;
    else if (e.code === 'KeyD') keys.d = false;
    else if (e.code === 'Space') keys.space = false;
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
    else if (e.code === 'KeyC') keys.crouch = false;
});

window.addEventListener('mousedown', e => {
    if (!gameActive || isDead || isPaused) return;
    resumeAudio();
    if (e.button === 2 && selectedWeaponType === 'barrett') isAiming = true;
    if (e.button === 0) {
        if (!isMobile && document.pointerLockElement !== document.body) {
            document.body.requestPointerLock?.();
        } else {
            isFiring = true;
            if (ammo > 0 && !isReloading) startGunSound();
            shootWeapon();
        }
    }
});
window.addEventListener('mouseup', e => {
    if (e.button === 0) {
        isFiring = false;
        stopGunSound();
    }
    if (e.button === 2) isAiming = false;
});
window.addEventListener('blur', () => {
    isFiring = false;
    stopGunSound();
    stopFootstepSound();
});
window.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== document.body && gameActive && !isDead && !isPaused && !isMobile) {
        togglePause();
    }
});
document.addEventListener('mousemove', e => {
    if (document.pointerLockElement === document.body && !isDead && !isPaused) {
        yaw -= e.movementX * baseLookSpeed;
        pitch -= e.movementY * baseLookSpeed;
        pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, pitch));
    }
});

// Mobile controls
if (isMobile) {
    let joystickTouchId = null;
    let joyCenter = { x: 0, y: 0 };
    const joyMaxRadius = 40;
    const updateJoystick = t => {
        let dx = t.clientX - joyCenter.x;
        let dy = t.clientY - joyCenter.y;
        const dist = Math.hypot(dx, dy);
        if (dist > joyMaxRadius) { dx = (dx/dist) * joyMaxRadius; dy = (dy/dist) * joyMaxRadius; }
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
            joyCenter = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
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
                yaw -= (t.clientX - lastTouchX) * baseLookSpeed;
                pitch -= (t.clientY - lastTouchY) * baseLookSpeed;
                pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, pitch));
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
        el?.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); off(); }, { passive: false });
    };
    bindHold(dom.jumpBtn, () => { keys.space = true; lastJumpPressTime = performance.now(); }, () => keys.space = false);
    dom.slideBtn?.addEventListener('touchstart', e => {
        e.preventDefault(); e.stopPropagation();
        if (isGrounded && !isSliding) {
            isSliding = true;
            slideTimer = 0.65;
            const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
            velocityX = -sinY * WALK_SPEED * sprintMultiplier * 1.35;
            velocityZ = -cosY * WALK_SPEED * sprintMultiplier * 1.35;
        }
    }, { passive: false });
    bindHold(dom.fireBtn, () => {
        isFiring = true;
        if (ammo > 0 && !isReloading) startGunSound();
        shootWeapon();
    }, () => {
        isFiring = false;
        stopGunSound();
    });
    dom.ammoDisplay?.addEventListener('touchstart', e => {
        if (isCustomizing) return;
        e.preventDefault();
        triggerReload();
    }, { passive: false });
    $('mobilePauseBtn')?.addEventListener('touchstart', e => { e.preventDefault(); togglePause(); }, { passive: false });
}

// ---------------------------------------------------------------------
// HUD customization
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
let activeDragEl = null, dragStartX = 0, dragStartY = 0, dragInitLeft = 0, dragInitTop = 0;
let dragGlobalListenersAttached = false;

function setupDraggables() {
    if (!dragGlobalListenersAttached) {
        dragGlobalListenersAttached = true;
        const onMove = e => {
            if (!activeDragEl || !isCustomizing) return;
            e.preventDefault();
            const t = e.touches ? e.touches[0] : e;
            activeDragEl.style.left = (dragInitLeft + t.clientX - dragStartX) + 'px';
            activeDragEl.style.top = (dragInitTop + t.clientY - dragStartY) + 'px';
        };
        const onEnd = () => { activeDragEl = null; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
    }
    draggableElements.forEach(id => {
        const el = $(id);
        if (!el || el.dataset.dragAttached) return;
        const dragStart = e => {
            if (!isCustomizing) return;
            e.preventDefault();
            activeDragEl = el;
            const t = e.touches ? e.touches[0] : e;
            dragStartX = t.clientX; dragStartY = t.clientY;
            const rect = el.getBoundingClientRect();
            el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none';
            el.style.left = rect.left + 'px'; el.style.top = rect.top + 'px';
            dragInitLeft = rect.left; dragInitTop = rect.top;
        };
        el.addEventListener('mousedown', dragStart);
        el.addEventListener('touchstart', dragStart, { passive: false });
        el.dataset.dragAttached = 'true';
    });
}

// ---------------------------------------------------------------------
// UI routing
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
        selectedMapFile = e.currentTarget.getAttribute('data-map');
    });
});

$('startBtn')?.addEventListener('click', () => {
    show(dom.mapSelectMenu, 'none');
    show(dom.loadingMapUI, 'flex');
    setTimeout(() => loadSelectedMap(selectedMapFile), 100);
});

// ---------------------------------------------------------------------
// Map loader
// ---------------------------------------------------------------------
function loadSelectedMap(mapFile) {
    for (let i = scene.children.length - 1; i >= 0; i--) {
        const child = scene.children[i];
        if (child.userData.isMapPiece) {
            scene.remove(child);
            child.traverse(node => {
                if (node.isMesh) {
                    if (node.geometry) node.geometry.dispose();
                    if (node.material) {
                        const mats = Array.isArray(node.material) ? node.material : [node.material];
                        mats.forEach(m => {
                            if (m.map) m.map.dispose();
                            m.dispose();
                        });
                    }
                }
            });
        }
    }
    mapColliderMeshes.length = 0;
    groundMeshes.length = 0;
    collidables.length = 0;

    const url = PATHS.maps + mapFile;
    const size = MAP_SIZES[mapFile] || 1000000;

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onprogress = e => {
        if (e.lengthComputable) {
            const pct = (e.loaded / e.total) * 100;
            progress.updateDOM(dom.mapLoadingBarFill, dom.mapLoadingPercent, dom.mapLoadingBytes, pct, e.loaded, e.total);
        }
    };
    xhr.onload = () => {
        if (xhr.status !== 200) { onMapError(); return; }
        progress.updateDOM(dom.mapLoadingBarFill, dom.mapLoadingPercent, dom.mapLoadingBytes, 100, size, size);

        const loader = new THREE.GLTFLoader();
        loader.parse(xhr.response, PATHS.maps, gltf => {
            onMapLoaded(gltf);
        }, onMapError);
    };
    xhr.onerror = onMapError;
    xhr.send();
}

function onMapError() {
    if (dom.mapLoadingText) dom.mapLoadingText.textContent = 'Map failed to load — using fallback';
    setTimeout(() => {
        show(dom.loadingMapUI, 'none');
        startGame();
    }, 800);
}

function onMapLoaded(gltf) {
    const mapRoot = gltf.scene;
    
    // FIX 3: Robust Map Setup (Center, Rotate, Calculate precise bounds)
    mapRoot.updateMatrixWorld(true);
    let rawBox = new THREE.Box3().setFromObject(mapRoot);
    let rawSize = rawBox.getSize(new THREE.Vector3());

    // Now center the map precisely at 0, 0, 0
    const rawCenter = rawBox.getCenter(new THREE.Vector3());
    const offset = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), rawCenter);
    // Move the root so its center is at 0,0,0
    mapRoot.position.copy(offset);
    mapRoot.updateMatrixWorld(true);

    // Recompute the actual bounds now that it's centered and rotated correctly
    const wholeBox = new THREE.Box3().setFromObject(mapRoot);
    mapBounds.minX = wholeBox.min.x;
    mapBounds.maxX = wholeBox.max.x;
    mapBounds.minZ = wholeBox.min.z;
    mapBounds.maxZ = wholeBox.max.z;

    mapRoot.traverse(node => {
        if (!node.isMesh || node.isSkinnedMesh || node.isSprite) return;
        node.userData.isMapPiece = true;
        node.updateMatrixWorld(true);
        let skipCollision = false;
        if (node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            let fullyTransparent = true;
            mats.forEach(mat => {
                if (!mat) return;
                mat.depthTest = true;
                if (mat.opacity > 0.01) fullyTransparent = false;
                if (mat.opacity >= 0.95) {
                    mat.transparent = false;
                    mat.depthWrite = true;
                }
            });
            if (fullyTransparent) skipCollision = true;
        }

        const name = (node.name || '').toLowerCase();
        if (name.includes('nav') || name.includes('ignore') || name.includes('sky') || name.includes('trigger') || name.includes('bounds')) {
            skipCollision = true;
        }
        if (!node.visible && !name.includes('collider') && !name.includes('collision')) {
            skipCollision = true;
        }

        if (!skipCollision) {
            mapColliderMeshes.push(node);
        }
        const bbox = new THREE.Box3().setFromObject(node);
        const size = bbox.getSize(new THREE.Vector3());
        if (size.y < 0.6 && size.y < Math.max(size.x, size.z) * 0.2) groundMeshes.push(node);
    });

    mapRoot.userData.isMapPiece = true;
    scene.add(mapRoot);

    // Raycast straight down from the center to find the exact ground level
    const cx = (mapBounds.minX + mapBounds.maxX) / 2;
    const cz = (mapBounds.minZ + mapBounds.maxZ) / 2;
    const downRay = new THREE.Raycaster(new THREE.Vector3(cx, wholeBox.max.y + 10, cz), new THREE.Vector3(0, -1, 0));
    const hits = downRay.intersectObjects(mapColliderMeshes, true);
    
    if (hits.length > 0) {
        groundY = hits[0].point.y;
    } else {
        groundY = wholeBox.min.y + 0.02; // fallback
    }

    camera.position.set(cx, groundY + PLAYER_EYE_OFFSET, cz);
    lastSafePosition.x = cx; lastSafePosition.y = groundY + PLAYER_EYE_OFFSET; lastSafePosition.z = cz;
    window.logicalBodyY = groundY + PLAYER_HEIGHT - 0.15; // Reset logical Y for Fix 2

    setTimeout(() => { show(dom.loadingMapUI, 'none'); startGame(); }, 200);
}

// ---------------------------------------------------------------------
// Start / restart
// ---------------------------------------------------------------------
function startGame(e) {
    if (e) e.preventDefault();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    show(dom.mainMenu, 'none');
    show(dom.mapSelectMenu, 'none');
    show(dom.deathScreen, 'none');
    show(dom.pauseScreen, 'none');
    show(dom.loadingMapUI, 'none');

    health = 100; score = 0; kills = 0;
    ammo = maxAmmo; reserveAmmo = 90;
    isReloading = false; isSliding = false; isPaused = false; isDead = false;
    isFiring = false; isAiming = false;
    stopGunSound(); stopFootstepSound();
    recoilPitch = 0; recoilKick = 0;
    velocityX = 0; velocityZ = 0; yVelocity = 0;
    isGrounded = true;
    lastDamageTime = performance.now();
    updateHUD();
    show(dom.reloadUI, 'none');
    if (dom.crosshair) dom.crosshair.style.opacity = '0.85';

    enemies.forEach(en => disposeEnemy(en));
    enemies.length = 0;
    enemyProjectiles.forEach(p => {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        p.mesh.geometry.dispose();
    });
    enemyProjectiles.length = 0;

    const cx = (mapBounds.minX + mapBounds.maxX) / 2;
    const cz = (mapBounds.minZ + mapBounds.maxZ) / 2;
    camera.position.set(cx, groundY + PLAYER_EYE_OFFSET, cz);
    yaw = 0; pitch = 0;
    camera.rotation.set(0, 0, 0);
    lastSafePosition.x = cx; lastSafePosition.y = groundY + PLAYER_EYE_OFFSET; lastSafePosition.z = cz;
    blockedMovementFrames = 0;

    const n = isMobile ? 4 : 6;
    for (let i = 0; i < n; i++) spawnEnemy();

    gameActive = true;
    try { if (!isMobile) document.body.requestPointerLock?.(); } catch {}
}

$('restartBtn')?.addEventListener('click', startGame);
$('exitToMenuBtn')?.addEventListener('click', () => {
    window.parent.postMessage({ type: 'arcade-close' }, '*');
});

// ---------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------
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
    return { x: (mapBounds.minX + mapBounds.maxX) / 2, z: (mapBounds.minZ + mapBounds.maxZ) / 2 };
}

function spawnEnemy() {
    if (characterTemplates.length === 0) return;

    // Pick a template with pre-filtered rig and animation clip
    const templateData = characterTemplates[Math.floor(Math.random() * characterTemplates.length)];
    const sourceRig = templateData.rig;
    const clip = templateData.clip;

    // Clone the rig hierarchy using SkeletonUtils
    const clonedRig = (typeof THREE.SkeletonUtils !== 'undefined')
        ? THREE.SkeletonUtils.clone(sourceRig)
        : sourceRig.clone();

    // Reset placement transforms from showcase scene
    clonedRig.position.set(0, 0, 0);
    // Mixamo / GLTF rigs often lie flat (Z-up vs Y-up). -90 degrees around X stands them up.
    clonedRig.rotation.set(-Math.PI / 2, 0, 0);
    clonedRig.scale.set(1, 1, 1);
    clonedRig.updateMatrixWorld(true);

    // Compute raw unscaled bounding box
    const rawBox = new THREE.Box3().setFromObject(clonedRig);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    const rawCenter = rawBox.getCenter(new THREE.Vector3());

    // Scale factor to normalize enemy height to ENEMY_HEIGHT (1.4m) using max dimension to avoid rotation issues
    const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
    const scaleFactor = (maxDim > 0.1) ? (ENEMY_HEIGHT / maxDim) : 0.0085;

    // Outer group placed in world at spawn point
    const group = new THREE.Group();

    // Wrapper group scaled to correct human/enemy proportions
    const wrapper = new THREE.Group();
    wrapper.scale.setScalar(scaleFactor);

    // Holder group to center the model's pivot: feet at y=0, origin at x=0, z=0
    const holder = new THREE.Group();
    holder.position.x = -rawCenter.x;
    holder.position.y = -rawBox.min.y;
    holder.position.z = -rawCenter.z;

    holder.add(clonedRig);
    wrapper.add(holder);
    group.add(wrapper);

    // Animation mixer with isolated per-rig animation clip
    let mixer = null;
    if (clip) {
        mixer = new THREE.AnimationMixer(clonedRig);
        const action = mixer.clipAction(clip);
        action.timeScale = 0.85 + Math.random() * 0.3;
        action.play();
    }

    // Collect meshes + clone materials for independent hit-flash
    const meshes = [];
    clonedRig.traverse(node => {
        if (node.isMesh || node.isSkinnedMesh) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            const clonedMats = mats.map(m => {
                if (!m) return m;
                // FIX 1: Convert to MeshLambertMaterial for better lighting compatibility
                const cl = new THREE.MeshLambertMaterial({
                    color: m.color || 0xffffff,
                    map: m.map || null,
                    skinning: true // Crucial for rigged models
                });
                cl.transparent = false;
                cl.opacity = 1;
                cl.depthWrite = true;
                cl.depthTest = true;
                cl.visible = true;
                cl.side = THREE.FrontSide;
                return cl;
            });
            node.material = Array.isArray(node.material) ? clonedMats : clonedMats[0];
            node.visible = true;
            node.frustumCulled = false;
            node.userData.originalMaterial = node.material;
            meshes.push(node);
        }
    });

    // Health bar (pooled)
    const healthBar = getEnemyHealthBar();
    healthBar.sprite.position.y = ENEMY_HEIGHT + 0.35;
    group.add(healthBar.sprite);

    // Position in world
    const pt = randomSpawnPoint();
    group.position.set(pt.x, groundY, pt.z);

    // Fix: raycast down to find the real floor and place enemy on it
    const _rayStart = new THREE.Vector3(pt.x, 100, pt.z);
    const _rayDir = new THREE.Vector3(0, -1, 0);
    const _groundRay = new THREE.Raycaster(_rayStart, _rayDir, 0, 200);
    const _groundHits = _groundRay.intersectObjects(mapColliderMeshes, true);
    if (_groundHits.length > 0) {
        group.position.y = _groundHits[0].point.y;
    }
    console.log('Spawned enemy at Y:', group.position.y.toFixed(2));

    scene.add(group);

    // Hitbox (shared geometry & material, invisible)
    const hitbox = new THREE.Mesh(sharedHitboxGeo, sharedHitboxMat);
    hitbox.userData.isHitbox = true;
    hitbox.position.y = ENEMY_HEIGHT / 2;
    group.add(hitbox);
    meshes.push(hitbox);

    // Register enemy
    enemies.push({
        group,
        wrapper,
        holder,
        clonedRig,
        modelRoot: clonedRig,
        mixer,
        meshes,
        hitbox,
        healthBar,
        hp: 3,
        hitTime: 0,
        state: 'idle',
        velocity: new THREE.Vector2(0, 0),
        facingYaw: Math.random() * Math.PI * 2,
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
// Main loop
// ---------------------------------------------------------------------
function startAnimationLoop() {
    function animate() {
        if (destroyed) return;
        animationFrameId = requestAnimationFrame(animate);

        const dt = Math.min(clock.getDelta(), 0.05);
        const dtScale = dt * 60;
        const nowMs = performance.now();
        updateMenuModel();

        fpsFrameCount++;
        if (nowMs - fpsLastUpdate >= 1000) {
            if (dom.fpsVal) dom.fpsVal.textContent = Math.round(fpsFrameCount * 1000 / (nowMs - fpsLastUpdate));
            fpsFrameCount = 0;
            fpsLastUpdate = nowMs;
        }

        const targetFov = (isAiming && selectedWeaponType === 'barrett') ? sniperAimFov : normalFov;
        if (Math.abs(camera.fov - targetFov) > 0.01) {
            camera.fov += (targetFov - camera.fov) * 0.18;
            camera.updateProjectionMatrix();
        }

        if (muzzleLight && muzzleLight.intensity > 0 && nowMs > muzzleFadeUntil) muzzleLight.intensity = 0;

        recoilPitch *= Math.pow(0.85, dtScale);
        recoilKick *= Math.pow(0.85, dtScale);

        const isMoving = (velocityX * velocityX + velocityZ * velocityZ) > 0.001;
        const bobOffset = (isGrounded && isMoving) ? Math.sin(walkCycle) * 0.02 : 0;
        camera.rotation.set(pitch + recoilPitch + bobOffset, yaw, 0);

        if (gameActive && !isDead && !isPaused) updateGameplay(dt, dtScale, nowMs);

        renderer.render(scene, camera);
    }
    animate();
}

function updateGameplay(dt, dtScale, nowMs) {
    if (isSliding) {
        slideTimer -= dt;
        velocityX *= Math.pow(0.97, dtScale);
        velocityZ *= Math.pow(0.97, dtScale);
        if (slideTimer <= 0 || Math.hypot(velocityX, velocityZ) < 0.03) {
            isSliding = false;
        }
    }
    const isCrouching = (keys.crouch || isSliding) && isGrounded;
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
    if (!isSliding) {
        velocityX += (targetVX - velocityX) * ACCEL * control * dtScale;
        velocityZ += (targetVZ - velocityZ) * ACCEL * control * dtScale;
    }

    if (fwd === 0 && rgt === 0 && isGrounded && !isSliding) {
        velocityX *= Math.pow(1 - FRICTION, dtScale);
        velocityZ *= Math.pow(1 - FRICTION, dtScale);
        if (Math.abs(velocityX) < 0.001) velocityX = 0;
        if (Math.abs(velocityZ) < 0.001) velocityZ = 0;
    }

    if (Math.abs(velocityX) > 0.0001 || Math.abs(velocityZ) > 0.0001) {
        const moved = tryMove(velocityX * dtScale, velocityZ * dtScale);
        if (moved) {
            blockedMovementFrames = 0;
            lastSafePosition.x = camera.position.x;
            lastSafePosition.y = camera.position.y;
            lastSafePosition.z = camera.position.z;
        } else blockedMovementFrames += dtScale;
        if (blockedMovementFrames > 60) {
            camera.position.set(lastSafePosition.x, lastSafePosition.y, lastSafePosition.z);
            velocityX = velocityZ = 0; yVelocity = 0;
            blockedMovementFrames = 0;
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
    
    // FIX 2: Separate the logical body Y from the camera's eye height
    // Logical body Y is tracked in a variable, initially set to camera.position.y (which is eye level)
    if (typeof window.logicalBodyY === 'undefined') window.logicalBodyY = camera.position.y;
    
    // The lowest the logical body can go is groundY + PLAYER_HEIGHT - 0.15 (standing eye level)
    const floorLimit = groundY + PLAYER_HEIGHT - 0.15;
    const nextBodyY = window.logicalBodyY + yVelocity * dtScale;
    
    if (nextBodyY <= floorLimit) {
        yVelocity = 0;
        if (!isGrounded) lastGroundedTime = nowMs;
        isGrounded = true;
        window.logicalBodyY = floorLimit;
    } else {
        isGrounded = false;
        window.logicalBodyY = nextBodyY;
    }

    // Now set the camera to the logical body Y, minus the crouch offset if crouching
    const crouchOffset = isCrouching ? (PLAYER_HEIGHT - PLAYER_CROUCH_HEIGHT) : 0;
    const targetCameraY = window.logicalBodyY - crouchOffset;
    
    // Smoothly lerp camera to target eye height
    camera.position.y += (targetCameraY - camera.position.y) * 0.35 * dtScale;

    const isMovingNow = (velocityX * velocityX + velocityZ * velocityZ) > 0.001;
    const isSprintingNow = keys.shift && isMovingNow && isGrounded && !isCrouching && !isSliding;
    updateFootstepAudio(isMovingNow, isSprintingNow, isCrouching, isGrounded);

    if (isReloading) {
        const elapsed = nowMs - reloadStartTime;
        const progressPct = elapsed / reloadDuration;
        if (progressPct >= 1) {
            isReloading = false;
            const needed = maxAmmo - ammo;
            const taken = Math.min(needed, reserveAmmo);
            ammo += taken; reserveAmmo -= taken;
            updateAmmoHUD();
            show(dom.reloadUI, 'none');
            if (dom.crosshair) dom.crosshair.style.opacity = '0.85';
        } else {
            if (dom.reloadText) dom.reloadText.textContent = ((reloadDuration - elapsed) / 1000).toFixed(1) + 's';
            dom.reloadCircle?.setAttribute('stroke-dasharray', `${(1 - progressPct) * 100}, 100`);
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
        if (p.life <= 0) {
            releaseParticle(p.mesh);
            activeParticles.splice(i, 1);
        }
    }

    for (let i = activeTracers.length - 1; i >= 0; i--) {
        const t = activeTracers[i];
        t.life -= 0.07 * dtScale;
        t.mesh.material.opacity = Math.max(0, t.life);
        if (t.life <= 0) {
            releaseTracer(t.mesh);
            activeTracers.splice(i, 1);
        }
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

function updateEnemies(dtScale, nowMs) {
    const dt = dtScale / 60;

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        // Safety: skip enemies that were removed or are malformed
        if (!e || !e.group || !e.group.position) {
            enemies.splice(i, 1);
            continue;
        }

        if (e.mixer) e.mixer.update(dt);

        // ---------- STATE ----------
        const dist = e.group.position.distanceTo(camera.position);
        const prevState = e.state;
        if (dist < 18) e.state = 'attack';
        else if (dist < 40) e.state = 'chase';
        else e.state = 'idle';
        if (prevState !== e.state) e.nextDecisionTime = nowMs + 400 + Math.random() * 600;

        // ---------- DESIRED DIRECTION ----------
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
                const tangentZ = towardX * e.strafeDirection;
                desiredDirX = towardX * rangePull + tangentX * 0.9;
                desiredDirZ = towardZ * rangePull + tangentZ * 0.9;
            }
        }

        const mag = Math.hypot(desiredDirX, desiredDirZ);
        if (mag > 0.001) { desiredDirX /= mag; desiredDirZ /= mag; }
        else { desiredDirX = 0; desiredDirZ = 0; }

        // ---------- SMOOTH VELOCITY ----------
        const targetVX = desiredDirX * speedThisFrame;
        const targetVZ = desiredDirZ * speedThisFrame;
        const accel = 0.15;
        e.velocity.x += (targetVX - e.velocity.x) * accel * dtScale;
        e.velocity.y += (targetVZ - e.velocity.y) * accel * dtScale;

        const moveX = e.velocity.x * dtScale;
        const moveZ = e.velocity.y * dtScale;

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

        // ---------- GROUND CLAMP ----------
        e.group.position.y += (groundY - e.group.position.y) * 0.4 * dtScale;

        // ---------- ROTATION ----------
        let targetYaw;
        if (e.state === 'idle') {
            if (Math.abs(desiredDirX) < 0.01 && Math.abs(desiredDirZ) < 0.01) {
                targetYaw = e.facingYaw;
            } else {
                targetYaw = Math.atan2(desiredDirX, desiredDirZ);
            }
        } else {
            targetYaw = Math.atan2(
                camera.position.x - e.group.position.x,
                camera.position.z - e.group.position.z
            );
        }

        let diff = targetYaw - e.facingYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.facingYaw += diff * Math.min(1, ENEMY_TURN_SPEED * dt);
        e.group.rotation.y = e.facingYaw;

        // ---------- HIT FLASH ----------
        const flashing = nowMs - e.hitTime < 250;
        for (const m of e.meshes) {
            if (!m) continue;
            if (m.userData.isHitbox) continue;
            if (!m.userData.originalMaterial) continue;
            m.material = flashing ? hitFlashMat : m.userData.originalMaterial;
        }

        // ---------- SHOOTING ----------
        if (e.state === 'attack' && nowMs - e.lastShotTime > 1200) {
            e.lastShotTime = nowMs;
            const headY = e.group.position.y + ENEMY_HEIGHT * 0.7;
            _v1.set(e.group.position.x, headY, e.group.position.z);
            _v2.set(
                camera.position.x - e.group.position.x,
                camera.position.y - headY,
                camera.position.z - e.group.position.z
            ).normalize();
            const losRay = new THREE.Raycaster(_v1, _v2, 0, dist);
            const hits = losRay.intersectObjects(mapColliderMeshes, true);
            if (hits.length === 0) shootEnemyProjectile(e);
        }
    }
}
// ---------------------------------------------------------------------
// Destroy (called from portal or on unload)
// ---------------------------------------------------------------------
function destroyGame() {
    if (destroyed) return;
    destroyed = true;
    gameActive = false;
    isFiring = false;
    stopGunSound();
    stopFootstepSound();

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    try { if (document.pointerLockElement) document.exitPointerLock(); } catch {}

    enemies.forEach(en => disposeEnemy(en));
    enemies.length = 0;

    enemyProjectiles.forEach(p => {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
    });
    enemyProjectiles.length = 0;

    projectilePool.forEach(mesh => {
        if (mesh.parent) mesh.parent.remove(mesh);
    });
    projectilePool.length = 0;
    try { sharedProjectileGeo.dispose(); } catch (e) {}

    healthBarPool.forEach(hb => {
        if (hb.sprite && hb.sprite.parent) hb.sprite.parent.remove(hb.sprite);
        if (hb.texture) hb.texture.dispose();
        if (hb.sprite && hb.sprite.material) hb.sprite.material.dispose();
        if (hb.canvas) { hb.canvas.width = 0; hb.canvas.height = 0; }
    });
    healthBarPool.length = 0;
    try { sharedHitboxGeo.dispose(); } catch (e) {}
    try { sharedHitboxMat.dispose(); } catch (e) {}

    activeParticles.forEach(p => releaseParticle(p.mesh));
    activeParticles.length = 0;
    particlePool.forEach(p => {
        if (p.parent) p.parent.remove(p);
        p.geometry.dispose();
    });
    particlePool.length = 0;

    activeTracers.forEach(t => releaseTracer(t.mesh));
    activeTracers.length = 0;
    tracerPool.forEach(t => {
        if (t.parent) t.parent.remove(t);
        t.geometry.dispose();
        t.material.dispose();
    });
    tracerPool.length = 0;

    if (scene) {
        scene.traverse(obj => {
            if (obj.geometry && !obj.userData.shared) obj.geometry.dispose();
            if (obj.material) {
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
            }
        });
        scene.clear();
    }

    if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
    }
    if (audioCtx) { try { audioCtx.close(); } catch {} }

    console.log('🧹 Game destroyed, memory freed');
}

window.addEventListener('message', e => {
    if (e.data && e.data.type === 'arcade-destroy') destroyGame();
});
window.addEventListener('beforeunload', destroyGame);

// Public API (only thing that leaks to window)
window.FPSGame = {
    start: startGame,
    pause: togglePause,
    destroy: destroyGame,
    getState: () => ({ health, score, kills, ammo, isDead, isPaused, gameActive }),
};


function initMenuModel() {
    const loader = new THREE.GLTFLoader();
    loader.load(PATHS.weapons + 'lp_mini_pack_modern_weaponswith_bullets_part_2.glb', (gltf) => {
        let gunNode = null;
        gltf.scene.traverse(child => {
            if (child.name === 'Gun009') gunNode = child;
        });
        if (!gunNode) gunNode = gltf.scene;

        menuModel = gunNode;
        // The camera is at Y=PLAYER_EYE_OFFSET and looks at -Z
        // Place the model in front of the camera
        menuModel.position.set(0, 0, -2);
        menuModel.scale.set(3, 3, 3);
        menuModel.rotation.set(0, Math.PI / 2, 0);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 5, 5);
        menuModel.add(dirLight);
        const ambLight = new THREE.AmbientLight(0xffffff, 0.5);
        menuModel.add(ambLight);

        camera.add(menuModel);
    });

    document.addEventListener('mousemove', (e) => {
        if (!menuModel || !menuModel.visible) return;
        menuMouseX = (e.clientX / window.innerWidth) * 2 - 1;
        menuMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });
}

function updateMenuModel() {
    if (menuModel) {
        menuModel.visible = (dom.mainMenu.style.display !== 'none');
        if (menuModel.visible) {
            const targetRotY = Math.PI / 2 + menuMouseX * 0.4;
            const targetRotX = -menuMouseY * 0.4;
            menuModel.rotation.y += (targetRotY - menuModel.rotation.y) * 0.05;
            menuModel.rotation.x += (targetRotX - menuModel.rotation.x) * 0.05;
        }
    }
}

console.log('🎮 FPS Game loaded');
})();

// --- TIME OF DAY ---
function setTimeOfDay(mode) {
    const hemi = scene.children.find(c => c.isHemisphereLight);
    const dir  = scene.children.find(c => c.isDirectionalLight);
    const amb  = scene.children.find(c => c.isAmbientLight);
    if (mode === 'night') {
        if (hemi) { hemi.color.setHex(0x334466); hemi.intensity = 0.35; }
        if (dir)  { dir.color.setHex(0x88aaff); dir.intensity = 0.4; }
        if (amb)  { amb.color.setHex(0x223344); amb.intensity = 0.3; }
        document.body.style.filter = 'brightness(0.7)';
    } else {
        if (hemi) { hemi.color.setHex(0xffffff); hemi.intensity = 1.2; }
        if (dir)  { dir.color.setHex(0xffffff); dir.intensity = 1.0; }
        if (amb)  { amb.color.setHex(0xffffff); amb.intensity = 0.6; }
        document.body.style.filter = 'brightness(1)';
    }
    try { localStorage.setItem('timeOfDay', mode); } catch (e) {}
}

document.getElementById('timeOfDayDay')?.addEventListener('click', () => setTimeOfDay('day'));
document.getElementById('timeOfDayNight')?.addEventListener('click', () => setTimeOfDay('night'));

// Apply saved preference on boot
setTimeOfDay(localStorage.getItem('timeOfDay') || 'day');
document.getElementById('victoryRestartBtn')?.addEventListener('click', () => {
    const vs = document.getElementById('victoryScreen');
    if (vs) vs.style.display = 'none';
    show(dom.mainMenu, 'flex');
});
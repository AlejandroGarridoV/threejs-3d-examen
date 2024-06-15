import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let camera, scene, renderer, stats, object, loader, guiMorphsFolder, controls;
const clock = new THREE.Clock();
let mixer, currentAction, actions = {};
const params = {
    asset: 'Idle'
};

const assets = {
    'Idle': null,
    'Walk': null,
    'Walk Back': null,
    'Left Walk': null,
    'Right Walk': null,
    'Jump': null,
    'kick': null,
    'Throw': null
};

const moveSpeed = 200; // Velocidad de movimiento
const moveDirection = { forward: false, backward: false, left: false, right: false, jump: false };

// Coordenadas únicas del personaje
let characterPosition = { x: 0, z: 0 };

const cubes = []; // Array para almacenar los cubos
let collectedCubes = 0; // Contador de cubos recolectados

init();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(0, 150, 300);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 200, 1000);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff2cf, 10);
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    scene.add(dirLight);

    function flickerLight() {
        const intensity = Math.random() * 30;
        dirLight.intensity = intensity;
        const flickerInterval = Math.random() * 500;
        setTimeout(flickerLight, flickerInterval);
    }

    flickerLight();

    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.MeshPhongMaterial({ color: 0x000000, depthWrite: false }));
    groundMesh.rotation.x = - Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const gridHelper = new THREE.GridHelper(2000, 20, 0xffffff, 0xffffff);
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    loader = new FBXLoader();
    Promise.all([
        preloadAsset('Idle'),
        preloadAsset('Walk'),
        preloadAsset('Walk Back'),
        preloadAsset('Left Walk'),
        preloadAsset('Right Walk'),
        preloadAsset('Jump'),
        preloadAsset('kick'),
        preloadAsset('Throw')
    ]).then(() => {
        loadAsset(params.asset);
    });

    // Crear y añadir 50 cubos
    const numCubes = 50;
    const cubeGeometry = new THREE.BoxGeometry(50, 50, 50);
    const cubeMaterial = new THREE.MeshStandardMaterial({
        color: 0x59f4ff,             // Color base del material
        emissive: 0x59f4ff,          // Color de la emisión de luz
        emissiveIntensity: 0.5       // Intensidad de la emisión de luz
    });
    
    for (let i = 0; i < numCubes; i++) {
        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        const x = (Math.random() - 0.5) * 10000; // Asegúrate de que estén dentro del plano del suelo
        const z = (Math.random() - 0.5) * 10000;
        cube.position.set(x, 25, z); // Posición inicial del cubo
        cube.castShadow = true;
        cube.receiveShadow = true;
        scene.add(cube);
        cubes.push(cube);
        const pointLight = new THREE.PointLight(0x59f4ff, 100);
        cube.add(pointLight); // Agregar la luz como hijo del cubo
    }

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // PointerLockControls
    controls = new PointerLockControls(camera, document.body);

    document.getElementById('instructions').addEventListener('click', function () {
        controls.lock();
    });

    controls.addEventListener('lock', function () {
        document.getElementById('blocker').style.display = 'none';
    });

    controls.addEventListener('unlock', function () {
        document.getElementById('blocker').style.display = 'block';
    });

    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    stats = new Stats();
    container.appendChild(stats.dom);

    const gui = new GUI();
    gui.add(params, 'asset', Object.keys(assets)).onChange(function (value) {
        loadAsset(value);
    });

    guiMorphsFolder = gui.addFolder('Morphs').hide();

    document.addEventListener('keydown', onCtrlKeyDown);

    renderer.domElement.addEventListener('mousedown', onMouseDown);
}

function preloadAsset(asset) {
    return new Promise((resolve, reject) => {
        loader.load('models/fbx/' + asset + '.fbx', function (group) {
            assets[asset] = group;
            resolve();
        }, undefined, function (error) {
            console.error('Error loading asset:', asset, error);
            reject(error);
        });
    });
}

function loadAsset(asset) {
    console.log('Loading asset:', asset);
    if (!assets[asset]) {
        console.error('Asset not preloaded:', asset);
        return;
    }

    const group = assets[asset];

    if (object) {
        object.traverse(function (child) {
            if (child.material) {
                if (child.material.dispose) {
                    child.material.dispose();
                }
                if (child.material.map && child.material.map.dispose) {
                    child.material.map.dispose();
                }
            }
            if (child.geometry && child.geometry.dispose) {
                child.geometry.dispose();
            }
        });
        scene.remove(object);
    }

    object = group;

    if (object.animations && object.animations.length) {
        mixer = new THREE.AnimationMixer(object);
        currentAction = mixer.clipAction(object.animations[0]);
        currentAction.play();
        actions[asset] = currentAction;
    } else {
        mixer = null;
    }

    if (guiMorphsFolder) {
        guiMorphsFolder.children.forEach((child) => child.destroy());
        guiMorphsFolder.hide();
    }

    object.traverse(function (child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.morphTargetDictionary) {
                guiMorphsFolder.show();
                const meshFolder = guiMorphsFolder.addFolder(child.name || child.uuid);
                Object.keys(child.morphTargetDictionary).forEach((key) => {
                    meshFolder.add(child.morphTargetInfluences, child.morphTargetDictionary[key], 0, 1, 0.01);
                });
            }
        }
    });

    scene.add(object);

    // Asegurar que el personaje esté al nivel del suelo al cargar el asset
    if (object) {
        object.position.y = 25; // Ajusta la altura según la geometría del personaje
    }
}

function switchAnimation(newAction) {
    if (currentAction && newAction !== currentAction) {
        currentAction.fadeOut(0.2);
    }
    newAction.reset().fadeIn(0.2).play();
    currentAction = newAction;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onCtrlKeyDown(event) {
    if (event.code === 'ControlLeft') {
        params.asset = 'kick';
        console.log('Switching to kick asset');
        if (!actions['kick']) loadAsset(params.asset);
        else switchAnimation(actions['kick']);

        // Detener el movimiento principal
        stopMainMovement();
    }
}

function onMouseDown(event) {
    if (event.button === 2) { // Botón derecho del ratón
        params.asset = 'Throw';
        console.log('Switching to Throw asset');
        if (!actions['Throw']) loadAsset(params.asset);
        else switchAnimation(actions['Throw']);

        // Detener el movimiento principal
        stopMainMovement();
    }
}

function stopMainMovement() {
    // Detener el movimiento principal si se está ejecutando
    if (params.asset !== 'Idle' && params.asset !== 'kick' && params.asset !== 'Throw') {
        params.asset = 'Idle';
        if (!actions['Idle']) loadAsset(params.asset);
        else switchAnimation(actions['Idle']);
    }
}

function onKeyDown(event) {
    let actionChanged = false;
    switch (event.code) {

        case 'KeyW':
            moveDirection.forward = true;
            if (params.asset !== 'Walk') {
                params.asset = 'Walk';
                actionChanged = true;
            }
            break;

        case 'KeyA':
            moveDirection.left = true;
            if (params.asset !== 'Left Walk') {
                params.asset = 'Left Walk';
                actionChanged = true;
            }
            break;


        case 'KeyS':
            moveDirection.backward = true;
            if (params.asset !== 'Walk Back') {
                params.asset = 'Walk Back';
                actionChanged = true;
            }
            break;


        case 'KeyD':
            moveDirection.right = true;
            if (params.asset !== 'Right Walk') {
                params.asset = 'Right Walk';
                actionChanged = true;
            }
            break;

        case 'Space':
            moveDirection.jump = true;
            if (params.asset !== 'Jump') {
                params.asset = 'Jump';
                actionChanged = true;
            }
            break;
    }

    if (actionChanged) {
        if (!actions[params.asset]) loadAsset(params.asset);
        else switchAnimation(actions[params.asset]);
    }
}

function onKeyUp(event) {
    let stopMovement = false;
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveDirection.forward = false;
            stopMovement = true;
            params.asset = 'Idle';
            break;

        case 'ArrowLeft':
        case 'KeyA':
            moveDirection.left = false;
            stopMovement = true;
            params.asset = 'Idle';
            break;

        case 'ArrowDown':
        case 'KeyS':
            moveDirection.backward = false;
            stopMovement = true;
            params.asset = 'Idle';
            break;

        case 'ArrowRight':
        case 'KeyD':
            moveDirection.right = false;
            stopMovement = true;
            params.asset = 'Idle';
            break;

        case 'Space':
            moveDirection.jump = false;
            stopMovement = true;
            params.asset = 'Idle';
            break;
    }

    if (stopMovement && !moveDirection.forward && !moveDirection.backward && !moveDirection.left && !moveDirection.right && !moveDirection.jump) {
        stopMainMovement();
    }
}

function animate() {
    const delta = clock.getDelta();

    if (mixer) mixer.update(delta);

    // Movimiento de la cámara
    if (controls.isLocked === true) {
        const moveDistance = moveSpeed * delta;

        if (moveDirection.forward) controls.moveForward(moveDistance);
        if (moveDirection.backward) controls.moveForward(-moveDistance);
        if (moveDirection.left) controls.moveRight(-moveDistance);
        if (moveDirection.right) controls.moveRight(moveDistance);

        // Actualizar la posición del personaje para que esté ligeramente a la izquierda de la cámara
        if (object) {
            const offsetDistance = 250; // Ajusta esta distancia según sea necesario
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            const leftOffset = new THREE.Vector3().crossVectors(direction, camera.up).normalize().multiplyScalar(-70); // Ajusta 30 para mover el personaje más o menos a la izquierda
            object.position.copy(camera.position).add(direction.multiplyScalar(offsetDistance)).add(leftOffset);
            object.position.y = 25; // Asegura que el personaje esté a nivel del suelo

            // Asegurar que el personaje siempre le dé la espalda a la cámara
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);
            const angle = Math.atan2(cameraDirection.x, cameraDirection.z);
            object.rotation.y = angle + Math.PI + 160;
        }

        // Actualizar la posición del personaje en el eje x y z
        characterPosition.x = object.position.x;
        characterPosition.z = object.position.z;

        // Colisión con cubos
        cubes.forEach((cube, index) => {
            const distance = Math.sqrt((cube.position.x - characterPosition.x) ** 2 + (cube.position.z - characterPosition.z) ** 2);
            if (distance < 50) { // Supongamos que 50 es la distancia mínima para recoger un cubo
                scene.remove(cube); // Elimina el cubo de la escena
                cubes.splice(index, 1); // Elimina el cubo del array
                collectedCubes++; // Incrementa el contador de cubos recolectados
                document.getElementById('points-counter').innerText = `Cubos recolectados: ${collectedCubes}`; // Actualiza el contador en la interfaz
            }
        });
    }

    renderer.render(scene, camera);
    stats.update();
}

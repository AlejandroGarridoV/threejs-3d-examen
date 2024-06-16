import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let camera, scene, renderer, stats, object, loader, guiMorphsFolder, controls, spotLight;
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

// Crear cuadrícula espacial
const gridSize = 500; // Tamaño de cada celda de la cuadrícula
const spatialGrid = {};

init();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(0, 150, 300);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 300, 1000);

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
        const intensity = Math.random() * 0.5;
        dirLight.intensity = intensity;
        const flickerInterval = Math.random() * 500;
        setTimeout(flickerLight, flickerInterval);
    }

    flickerLight();

    // Crear la luz del foco (linterna) y agregarla a la cámara
    spotLight = new THREE.SpotLight(0xffffff);
    spotLight.angle = Math.PI / 6; // Ajusta el ángulo del cono de luz
    spotLight.penumbra = 0.1; // Ajusta la penumbra (borde suave)
    spotLight.intensity = 2; // Ajusta la intensidad de la luz
    spotLight.distance = 1000; // Ajusta la distancia máxima del alcance de la luz
    spotLight.position.set(0, 0, 0);
    spotLight.target.position.set(0, 0, -1); // La luz apunta hacia adelante
    camera.add(spotLight);
    camera.add(spotLight.target);

    // Cargar la textura del suelo
    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load('textures/suelo/piso.jpg');
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(100, 100);

    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.MeshPhongMaterial({ map: groundTexture, depthWrite: false }));
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

    // Cargar la textura para los cubos
    const cubeTexture = textureLoader.load('textures/caja.gif');

    // Crear y añadir 50 cubos
    const numCubes = 50;
    const cubeGeometry = new THREE.BoxGeometry(50, 50, 50);
    const cubeMaterial = new THREE.MeshStandardMaterial({
        map: cubeTexture,
        
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

        // Añadir cubo a la cuadrícula espacial
        const gridX = Math.floor(x / gridSize);
        const gridZ = Math.floor(z / gridSize);
        const key = `${gridX},${gridZ}`;
        if (!spatialGrid[key]) {
            spatialGrid[key] = [];
        }
        spatialGrid[key].push(cube);
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
        }
    });

    scene.add(object);

    // Posicionar el objeto en la posición actual del personaje
    object.position.set(characterPosition.x, 0, characterPosition.z);

    if (mixer && object.animations && object.animations.length) {
        const morphs = object.animations[0].tracks.filter(track => track.name.includes('morphTargetInfluences'));
        if (morphs.length) {
            guiMorphsFolder.show();
            morphs.forEach(morph => {
                guiMorphsFolder.add(morph, 'value', 0, 1, 0.01).name(morph.name.split('.')[2]);
            });
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    switch (event.keyCode) {
        case 38: // up
        case 87: // w
            moveDirection.forward = true;
            break;
        case 37: // left
        case 65: // a
            moveDirection.left = true;
            break;
        case 40: // down
        case 83: // s
            moveDirection.backward = true;
            break;
        case 39: // right
        case 68: // d
            moveDirection.right = true;
            break;
        case 32: // space (saltará)
            moveDirection.jump = true;
            break;
    }
}

function onKeyUp(event) {
    switch (event.keyCode) {
        case 38: // up
        case 87: // w
            moveDirection.forward = false;
            break;
        case 37: // left
        case 65: // a
            moveDirection.left = false;
            break;
        case 40: // down
        case 83: // s
            moveDirection.backward = false;
            break;
        case 39: // right
        case 68: // d
            moveDirection.right = false;
            break;
        case 32: // space (dejará de saltar)
            moveDirection.jump = false;
            break;
    }
}

function onCtrlKeyDown(event) {
    if (event.ctrlKey) {
        switch (event.keyCode) {
            case 65: // Ctrl + A
                performAction('kick');
                break;
            case 83: // Ctrl + S
                performAction('Throw');
                break;
        }
    }
}

function onMouseDown(event) {
    if (event.button === 0) {
        performAction('kick');
    }
}

function performAction(actionName) {
    if (currentAction) {
        currentAction.stop();
    }
    currentAction = mixer.clipAction(assets[actionName].animations[0]);
    currentAction.reset();
    currentAction.play();
    actions[actionName] = currentAction;
}

function animate() {
    const delta = clock.getDelta();

    if (mixer) mixer.update(delta);

    // Actualizar la posición del personaje
    const moveX = (moveDirection.left ? -1 : 0) + (moveDirection.right ? 1 : 0);
    const moveZ = (moveDirection.forward ? -1 : 0) + (moveDirection.backward ? 1 : 0);

    // Ajustar la posición en el plano XZ
    characterPosition.x += moveX * moveSpeed * delta;
    characterPosition.z += moveZ * moveSpeed * delta;

    // Mover el objeto en la escena
    if (object) {
        object.position.x = characterPosition.x;
        object.position.z = characterPosition.z;
    }

    // Actualizar la posición de la cámara
    if (camera) {
        camera.position.x = characterPosition.x;
        camera.position.z = characterPosition.z;
    }

    // Comprobar colisiones con los cubos
    for (let i = 0; i < cubes.length; i++) {
        const cube = cubes[i];
        const distance = object.position.distanceTo(cube.position);

        if (distance < 50) { // Si la distancia es menor que 50 (radio del personaje + radio del cubo)
            scene.remove(cube);
            cubes.splice(i, 1); // Eliminar el cubo del array
            i--; // Ajustar el índice para el siguiente bucle
            collectedCubes++; // Incrementar el contador de cubos recolectados
            console.log('Cubos recolectados:', collectedCubes);
        }
    }

    // Renderizar la escena y actualizar los controles
    renderer.render(scene, camera);
    controls.update(delta);
    stats.update();
}

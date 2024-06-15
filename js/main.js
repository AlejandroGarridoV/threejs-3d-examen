import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer, stats, object, loader, guiMorphsFolder;
const clock = new THREE.Clock();
let mixer;
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

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.05);
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
    const cubeMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });

    for (let i = 0; i < numCubes; i++) {
        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        const x = (Math.random() - 0.5) * 10000; // Asegúrate de que estén dentro del plano del suelo
        const z = (Math.random() - 0.5) * 10000;
        cube.position.set(x, 25, z); // Posición inicial del cubo
        cube.castShadow = true;
        cube.receiveShadow = true;
        scene.add(cube);
        cubes.push(cube);
    }

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

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
        const action = mixer.clipAction(object.animations[0]);
        action.play();
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
        loadAsset(params.asset);
        
        // Detener el movimiento principal
        stopMainMovement();
    }
}

function onMouseDown(event) {
    if (event.button === 1) { // Botón derecho del ratón
        params.asset = 'Throw';
        console.log('Switching to Throw asset');
        loadAsset(params.asset);
        
        // Detener el movimiento principal
        stopMainMovement();
    }
}

function stopMainMovement() {
    // Detener el movimiento principal si se está ejecutando
    if (params.asset !== 'Idle' && params.asset !== 'kick' && params.asset !== 'Throw') {
        params.asset = 'Idle';
        console.log('Switching to Idle asset');
        loadAsset(params.asset);
    }
}

function onKeyDown(event) {
    switch (event.code) {
        case 'KeyS':
            moveDirection.forward = true;
            if (params.asset !== 'Walk Back') {
                params.asset = 'Walk Back';
                console.log('Switching to Walk Back asset');
                loadAsset(params.asset);
            }
            break;
        case 'KeyW':
            moveDirection.backward = true;
            if (params.asset !== 'Walk') {
                params.asset = 'Walk';
                console.log('Switching to Walk asset');
                loadAsset(params.asset);
            }
            break;
        case 'KeyA':
            moveDirection.right = true;
            if (params.asset !== 'Left Walk') {
                params.asset = 'Left Walk';
                console.log('Switching to Left Walk asset');
                loadAsset(params.asset);
            }
            break;
        case 'KeyD':
            moveDirection.left = true;
            if (params.asset !== 'Right Walk') {
                params.asset = 'Right Walk';
                console.log('Switching to Right Walk asset');
                loadAsset(params.asset);
            }
            break;
        case 'Space':
            moveDirection.jump = true;
            if (params.asset !== 'Jump') {
                params.asset = 'Jump';
                console.log('Switching to Jump asset');
                loadAsset(params.asset);
            }
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyS':
            moveDirection.forward = false;
            break;
        case 'KeyW':
            moveDirection.backward = false;
            break;
        case 'KeyA':
            moveDirection.right = false;
            break;
        case 'KeyD':
            moveDirection.left = false;
            break;
        case 'Space':
            moveDirection.jump = false;
            break;
    }
    if (!moveDirection.forward && !moveDirection.backward && !moveDirection.left && !moveDirection.right && !moveDirection.jump) {
        if (params.asset !== 'Idle' && params.asset !== 'kick' && params.asset !== 'Throw') {
            params.asset = 'Idle';
            console.log('Switching to Idle asset');
            loadAsset(params.asset);
        }
    }
}

function animate() {
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    if (object) {
        // Actualizar la posición del personaje
        if (moveDirection.left) {
            characterPosition.x -= moveSpeed * delta;
        }
        if (moveDirection.right) {
            characterPosition.x += moveSpeed * delta;
        }
        if (moveDirection.forward) {
            characterPosition.z -= moveSpeed * delta;
        }
        if (moveDirection.backward) {
            characterPosition.z += moveSpeed * delta;
        }

        // Limitar el movimiento del personaje dentro del mundo (opcional)
        const maxX = 20000; // Límite máximo en el eje X
        const minX = -20000; // Límite mínimo en el eje X
        const maxZ = 20000; // Límite máximo en el eje Z
        const minZ = -20000; // Límite mínimo en el eje Z

        // Aplicar los límites
        characterPosition.x = THREE.MathUtils.clamp(characterPosition.x, minX, maxX);
        characterPosition.z = THREE.MathUtils.clamp(characterPosition.z, minZ, maxZ);

        // Aplicar la posición al objeto en la escena
        object.position.set(characterPosition.x, 0, characterPosition.z);

        // Ajustar la posición de la cámara respecto al personaje
        const cameraOffset = new THREE.Vector3(-70, 130, -300);  // Ajustar según el personaje
        const lookAtOffset = new THREE.Vector3(0, 100, 100);    // Punto de mira del personaje

        const position = new THREE.Vector3();
        position.copy(object.position).add(cameraOffset);
        camera.position.copy(position);

        const lookAtPosition = new THREE.Vector3();
        lookAtPosition.copy(object.position).add(lookAtOffset);
        camera.lookAt(lookAtPosition);

        // Detectar colisión con los cubos
        cubes.forEach((cube, index) => {
            if (object.position.distanceTo(cube.position) < 50) {
                console.log('¡Colisión con el cubo!');
                
                // Eliminar el cubo visualmente
                scene.remove(cube);
                cubes.splice(index, 1);  // Eliminar el cubo del array

                // También podrías liberar recursos del cubo si es necesario
                cube.geometry.dispose();
                cube.material.dispose();

                // Incrementar el contador de cubos recolectados
                collectedCubes++;
                document.getElementById('points-counter').innerText = `Cubos recolectados: ${collectedCubes}`;

                // Otras acciones que desees realizar al colisionar con el cubo
                // Por ejemplo, cambiar el color del cubo o reproducir un efecto de sonido
            }
        });
    }

    renderer.render(scene, camera);
    stats.update();
}

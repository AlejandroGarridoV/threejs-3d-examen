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
    'Left Walk': null,  // Agregar animación "Left Walk"
    'Right Walk': null, // Agregar animación "Right Walk"
    'Jump': null        // Agregar animación "Jump"
};

const moveSpeed = 100; // Velocidad de movimiento
const moveDirection = { forward: false, backward: false, left: false, right: false, jump: false };

init();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(0, 150, 300);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);  // Color de fondo negro
    scene.fog = new THREE.Fog(0x000000, 200, 1000);  // Fog de color negro

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.05);  // Desactivar luz ambiental
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 10);
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

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshPhongMaterial({ color: 0x000000, depthWrite: false }));  // Suelo de color negro
    mesh.rotation.x = - Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const grid = new THREE.GridHelper(2000, 20, 0xffffff, 0xffffff);  // Grid de color blanco
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);

    loader = new FBXLoader();
    Promise.all([
        preloadAsset('Idle'),
        preloadAsset('Walk'),
        preloadAsset('Walk Back'),  // Agregar precarga para 'Walk Back'
        preloadAsset('Left Walk'),  // Pre-cargar animación "Left Walk"
        preloadAsset('Right Walk'), // Pre-cargar animación "Right Walk"
        preloadAsset('Jump')        // Pre-cargar animación "Jump"
    ]).then(() => {
        loadAsset(params.asset);
    });
    

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

function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW':
            moveDirection.forward = true;
            if (params.asset !== 'Walk') {
                params.asset = 'Walk';
                console.log('Switching to Walk asset');
                loadAsset(params.asset);
            }
            break;
        case 'KeyS':
            moveDirection.backward = true;
            if (params.asset !== 'Walk Back') {
                params.asset = 'Walk Back';
                console.log('Switching to Walk Back asset');
                loadAsset(params.asset);
            }
            break;
        case 'KeyA':
            moveDirection.left = true;
            if (params.asset !== 'Left Walk') {
                params.asset = 'Left Walk';
                console.log('Switching to Left Walk asset');
                loadAsset(params.asset);
            }
            break;
        case 'KeyD':
            moveDirection.right = true;
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
        case 'KeyW':
            moveDirection.forward = false;
            if (params.asset !== 'Idle') {
                params.asset = 'Idle';
                console.log('Switching to Idle asset');
                loadAsset(params.asset);
            }
            break;
        case 'KeyS':
            moveDirection.backward = false;
            if (params.asset !== 'Idle') {
                params.asset = 'Idle';
                console.log('Switching to Idle asset');
                loadAsset(params.asset);
            }
            break;
        case 'KeyA':
            moveDirection.left = false;
            if (params.asset !== 'Idle') {
                params.asset = 'Idle';
                console.log('Switching to Idle asset');
                loadAsset(params.asset);
            }
            break;
        case 'KeyD':
            moveDirection.right = false;
            if (params.asset !== 'Idle') {
                params.asset = 'Idle';
                console.log('Switching to Idle asset');
                loadAsset(params.asset);
            }
            break;
        case 'Space':
            moveDirection.jump = false;
            if (params.asset !== 'Idle') {
                params.asset = 'Idle';
                console.log('Switching to Idle asset');
                loadAsset(params.asset);
            }
            break;
    }
}

function animate() {
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    // Verificar si object está definido
    if (object) {
        // Guardar la posición actual antes de aplicar el movimiento
        const originalPosition = object.position.clone();

        // Mover el personaje
        if (moveDirection.forward) {
            object.translateZ(-moveSpeed * delta);  // Movimiento hacia adelante (negativo en Z)
        }
        if (moveDirection.backward) {
            object.translateZ(moveSpeed * delta);   // Movimiento hacia atrás (positivo en Z)
        }
        if (moveDirection.left) {
            object.translateX(-moveSpeed * delta);  // Movimiento hacia la izquierda
        }
        if (moveDirection.right) {
            object.translateX(moveSpeed * delta);   // Movimiento hacia la derecha
        }

        // Ajustar la posición de la cámara en base a la nueva posición del objeto
        const cameraOffset = new THREE.Vector3(-70, 130, -300);  // Ajustar según el personaje
        const lookAtOffset = new THREE.Vector3(0, 100, 100);    // Punto de mira del personaje

        const position = new THREE.Vector3();
        position.copy(object.position).add(cameraOffset);
        camera.position.copy(position);       

        const lookAtPosition = new THREE.Vector3();
        lookAtPosition.copy(object.position).add(lookAtOffset);
        camera.lookAt(lookAtPosition);

        // Restaurar la posición original del objeto si ha cambiado
        if (!originalPosition.equals(object.position)) {
            object.position.copy(originalPosition);
        }
    }

    renderer.render(scene, camera);
    stats.update();
}

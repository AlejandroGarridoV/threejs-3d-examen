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

const assets = [
    'Idle',
    'Walk'
];

const moveSpeed = 100; // Velocidad de movimiento
const moveDirection = { forward: false, backward: false, left: false, right: false };

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
    loadAsset(params.asset);

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
    gui.add(params, 'asset', assets).onChange(function (value) {
        loadAsset(value);
    });

    guiMorphsFolder = gui.addFolder('Morphs').hide();
}

function loadAsset(asset) {
    console.log('Loading asset:', asset);
    loader.load('models/fbx/' + asset + '.fbx', function (group) {
        console.log('Asset loaded:', asset);
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
    }, undefined, function (error) {
        console.error('Error loading asset:', asset, error);
    });
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
            break;
        case 'KeyA':
            moveDirection.right = true;
            break;
        case 'KeyD':
            moveDirection.left = true;
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
            break;
        case 'KeyA':
            moveDirection.right = false;
            break;
        case 'KeyD':
            moveDirection.left = false;
            break;
    }
}

function animate() {
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    // Mover el personaje
    if (object) {
        if (moveDirection.forward) object.position.z += moveSpeed * delta;
        if (moveDirection.backward) object.position.z -= moveSpeed * delta;
        if (moveDirection.left) object.position.x -= moveSpeed * delta;
        if (moveDirection.right) object.position.x += moveSpeed * delta;

        // Ajustar la posición de la cámara para mirar por encima del hombro
        const cameraOffset = new THREE.Vector3(-70, 130, -300);  // Offset desde el objeto (ajustar según la altura del personaje)
        const lookAtOffset = new THREE.Vector3(0, 100, 100);   // Punto al que miran los ojos del personaje

        // Posición de la cámara
        const position = new THREE.Vector3();
        position.copy(object.position).add(cameraOffset);
        camera.position.copy(position);

        // Punto de mira de la cámara (donde apuntan los ojos del personaje)
        const lookAtPosition = new THREE.Vector3();
        lookAtPosition.copy(object.position).add(lookAtOffset);
        camera.lookAt(lookAtPosition);
    }

    renderer.render(scene, camera);
    stats.update();
}

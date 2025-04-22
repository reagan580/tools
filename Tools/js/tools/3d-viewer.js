// State management for the 3D viewer
class ViewerState {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.orbitControls = null;
        this.transformControls = null;
        this.selectedObject = null;
        this.materials = new Map();
        this.textures = new Map();
        this.history = [];
        this.historyIndex = -1;
        this.settings = {
            grid: true,
            axes: true,
            shadows: true,
            viewCube: true,
            backgroundColor: '#1e1e1e'
        };
    }
}

class ModelViewer {
    constructor() {
        this.state = new ViewerState();
        this.domElements = {};
        this.isPlaying = false;
        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    }

    // Initialize the 3D viewer
    async initialize() {
        this.initializeDomElements();
        this.initializeScene();
        this.initializeCamera();
        this.initializeRenderer();
        this.initializeControls();
        this.initializeLights();
        this.initializeHelpers();
        this.setupEventListeners();
        this.animate();

        // Load default environment map
        await this.loadEnvironmentMap();
    }

    // Initialize DOM element references
    initializeDomElements() {
        this.domElements = {
            viewport: document.querySelector('.viewport'),
            canvas: document.getElementById('viewportCanvas'),
            hierarchyTree: document.querySelector('.hierarchy-tree'),
            propertiesPanel: document.querySelector('.properties-content'),
            materialsList: document.querySelector('.materials-list'),
            texturesList: document.querySelector('.textures-list'),
            transformInputs: {
                position: document.querySelectorAll('.position-x, .position-y, .position-z'),
                rotation: document.querySelectorAll('.rotation-x, .rotation-y, .rotation-z'),
                scale: document.querySelectorAll('.scale-x, .scale-y, .scale-z')
            }
        };
    }

    // Initialize Three.js scene
    initializeScene() {
        this.state.scene = new THREE.Scene();
        this.state.scene.background = new THREE.Color(this.state.settings.backgroundColor);
    }

    // Initialize camera
    initializeCamera() {
        const aspect = this.domElements.viewport.clientWidth / this.domElements.viewport.clientHeight;
        this.state.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.state.camera.position.set(5, 5, 5);
        this.state.camera.lookAt(0, 0, 0);
    }

    // Initialize renderer
    initializeRenderer() {
        this.state.renderer = new THREE.WebGLRenderer({
            canvas: this.domElements.canvas,
            antialias: true
        });
        this.state.renderer.setSize(this.domElements.viewport.clientWidth, this.domElements.viewport.clientHeight);
        this.state.renderer.shadowMap.enabled = true;
        this.state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // Initialize controls
    initializeControls() {
        // Orbit controls for camera movement
        this.state.orbitControls = new THREE.OrbitControls(this.state.camera, this.domElements.canvas);
        this.state.orbitControls.enableDamping = true;
        this.state.orbitControls.dampingFactor = 0.05;

        // Transform controls for object manipulation
        this.state.transformControls = new THREE.TransformControls(this.state.camera, this.domElements.canvas);
        this.state.scene.add(this.state.transformControls);

        // Disable orbit controls when using transform controls
        this.state.transformControls.addEventListener('dragging-changed', (event) => {
            this.state.orbitControls.enabled = !event.value;
        });
    }

    // Initialize scene lighting
    initializeLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.state.scene.add(ambientLight);

        // Directional light with shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.state.scene.add(directionalLight);
    }

    // Initialize scene helpers
    initializeHelpers() {
        // Grid helper
        const gridHelper = new THREE.GridHelper(20, 20);
        gridHelper.visible = this.state.settings.grid;
        this.state.scene.add(gridHelper);

        // Axes helper
        const axesHelper = new THREE.AxesHelper(5);
        axesHelper.visible = this.state.settings.axes;
        this.state.scene.add(axesHelper);
    }

    // Load environment map
    async loadEnvironmentMap() {
        const pmremGenerator = new THREE.PMREMGenerator(this.state.renderer);
        pmremGenerator.compileEquirectangularShader();

        try {
            const texture = await new THREE.TextureLoader().loadAsync('assets/environment/studio.hdr');
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            this.state.scene.environment = envMap;
            texture.dispose();
            pmremGenerator.dispose();
        } catch (error) {
            console.error('Failed to load environment map:', error);
        }
    }

    // Import 3D model
    async importModel(file, options = {}) {
        const extension = file.name.split('.').pop().toLowerCase();
        let loader;

        switch (extension) {
            case 'gltf':
            case 'glb':
                loader = new THREE.GLTFLoader();
                break;
            case 'obj':
                loader = new THREE.OBJLoader();
                break;
            case 'fbx':
                loader = new THREE.FBXLoader();
                break;
            default:
                throw new Error(`Unsupported file format: ${extension}`);
        }

        try {
            const url = URL.createObjectURL(file);
            const result = await new Promise((resolve, reject) => {
                loader.load(url, resolve, undefined, reject);
            });

            const model = extension === 'gltf' || extension === 'glb' ? result.scene : result;

            // Apply import options
            if (options.scale) {
                model.scale.setScalar(options.scale);
            }

            this.state.scene.add(model);
            this.updateHierarchy();
            URL.revokeObjectURL(url);

            return model;
        } catch (error) {
            console.error('Error importing model:', error);
            throw error;
        }
    }

    // Export 3D model
    async exportModel(format, options = {}) {
        // Implementation depends on the export format
        // This is a placeholder for the export functionality
        console.log('Export model:', format, options);
    }

    // Update scene hierarchy display
    updateHierarchy() {
        const template = document.getElementById('hierarchyItemTemplate');
        this.domElements.hierarchyTree.innerHTML = '';

        const createHierarchyItem = (object) => {
            const item = template.content.cloneNode(true);
            const itemElement = item.querySelector('.hierarchy-item');
            
            itemElement.querySelector('.item-name').textContent = object.name || 'Untitled';
            itemElement.dataset.uuid = object.uuid;

            if (object.children.length > 0) {
                const childrenContainer = itemElement.querySelector('.item-children');
                object.children.forEach(child => {
                    childrenContainer.appendChild(createHierarchyItem(child));
                });
            }

            return itemElement;
        };

        this.state.scene.children.forEach(object => {
            if (object.type !== 'Helper') {
                this.domElements.hierarchyTree.appendChild(createHierarchyItem(object));
            }
        });
    }

    // Update properties panel for selected object
    updateProperties() {
        if (!this.state.selectedObject) return;

        const position = this.state.selectedObject.position;
        const rotation = this.state.selectedObject.rotation;
        const scale = this.state.selectedObject.scale;

        // Update transform inputs
        this.domElements.transformInputs.position.forEach((input, index) => {
            input.value = [position.x, position.y, position.z][index];
        });

        this.domElements.transformInputs.rotation.forEach((input, index) => {
            input.value = THREE.MathUtils.radToDeg([rotation.x, rotation.y, rotation.z][index]);
        });

        this.domElements.transformInputs.scale.forEach((input, index) => {
            input.value = [scale.x, scale.y, scale.z][index];
        });
    }

    // Handle object selection
    selectObject(object) {
        if (this.state.selectedObject === object) return;

        this.state.selectedObject = object;
        if (object) {
            this.state.transformControls.attach(object);
        } else {
            this.state.transformControls.detach();
        }

        this.updateProperties();
    }

    // Setup event listeners
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => {
            const width = this.domElements.viewport.clientWidth;
            const height = this.domElements.viewport.clientHeight;

            this.state.camera.aspect = width / height;
            this.state.camera.updateProjectionMatrix();
            this.state.renderer.setSize(width, height);
        });

        // Mouse events for object selection
        this.domElements.canvas.addEventListener('pointerdown', (event) => {
            event.preventDefault();

            const rect = this.domElements.canvas.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.state.camera);
            const intersects = this.raycaster.intersectObjects(this.state.scene.children, true);

            if (intersects.length > 0) {
                this.selectObject(intersects[0].object);
            } else {
                this.selectObject(null);
            }
        });

        // Transform control events
        this.domElements.transformInputs.position.forEach((input, index) => {
            input.addEventListener('change', () => {
                if (!this.state.selectedObject) return;
                const value = parseFloat(input.value);
                this.state.selectedObject.position[['x', 'y', 'z'][index]] = value;
            });
        });

        this.domElements.transformInputs.rotation.forEach((input, index) => {
            input.addEventListener('change', () => {
                if (!this.state.selectedObject) return;
                const value = THREE.MathUtils.degToRad(parseFloat(input.value));
                this.state.selectedObject.rotation[['x', 'y', 'z'][index]] = value;
            });
        });

        this.domElements.transformInputs.scale.forEach((input, index) => {
            input.addEventListener('change', () => {
                if (!this.state.selectedObject) return;
                const value = parseFloat(input.value);
                this.state.selectedObject.scale[['x', 'y', 'z'][index]] = value;
            });
        });
    }

    // Animation loop
    animate() {
        requestAnimationFrame(() => this.animate());

        this.state.orbitControls.update();

        if (this.isPlaying) {
            const delta = this.clock.getDelta();
            // Update animations if any
            // TODO: Implement animation system
        }

        this.state.renderer.render(this.state.scene, this.state.camera);
    }

    // Add object to scene
    addObject(type) {
        let geometry, material, object;

        switch (type) {
            case 'box':
                geometry = new THREE.BoxGeometry();
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(0.5, 32, 32);
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
                break;
            default:
                return;
        }

        material = new THREE.MeshStandardMaterial({ color: 0x808080 });
        object = new THREE.Mesh(geometry, material);
        object.castShadow = true;
        object.receiveShadow = true;

        this.state.scene.add(object);
        this.updateHierarchy();
        this.selectObject(object);
    }

    // Save scene state
    saveState() {
        const state = {
            objects: [],
            camera: {
                position: this.state.camera.position.toArray(),
                rotation: this.state.camera.rotation.toArray()
            }
        };

        this.state.scene.traverse((object) => {
            if (object.type === 'Mesh') {
                state.objects.push({
                    type: object.type,
                    geometry: object.geometry.toJSON(),
                    material: object.material.toJSON(),
                    position: object.position.toArray(),
                    rotation: object.rotation.toArray(),
                    scale: object.scale.toArray()
                });
            }
        });

        return state;
    }

    // Load scene state
    loadState(state) {
        // Clear current scene
        while (this.state.scene.children.length > 0) {
            this.state.scene.remove(this.state.scene.children[0]);
        }

        // Restore camera
        this.state.camera.position.fromArray(state.camera.position);
        this.state.camera.rotation.fromArray(state.camera.rotation);

        // Restore objects
        state.objects.forEach(objectState => {
            const geometry = new THREE.BufferGeometry();
            geometry.fromJSON(objectState.geometry);

            const material = new THREE.MeshStandardMaterial();
            material.fromJSON(objectState.material);

            const object = new THREE.Mesh(geometry, material);
            object.position.fromArray(objectState.position);
            object.rotation.fromArray(objectState.rotation);
            object.scale.fromArray(objectState.scale);

            this.state.scene.add(object);
        });

        this.updateHierarchy();
    }
}

// Initialize the viewer when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const viewer = new ModelViewer();
    viewer.initialize().catch(console.error);
}); 
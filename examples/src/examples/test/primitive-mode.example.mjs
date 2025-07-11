// @config DESCRIPTION This example demonstrates the clear coat material. Visually, the Coated column should contain highlights from both the Base and Boating layers.
// @config HIDDEN
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbitCamera: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/morning-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new pc.Asset('model', 'container', { url: `${rootPath}/static/assets/models/PrimitiveModeNormalsTest.glb` })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Setup skydome
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxIntensity = 1;

    const testEntity = assets.model.resource.instantiateRenderEntity();
    testEntity.setLocalEulerAngles(0, 90, 0);
    app.root.addChild(testEntity);

    // Create a camera with an orbit camera script
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        toneMapping: pc.TONEMAP_ACES
    });
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);
    camera.script.orbitCamera.yaw = 90;
    camera.script.orbitCamera.distance = 25;

    const directionalLight = new pc.Entity();
    directionalLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.YELLOW,
        castShadows: false,
        intensity: 1
    });
    directionalLight.setEulerAngles(45, 180, 0);
    app.root.addChild(directionalLight);
});

export { app };

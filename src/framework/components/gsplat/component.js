import { LAYERID_WORLD } from '../../../scene/constants.js';
import { GSplatInstance } from '../../../scene/gsplat/gsplat-instance.js';
import { Asset } from '../../asset/asset.js';
import { AssetReference } from '../../asset/asset-reference.js';
import { Component } from '../component.js';
import { Debug } from '../../../core/debug.js';
import { GSplatPlacement } from '../../../scene/gsplat/unified/gsplat-placement.js';

/**
 * @import { BoundingBox } from '../../../core/shape/bounding-box.js'
 * @import { Entity } from '../../entity.js'
 * @import { EventHandle } from '../../../core/event-handle.js'
 * @import { GSplatComponentSystem } from './system.js'
 * @import { ShaderMaterial } from '../../../scene/materials/shader-material.js'
 */

/**
 * The GSplatComponent enables an {@link Entity} to render 3D Gaussian Splats. Splats are always
 * loaded from {@link Asset}s rather than being created programmatically. The asset type is
 * `gsplat` which are in the `.ply` file format.
 *
 * You should never need to use the GSplatComponent constructor directly. To add an
 * GSplatComponent to an {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * const entity = pc.Entity();
 * entity.addComponent('gsplat', {
 *     asset: asset
 * });
 * ```
 *
 * Once the GSplatComponent is added to the entity, you can access it via the {@link Entity#gsplat}
 * property:
 *
 * ```javascript
 * entity.gsplat.customAabb = new pc.BoundingBox(new pc.Vec3(), new pc.Vec3(10, 10, 10));
 *
 * console.log(entity.gsplat.customAabb);
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Loading a Splat](https://playcanvas.github.io/#/gaussian-splatting/simple)
 * - [Custom Splat Shaders](https://playcanvas.github.io/#/gaussian-splatting/multi-splat)
 * - [Splat picking](https://playcanvas.github.io/#/gaussian-splatting/picking)
 *
 * @hideconstructor
 * @category Graphics
 */
class GSplatComponent extends Component {
    /** @private */
    _layers = [LAYERID_WORLD]; // assign to the default world layer

    /**
     * @type {GSplatInstance|null}
     * @private
     */
    _instance = null;

    /**
     * @type {GSplatPlacement|null}
     * @private
     */
    _placement = null;

    /**
     * @type {ShaderMaterial|null}
     * @private
     */
    _materialTmp = null;

    /** @private */
    _highQualitySH = true;

    /**
     * @type {BoundingBox|null}
     * @private
     */
    _customAabb = null;

    /**
     * @type {AssetReference}
     * @private
     */
    _assetReference;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtLayersChanged = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtLayerAdded = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtLayerRemoved = null;

    /** @private */
    _castShadows = false;

    /**
     * Whether to use the unified gsplat rendering.
     *
     * @type {boolean}
     * @private
     */
    _unified = false;

    /**
     * Create a new GSplatComponent.
     *
     * @param {GSplatComponentSystem} system - The ComponentSystem that created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        // gsplat asset reference
        this._assetReference = new AssetReference(
            'asset',
            this,
            system.app.assets, {
                add: this._onGSplatAssetAdded,
                load: this._onGSplatAssetLoad,
                remove: this._onGSplatAssetRemove,
                unload: this._onGSplatAssetUnload
            },
            this
        );

        // handle events when the entity is directly (or indirectly as a child of sub-hierarchy)
        // added or removed from the parent
        entity.on('remove', this.onRemoveChild, this);
        entity.on('removehierarchy', this.onRemoveChild, this);
        entity.on('insert', this.onInsertChild, this);
        entity.on('inserthierarchy', this.onInsertChild, this);
    }

    /**
     * Sets a custom object space bounding box for visibility culling of the attached gsplat.
     *
     * @type {BoundingBox|null}
     */
    set customAabb(value) {
        this._customAabb = value;

        // set it on meshInstance
        this._instance?.meshInstance?.setCustomAabb(this._customAabb);
    }

    /**
     * Gets the custom object space bounding box for visibility culling of the attached gsplat.
     *
     * @type {BoundingBox|null}
     */
    get customAabb() {
        return this._customAabb;
    }

    /**
     * Sets a {@link GSplatInstance} on the component. If not set or loaded, it returns null.
     *
     * @type {GSplatInstance|null}
     * @ignore
     */
    set instance(value) {

        Debug.assert(!this.unified);

        // destroy existing instance
        this.destroyInstance();

        this._instance = value;

        if (this._instance) {

            // if mesh instance was created without a node, assign it here
            const mi = this._instance.meshInstance;
            if (!mi.node) {
                mi.node = this.entity;
            }
            mi.castShadow = this._castShadows;
            mi.setCustomAabb(this._customAabb);

            if (this.enabled && this.entity.enabled) {
                this.addToLayers();
            }
        }
    }

    /**
     * Gets the {@link GSplatInstance} on the component.
     *
     * @type {GSplatInstance|null}
     * @ignore
     */
    get instance() {
        return this._instance;
    }

    /**
     * Sets the material used to render the gsplat.
     *
     * @param {ShaderMaterial} value - The material instance.
     */
    set material(value) {

        Debug.assert(!this.unified);

        if (this._instance) {
            this._instance.material = value;
        } else {
            this._materialTmp = value;
        }
    }

    /**
     * Gets the material used to render the gsplat.
     *
     * @type {ShaderMaterial|null}
     */
    get material() {
        return this._instance?.material ?? this._materialTmp ?? null;
    }

    /**
     * Sets whether to use the high quality or the approximate (but fast) spherical-harmonic calculation when rendering SOGS data.
     *
     * The low quality approximation evaluates the scene's spherical harmonic contributions
     * along the camera's Z-axis instead of using each gaussian's view vector. This results
     * in gaussians being accurate at the center of the screen and becoming less accurate
     * as they appear further from the center. This is a good trade-off for performance
     * when rendering large SOGS datasets, especially on mobile devices.
     *
     * Defaults to false.
     *
     * @type {boolean}
     */
    set highQualitySH(value) {
        if (value !== this._highQualitySH) {
            this._highQualitySH = value;
            this._instance?.setHighQualitySH(value);
        }
    }

    /**
     * Gets whether the high quality (true) or the fast approximate (false) spherical-harmonic calculation is used when rendering SOGS data.
     *
     * @type {boolean}
     */
    get highQualitySH() {
        return this._highQualitySH;
    }

    /**
     * Sets whether gsplat will cast shadows for lights that have shadow casting enabled. Defaults
     * to false.
     *
     * @type {boolean}
     */
    set castShadows(value) {

        if (this._castShadows !== value) {

            const mi = this.instance?.meshInstance;

            if (mi) {
                const layers = this.layers;
                const scene = this.system.app.scene;
                if (this._castShadows && !value) {
                    for (let i = 0; i < layers.length; i++) {
                        const layer = scene.layers.getLayerById(this.layers[i]);
                        if (layer) {
                            layer.removeShadowCasters([mi]);
                        }
                    }
                }

                mi.castShadow = value;

                if (!this._castShadows && value) {
                    for (let i = 0; i < layers.length; i++) {
                        const layer = scene.layers.getLayerById(layers[i]);
                        if (layer) {
                            layer.addShadowCasters([mi]);
                        }
                    }
                }
            }

            this._castShadows = value;
        }
    }

    /**
     * Gets whether gsplat will cast shadows for lights that have shadow casting enabled.
     *
     * @type {boolean}
     */
    get castShadows() {
        return this._castShadows;
    }

    /**
     * Sets whether to use the unified gsplat rendering. Can be changed only when the component is
     * not enabled. Default is false.
     *
     * @type {boolean}
     */
    set unified(value) {

        if (this.enabled && this.entity.enabled) {
            Debug.warn('GSplatComponent#unified can be changed only when the component is not enabled. Ignoring change.');
            return;
        }

        this._unified = value;
    }

    /**
     * Gets whether to use the unified gsplat rendering.
     *
     * @type {boolean}
     */
    get unified() {
        return this._unified;
    }

    /**
     * Sets an array of layer IDs ({@link Layer#id}) to which this gsplat should belong. Don't
     * push, pop, splice or modify this array. If you want to change it, set a new one instead.
     *
     * @type {number[]}
     */
    set layers(value) {

        // remove the mesh instances from old layers
        this.removeFromLayers();

        // set the layer list
        this._layers.length = 0;
        for (let i = 0; i < value.length; i++) {
            this._layers[i] = value[i];
        }

        // don't add into layers until we're enabled
        if (!this.enabled || !this.entity.enabled) {
            return;
        }

        // add the mesh instance to new layers
        this.addToLayers();
    }

    /**
     * Gets the array of layer IDs ({@link Layer#id}) to which this gsplat belongs.
     *
     * @type {number[]}
     */
    get layers() {
        return this._layers;
    }

    /**
     * Sets the gsplat asset for this gsplat component. Can also be an asset id.
     *
     * @type {Asset|number}
     */
    set asset(value) {

        const id = value instanceof Asset ? value.id : value;
        if (this._assetReference.id === id) return;

        if (this._assetReference.asset && this._assetReference.asset.resource) {
            this._onGSplatAssetRemove();
        }

        this._assetReference.id = id;

        if (this._assetReference.asset) {
            this._onGSplatAssetAdded();
        }
    }

    /**
     * Gets the gsplat asset id for this gsplat component.
     *
     * @type {Asset|number}
     */
    get asset() {
        return this._assetReference.id;
    }

    /** @private */
    destroyInstance() {

        if (this._placement) {
            this.removeFromLayers();
            this._placement = null;
        }

        if (this._instance) {
            this.removeFromLayers();
            this._instance?.destroy();
            this._instance = null;
        }
    }

    /** @private */
    addToLayers() {

        if (this._placement) {
            const layers = this.system.app.scene.layers;
            for (let i = 0; i < this._layers.length; i++) {
                layers.getLayerById(this._layers[i])?.addGSplatPlacement(this._placement);
            }
            return;
        }

        const meshInstance = this.instance?.meshInstance;
        if (meshInstance) {
            const layers = this.system.app.scene.layers;
            for (let i = 0; i < this._layers.length; i++) {
                layers.getLayerById(this._layers[i])?.addMeshInstances([meshInstance]);
            }
        }
    }

    removeFromLayers() {

        if (this._placement) {
            const layers = this.system.app.scene.layers;
            for (let i = 0; i < this._layers.length; i++) {
                layers.getLayerById(this._layers[i])?.removeGSplatPlacement(this._placement);
            }
            return;
        }

        const meshInstance = this.instance?.meshInstance;
        if (meshInstance) {
            const layers = this.system.app.scene.layers;
            for (let i = 0; i < this._layers.length; i++) {
                layers.getLayerById(this._layers[i])?.removeMeshInstances([meshInstance]);
            }
        }
    }

    /** @private */
    onRemoveChild() {
        this.removeFromLayers();
    }

    /** @private */
    onInsertChild() {
        if (this.enabled && this.entity.enabled) {
            if (this._instance || this._placement) {
                this.addToLayers();
            }
        }
    }

    onRemove() {
        this.destroyInstance();

        this.asset = null;
        this._assetReference.id = null;

        this.entity.off('remove', this.onRemoveChild, this);
        this.entity.off('insert', this.onInsertChild, this);
    }

    onLayersChanged(oldComp, newComp) {
        this.addToLayers();
        oldComp.off('add', this.onLayerAdded, this);
        oldComp.off('remove', this.onLayerRemoved, this);
        newComp.on('add', this.onLayerAdded, this);
        newComp.on('remove', this.onLayerRemoved, this);
    }

    onLayerAdded(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        if (this._instance) {
            layer.addMeshInstances(this._instance.meshInstance);
        }

        Debug.assert(!this.unified);
    }

    onLayerRemoved(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        if (this._instance) {
            layer.removeMeshInstances(this._instance.meshInstance);
        }

        Debug.assert(!this.unified);
    }

    onEnable() {
        const scene = this.system.app.scene;
        const layers = scene.layers;

        this._evtLayersChanged = scene.on('set:layers', this.onLayersChanged, this);

        if (layers) {
            this._evtLayerAdded = layers.on('add', this.onLayerAdded, this);
            this._evtLayerRemoved = layers.on('remove', this.onLayerRemoved, this);
        }

        if (this._instance || this._placement) {
            this.addToLayers();
        } else if (this.asset) {
            this._onGSplatAssetAdded();
        }
    }

    onDisable() {
        const scene = this.system.app.scene;
        const layers = scene.layers;

        this._evtLayersChanged?.off();
        this._evtLayersChanged = null;

        if (layers) {
            this._evtLayerAdded?.off();
            this._evtLayerAdded = null;
            this._evtLayerRemoved?.off();
            this._evtLayerRemoved = null;
        }

        this.removeFromLayers();
    }

    /**
     * Stop rendering this component without removing its mesh instance from the scene hierarchy.
     */
    hide() {
        if (this._instance) {
            this._instance.meshInstance.visible = false;
        }
    }

    /**
     * Enable rendering of the component if hidden using {@link GSplatComponent#hide}.
     */
    show() {
        if (this._instance) {
            this._instance.meshInstance.visible = true;
        }
    }

    _onGSplatAssetAdded() {
        if (!this._assetReference.asset) {
            return;
        }

        if (this._assetReference.asset.resource) {
            this._onGSplatAssetLoad();
        } else if (this.enabled && this.entity.enabled) {
            this.system.app.assets.load(this._assetReference.asset);
        }
    }

    _onGSplatAssetLoad() {

        // remove existing instance
        this.destroyInstance();

        const asset = this._assetReference.asset;

        if (this.unified) {

            this._placement = null;

            if (asset) {
                this._placement = new GSplatPlacement(asset.resource, this.entity);
            }

        } else {

            // create new instance
            if (asset) {
                this.instance = new GSplatInstance(asset.resource, {
                    material: this._materialTmp,
                    highQualitySH: this._highQualitySH
                });
                this._materialTmp = null;
            }
        }

        if (asset) {
            this.customAabb = asset.resource.aabb.clone();
        }
    }

    _onGSplatAssetUnload() {
        // when unloading asset, only remove the instance
        this.destroyInstance();
    }

    _onGSplatAssetRemove() {
        this._onGSplatAssetUnload();
    }
}

export { GSplatComponent };

// --------------- POST EFFECT DEFINITION --------------- //
/**
 * @class
 * @name HueSaturationEffect
 * @classdesc Allows hue and saturation adjustment of the input render target.
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {GraphicsDevice} graphicsDevice - The graphics device of the application.
 * @property {number} hue Controls the hue. Ranges from -1 to 1 (-1 is 180 degrees in the negative direction, 0 no change, 1 is 180 degrees in the postitive direction).
 * @property {number} saturation Controls the saturation. Ranges from -1 to 1 (-1 is solid gray, 0 no change, 1 maximum saturation).
 */
function HueSaturationEffect(graphicsDevice) {
    pc.PostEffect.call(this, graphicsDevice);

    // Shader author: tapio / http://tapio.github.com/
    var fshader = [
        'uniform sampler2D uColorBuffer;',
        'uniform float uHue;',
        'uniform float uSaturation;',
        '',
        'varying vec2 vUv0;',
        '',
        'void main() {',
        '    gl_FragColor = texture2D( uColorBuffer, vUv0 );',
        '',
        // uHue
        '    float angle = uHue * 3.14159265;',
        '    float s = sin(angle), c = cos(angle);',
        '    vec3 weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;',
        '    float len = length(gl_FragColor.rgb);',
        '    gl_FragColor.rgb = vec3(',
        '        dot(gl_FragColor.rgb, weights.xyz),',
        '        dot(gl_FragColor.rgb, weights.zxy),',
        '        dot(gl_FragColor.rgb, weights.yzx)',
        '    );',
        '',
        // uSaturation
        '    float average = (gl_FragColor.r + gl_FragColor.g + gl_FragColor.b) / 3.0;',
        '    if (uSaturation > 0.0) {',
        '        gl_FragColor.rgb += (average - gl_FragColor.rgb) * (1.0 - 1.0 / (1.001 - uSaturation));',
        '    } else {',
        '        gl_FragColor.rgb += (average - gl_FragColor.rgb) * (-uSaturation);',
        '    }',
        '}'
    ].join('\n');

    this.shader = pc.ShaderUtils.createShader(graphicsDevice, {
        uniqueName: 'HueSaturationShader',
        attributes: { aPosition: pc.SEMANTIC_POSITION },
        vertexGLSL: pc.PostEffect.quadVertexShader,
        fragmentGLSL: fshader
    });

    // uniforms
    this.hue = 0;
    this.saturation = 0;
}

HueSaturationEffect.prototype = Object.create(pc.PostEffect.prototype);
HueSaturationEffect.prototype.constructor = HueSaturationEffect;

Object.assign(HueSaturationEffect.prototype, {
    render: function (inputTarget, outputTarget, rect) {
        var device = this.device;
        var scope = device.scope;

        scope.resolve('uHue').setValue(this.hue);
        scope.resolve('uSaturation').setValue(this.saturation);
        scope.resolve('uColorBuffer').setValue(inputTarget.colorBuffer);
        this.drawQuad(outputTarget, this.shader, rect);
    }
});

// ----------------- SCRIPT DEFINITION ------------------ //
var HueSaturation = pc.createScript('hueSaturation');

HueSaturation.attributes.add('hue', {
    type: 'number',
    default: 0,
    min: -1,
    max: 1,
    title: 'Hue'
});

HueSaturation.attributes.add('saturation', {
    type: 'number',
    default: 0,
    min: -1,
    max: 1,
    title: 'Saturation'
});

HueSaturation.prototype.initialize = function () {
    this.effect = new HueSaturationEffect(this.app.graphicsDevice);
    this.effect.hue = this.hue;
    this.effect.saturation = this.saturation;

    this.on('attr', function (name, value) {
        this.effect[name] = value;
    }, this);

    var queue = this.entity.camera.postEffects;

    queue.addEffect(this.effect);

    this.on('state', function (enabled) {
        if (enabled) {
            queue.addEffect(this.effect);
        } else {
            queue.removeEffect(this.effect);
        }
    });

    this.on('destroy', function () {
        queue.removeEffect(this.effect);
    });
};

export default /* glsl */`
#ifdef PIXELSNAP
uniform vec4 uScreenSize;
#endif

#ifdef SCREENSPACE
uniform float projectionFlipY;
#endif

vec4 evalWorldPosition(vec3 vertexPosition, mat4 modelMatrix) {

    vec3 localPos = getLocalPosition(vertexPosition);

    #ifdef NINESLICED
        // outer and inner vertices are at the same position, scale both
        localPos.xz *= outerScale;

        // offset inner vertices inside
        // (original vertices must be in [-1;1] range)
        vec2 positiveUnitOffset = clamp(vertexPosition.xz, vec2(0.0), vec2(1.0));
        vec2 negativeUnitOffset = clamp(-vertexPosition.xz, vec2(0.0), vec2(1.0));
        localPos.xz += (-positiveUnitOffset * innerOffset.xy + negativeUnitOffset * innerOffset.zw) * vertex_texCoord0.xy;

        vTiledUv = (localPos.xz - outerScale + innerOffset.xy) * -0.5 + 1.0; // uv = local pos - inner corner

        localPos.xz *= -0.5; // move from -1;1 to -0.5;0.5
        localPos = localPos.xzy;
    #endif

    vec4 posW = modelMatrix * vec4(localPos, 1.0);

    #ifdef SCREENSPACE
        posW.zw = vec2(0.0, 1.0);
    #endif

    return posW;
}

vec4 getPosition() {

    dModelMatrix = getModelMatrix();

    vec4 posW = evalWorldPosition(vertex_position.xyz, dModelMatrix);
    dPositionW = posW.xyz;

    vec4 screenPos;
    #ifdef UV1LAYOUT
        screenPos = vec4(vertex_texCoord1.xy * 2.0 - 1.0, 0.5, 1);
        #ifdef WEBGPU
            screenPos.y *= -1.0;
        #endif
    #else
        #ifdef SCREENSPACE
            screenPos = posW;
            screenPos.y *= projectionFlipY;
        #else
            screenPos = matrix_viewProjection * posW;
        #endif

        #ifdef PIXELSNAP
            // snap vertex to a pixel boundary
            screenPos.xy = (screenPos.xy * 0.5) + 0.5;
            screenPos.xy *= uScreenSize.xy;
            screenPos.xy = floor(screenPos.xy);
            screenPos.xy *= uScreenSize.zw;
            screenPos.xy = (screenPos.xy * 2.0) - 1.0;
        #endif
    #endif

    return screenPos;
}

vec3 getWorldPosition() {
    return dPositionW;
}
`;

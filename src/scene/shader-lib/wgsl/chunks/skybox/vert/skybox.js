export default /* wgsl */`
    // Attribute
    attribute aPosition : vec4f;

    uniform matrix_view : mat4x4f;
    uniform matrix_projectionSkybox : mat4x4f;
    uniform cubeMapRotationMatrix : mat3x3f;

    varying vViewDir : vec3f;

    #ifdef PREPASS_PASS
        // when skydome renders depth during prepass, generate linear depth
        varying vLinearDepth: f32;
    #endif

    #ifdef SKYMESH
        uniform matrix_model : mat4x4f;
        varying vWorldPos : vec3f;
    #endif

    @vertex
    fn vertexMain(input : VertexInput) -> VertexOutput {

        var output : VertexOutput;
        var view : mat4x4f = uniform.matrix_view;

        #ifdef SKYMESH

            var worldPos : vec4f = uniform.matrix_model * input.aPosition;
            output.vWorldPos = worldPos.xyz;
            output.position = uniform.matrix_projectionSkybox * (view * worldPos);

            #ifdef PREPASS_PASS
                // linear depth from the worldPosition, see getLinearDepth
                output.vLinearDepth = -(uniform.matrix_view * vec4f(worldPos.xyz, 1.0)).z;
            #endif

        #else

            view[3][0] = 0.0;
            view[3][1] = 0.0;
            view[3][2] = 0.0;
            output.position = uniform.matrix_projectionSkybox * (view * input.aPosition);
            output.vViewDir = input.aPosition.xyz * uniform.cubeMapRotationMatrix;

            #ifdef PREPASS_PASS
                // for infinite skybox, use negative gl_Position.w to get positive linear depth
                output.vLinearDepth = -pcPosition.w;
            #endif
        #endif

        // Force skybox to far Z, regardless of the clip planes on the camera
        // Subtract a tiny fudge factor to ensure floating point errors don't
        // still push pixels beyond far Z. See:
        // https://community.khronos.org/t/skybox-problem/61857

        output.position.z = output.position.w - 1.0e-7;

        return output;
    }
`;

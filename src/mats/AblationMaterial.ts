import * as THREE from 'three'

export class CardiacAblationMaterial extends THREE.ShaderMaterial {
    constructor(parameters: {
      compressed3dCrdt: THREE.DataTexture,
      ablationMap: THREE.DataTexture,
      projectedCoordinates: THREE.DataTexture
    }) {
      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;
  
      const fragmentShader = `
        precision highp float;
        precision highp int;
        precision highp sampler2D;
  
        varying vec2 vUv;
        
        uniform sampler2D icolor0;          // Current ablation map
        uniform sampler2D compressed3dCrdt; // 3D coordinates of heart tissue
        uniform sampler2D projectedCoordinates; // 3D coordinates of click location
        uniform vec2 clickPosition;         // 2D screen click position
        uniform float clickRadius;          // Ablation radius
  
        void main() {
          vec4 color0 = texture2D(icolor0, vUv);
          vec3 texelCrdt = texture2D(compressed3dCrdt, vUv).xyz;
          vec3 clickCrdt = texture2D(projectedCoordinates, clickPosition).xyz;
  
          if (length(texelCrdt - clickCrdt) < clickRadius) {
            color0 = vec4(1.0); // Mark as ablated
          }
  
          gl_FragColor = color0;
        }
      `;
  
      super({
        vertexShader,
        fragmentShader,
        uniforms: {
          icolor0: { value: parameters.ablationMap },
          compressed3dCrdt: { value: parameters.compressed3dCrdt },
          projectedCoordinates: { value: parameters.projectedCoordinates },
          clickPosition: { value: new THREE.Vector2(0, 0) },
          clickRadius: { value: 0.05 }
        }
      });
    }
  }
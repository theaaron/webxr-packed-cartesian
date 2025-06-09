import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class WebXRApp {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls?: OrbitControls
  private raycaster: THREE.Raycaster
  private mouse: THREE.Vector2
  private slateButtons: THREE.Mesh[] = []
  private heartMesh?: THREE.InstancedMesh
  private isRotatingHeart: boolean = false
  private isScalingHeart: boolean = false
  private previousMousePosition: THREE.Vector2 = new THREE.Vector2()
  private initialScale: number = 1

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera()
    this.renderer = new THREE.WebGLRenderer()
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    
    this.init()
  }

  private init(): void {
    this.setupScene()
    this.setupCamera()
    this.setupRenderer()
    this.setupControls()
    this.setupLighting()
    this.setupWebXR()
    this.setupSlate()
    this.setupMouseInteraction()
    this.animate()
    this.setupPointCloud()
    
    window.addEventListener('resize', () => this.onWindowResize())
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color(0x222222)
  }

  private setupCamera(): void {
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    )
    this.camera.position.set(0, 1.6, 3)
  }

  private setupRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.xr.enabled = true
    
    const appElement = document.getElementById('app')
    if (appElement) {
      appElement.appendChild(this.renderer.domElement)
    }
  }

  private setupControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.target.set(0, 1.6, -2) // Look at the heart
    this.controls.enableZoom = true
    this.controls.enablePan = true
    this.controls.enableRotate = true
    

    this.camera.position.set(1, 2, 1) // Angled view
    this.controls.update()
    console.log(this.initialScale)
    console.log('Orbit controls initialized')
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 10, 5)
    this.scene.add(directionalLight)
  }


  private setupWebXR(): void {
    if ('xr' in navigator) {
      navigator.xr?.isSessionSupported('immersive-vr').then((supported) => {
        if (supported) {
          const vrButton = VRButton.createButton(this.renderer)
          const vrContainer = document.getElementById('vr-button')
          if (vrContainer) {
            vrContainer.appendChild(vrButton)
          }
        }
      }).catch(console.error)
    }
  }


  private async setupPointCloud(): Promise<void> {
    try {
      const response = await fetch('./assets/02-350um-192x192x192_lra_grid.json');
      // const response = await fetch('./assets/06-350um-192x192x192_lra_grid.json');
      // const response = await fetch('./assets/07-350um-192x192x192_lra_grid.json');
      // const response = await fetch('./assets/09-350um-192x192x192_lra_grid.json');
      // const response = await fetch('./assets/13-350um-192x192x192_lra_grid.json');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      const modelData = JSON.parse(text);
      
      const points: THREE.Vector3[] = [];
      const fullTexelIndex = modelData.fullTexelIndex;


      const mx = modelData.mx;
      const my = modelData.my;
      const nx = modelData.nx; 
      const ny = modelData.ny;

      console.log('Atlas parameters:', { mx, my, nx, ny });

      for (let i = 0; i < fullTexelIndex.length; i += 4) {
          const atlasX = fullTexelIndex[i];     // X coordinate in full atlas texture
          const atlasY = fullTexelIndex[i + 1]; // Y coordinate in full atlas texture
          // const flag = fullTexelIndex[i + 2];   
          const w = fullTexelIndex[i + 3];      // Intensity/validity
          
          if (w > 0) {
              const sliceCol = Math.floor(atlasX / nx); // Which column of slices (0-15)
              const sliceRow = Math.floor(atlasY / ny); // Which row of slices (0-11)
              
              const sliceIndex = (my - 1 - sliceRow) * mx + sliceCol; // Flip row order
              
              const localX = atlasX % nx; // X within the slice (0-191)
              const localY = atlasY % ny; // Y within the slice (0-191)
              
              const x = localX;           // X coordinate in 3D volume
              const y = ny - 1 - localY;  // Flip Y coordinate
              const z = sliceIndex;       // Z coordinate in 3D volume
              
              const normalizedX = (x / 192) - 0.5;
              const normalizedY = (y / 192) - 0.5;
              const normalizedZ = (z / 192) - 0.5;
              
              points.push(new THREE.Vector3(normalizedX, normalizedY, normalizedZ));
          }
      }

      console.log('Created', points.length, 'points');
      

      const bounds = {
          x: [Infinity, -Infinity],
          y: [Infinity, -Infinity],
          z: [Infinity, -Infinity]
      };
      
      for (const point of points) {
          if (point.x < bounds.x[0]) bounds.x[0] = point.x;
          if (point.x > bounds.x[1]) bounds.x[1] = point.x;
          if (point.y < bounds.y[0]) bounds.y[0] = point.y;
          if (point.y > bounds.y[1]) bounds.y[1] = point.y;
          if (point.z < bounds.z[0]) bounds.z[0] = point.z;
          if (point.z > bounds.z[1]) bounds.z[1] = point.z;
      }

//////////////////////////////////////////////////////////////////////////////////////////////////////
    // INSTANCED CUBES
    
      const cubeGeometry = new THREE.BoxGeometry(0.008, 0.008, 0.008, 1, 1, 1);
      const cubeMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        shininess: 100,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
  
      const instancedMesh = new THREE.InstancedMesh(cubeGeometry, cubeMaterial, points.length);
    
      // Set position for each cube
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < points.length; i++) {
        matrix.makeTranslation(points[i].x, points[i].y, points[i].z);
        instancedMesh.setMatrixAt(i, matrix);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      
      instancedMesh.position.set(0, 1.6, -2);
      instancedMesh.userData = { type: 'heart' };
      this.heartMesh = instancedMesh;
      this.scene.add(instancedMesh);
  
      console.log('3D heart cube mesh created');

//////////////////////////////////////////////////////////////////////////////////////////////////////
      // SPHERE MODEL
      // const sphereGeometry = new THREE.SphereGeometry(0.008, 8, 6);
      // const sphereMaterial = new THREE.MeshPhongMaterial({
      //   color: 0xDC143C, 
      //   transparent: true,
      //   opacity: 0.9
      // });

      // const instancedMesh = new THREE.InstancedMesh(sphereGeometry, sphereMaterial, points.length);
    
      // // Set position for each sphere
      // const matrix = new THREE.Matrix4();
      // for (let i = 0; i < points.length; i++) {
      //   matrix.makeTranslation(points[i].x, points[i].y, points[i].z);
      //   instancedMesh.setMatrixAt(i, matrix);
      // }
      // instancedMesh.instanceMatrix.needsUpdate = true;
      
      // instancedMesh.position.set(0, 1.6, -2);
      // this.scene.add(instancedMesh);
//////////////////////////////////////////////////////////////////////////////////////////////////////
      // ORIGINAL POINT CLOUD MODEL
    //   const geometry = new THREE.BufferGeometry();
    //   geometry.setFromPoints(points);

    //   const material = new THREE.PointsMaterial({ 
    //     color: 0xff0000, 
    //     size: 0.01,
    //     sizeAttenuation: false
    //   });
      
    //   const pointCloud = new THREE.Points(geometry, material);
    //   pointCloud.position.set(0, 1.6, -2);
    //   this.scene.add(pointCloud);

    //   console.log('3D heart visualization created');
////////////////////////////////////////////////////////////////////////////////////////////////////////



    } catch (error) {
      console.error('Error loading point cloud:', error);
    }
  }

  private animate(): void {
    this.renderer.setAnimationLoop(() => this.render())
  }

  private render(): void {
    if (this.controls) {
      this.controls.update()
    }
    this.renderer.render(this.scene, this.camera)
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    
    if (this.controls) {
      this.controls.update()
    }
  }



// CONTROLLER SETUP


// HAND SETUP



// SLATE SETUP
  private setupSlate(): void {
    const slateGeometry = new THREE.PlaneGeometry(1.2, 0.8)
    const slateMaterial = new THREE.MeshPhongMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.9
    })
    const slate = new THREE.Mesh(slateGeometry, slateMaterial)
    slate.position.set(-1.5, 1.6, -1.5)
    slate.rotation.y = Math.PI / 6 // slightly angled
    this.scene.add(slate)


    const buttonOptions = [
      'Option 1',
      'Option 2', 
      'Option 3',
      'Option 4',
      'Option 5',
      'Option 6'
    ]

    const buttonGeometry = new THREE.PlaneGeometry(0.35, 0.15)
    const buttonSpacing = { x: 0.4, y: 0.25 }
    const startPos = { x: -0.4, y: 0.125 }

    buttonOptions.forEach((option, index) => {
      const row = Math.floor(index / 3)
      const col = index % 3
      
      const buttonMaterial = new THREE.MeshPhongMaterial({
        color: 0x4a9eff,
        transparent: true,
        opacity: 0.8
      })
      const button = new THREE.Mesh(buttonGeometry, buttonMaterial)
      
      const localX = startPos.x + col * buttonSpacing.x
      const localY = startPos.y - row * buttonSpacing.y
      const localZ = 0.001 
      
      button.position.set(localX, localY, localZ)
      button.rotation.copy(slate.rotation)
      
      const worldPosition = new THREE.Vector3()
      worldPosition.copy(button.position)
      worldPosition.applyMatrix4(slate.matrixWorld)
      
      slate.updateMatrixWorld()
      
      const rotatedPosition = new THREE.Vector3(localX, localY, localZ)
      rotatedPosition.applyEuler(slate.rotation)
      
      button.position.copy(slate.position).add(rotatedPosition)
      
      button.userData = { 
        type: 'slateButton', 
        option: option,
        index: index,
        originalColor: 0x4a9eff
      }
      
      this.slateButtons.push(button)
      this.scene.add(button)

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      canvas.width = 256
      canvas.height = 64
      
      context.fillStyle = 'white'
      context.font = 'bold 24px Arial'
      context.textAlign = 'center'
      context.fillText(option, canvas.width / 2, canvas.height / 2 + 8)
      
      const texture = new THREE.CanvasTexture(canvas)
      const textMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
      })
      const textMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.075),
        textMaterial
      )
      
      const textOffset = new THREE.Vector3(0, 0, 0.001)
      textOffset.applyEuler(slate.rotation)
      textMesh.position.copy(button.position).add(textOffset)
      textMesh.rotation.copy(button.rotation)
      
      this.scene.add(textMesh)
    })

    console.log('Interactive slate with 6 options created')
  }

  private setupMouseInteraction(): void {
    const onMouseMove = (event: MouseEvent) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
      
      if (this.isRotatingHeart && this.heartMesh) {
        const deltaX = event.clientX - this.previousMousePosition.x
        const deltaY = event.clientY - this.previousMousePosition.y
        
        const rotationSpeed = 0.01
        this.heartMesh.rotation.y += deltaX * rotationSpeed
        this.heartMesh.rotation.x += deltaY * rotationSpeed
        
        this.previousMousePosition.set(event.clientX, event.clientY)
      }
      
      if (this.isScalingHeart && this.heartMesh) {
        const deltaY = event.clientY - this.previousMousePosition.y
        

        //MOUSE UP = SCALE UP, MOUSE DOWN = SCALE DOWN
        const scaleSpeed = 0.005
        const scaleChange = -deltaY * scaleSpeed
        const newScale = Math.max(0.1, this.heartMesh.scale.x + scaleChange) 
        
        this.heartMesh.scale.setScalar(newScale)
        
        this.previousMousePosition.set(event.clientX, event.clientY)
      }
    }

    const onMouseDown = (event: MouseEvent) => {
      this.raycaster.setFromCamera(this.mouse, this.camera)
      const intersects = this.raycaster.intersectObjects([
        ...this.slateButtons,
        ...(this.heartMesh ? [this.heartMesh] : [])
      ])
      
      if (intersects.length > 0) {
        const clickedObject = intersects[0].object
        const objectData = clickedObject.userData
        
        if (objectData.type === 'heart') {
          this.previousMousePosition.set(event.clientX, event.clientY)
          
          if (event.altKey) { // option/alt depending on os
            this.isScalingHeart = true
            this.initialScale = this.heartMesh!.scale.x
            console.log('Started scaling heart')
          } else {
            this.isRotatingHeart = true
            console.log('Started rotating heart')
          }
          
          // Disable orbit controls while interacting with heart
          if (this.controls) {
            this.controls.enabled = false
          }
        }
      }
    }

    const onMouseUp = (_event: MouseEvent) => {
      if (this.isRotatingHeart || this.isScalingHeart) {
        this.isRotatingHeart = false
        this.isScalingHeart = false
        console.log('Stopped heart interaction')
        
        if (this.controls) {
          this.controls.enabled = true
        }
      }
    }

    const onMouseClick = (_event: MouseEvent) => {
      // Only handle slate button clicks if we're not interacting with the heart
      if (!this.isRotatingHeart && !this.isScalingHeart) {
        this.raycaster.setFromCamera(this.mouse, this.camera)
        const intersects = this.raycaster.intersectObjects(this.slateButtons)
        
        if (intersects.length > 0) {
          const clickedButton = intersects[0].object as THREE.Mesh
          const buttonData = clickedButton.userData
          
          if (buttonData.type === 'slateButton') {
            console.log(`Clicked: ${buttonData.option}`)
            
            const material = clickedButton.material as THREE.MeshPhongMaterial
            material.color.setHex(0x00ff00) 
            
            setTimeout(() => {
              material.color.setHex(buttonData.originalColor)
            }, 200)
            
            this.handleButtonClick(buttonData.index, buttonData.option)
          }
        }
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('click', onMouseClick)
  }



  // ACTIONS TO SETUP LATER ON SLATE

  private handleButtonClick(index: number, option: string): void {
    console.log(`Button ${index + 1} clicked: ${option}`)
    
    switch (index) {
      case 0:
        console.log('1')
        break
      case 1:
        console.log('2')
        break
      case 2:
        console.log('3')
        break
      case 3:
        console.log('4')
        break
      case 4:
        console.log('5')
        break
      case 5:
        console.log('6')
        break
    }
  }
}


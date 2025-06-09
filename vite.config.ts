import { defineConfig } from 'vite'

export default defineConfig({
  assetsInclude: ['**/*.glsl'],
  server: {
    fs: {
      allow: ['.'],
    },
    host: '0.0.0.0', 
    port: 5173,
  },
}) 
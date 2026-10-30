import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: shared }
  },
  preload: {
    resolve: { alias: shared }
  },
  renderer: {
    resolve: { alias: shared },
    plugins: [react()],
    build: {
      minify: true,
      rolldownOptions: {
        input: {
          character: resolve('src/renderer/character.html'),
          chat: resolve('src/renderer/chat.html'),
          island: resolve('src/renderer/island.html'),
          menu: resolve('src/renderer/menu.html')
        }
      }
    }
  }
})

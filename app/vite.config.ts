import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 建置時的 base path：GitHub Pages 會是 /<repo-name>/，本機則用相對路徑。
// Build-time base path: /<repo-name>/ on GitHub Pages, relative path locally.
const base = process.env.BASE_PATH ?? './'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
})

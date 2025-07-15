import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mantine': ['@mantine/core', '@mantine/hooks', '@mantine/notifications', '@mantine/charts', '@mantine/dates'],
          'vendor-icons': ['@tabler/icons-react'],
          'vendor-utils': ['zustand', 'date-fns'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ai': ['openai'],
          
          // Separate app chunks
          'stores': ['./src/stores/authStore', './src/stores/sessionStore', './src/stores/sessionSummaryStore'],
          'services': ['./src/services/aiSummaryService', './src/services/sessionService', './src/services/aiMemoryManager'],
          'components': ['./src/components/Layout', './src/components/ui'],
        },

      },
    },
    chunkSizeWarningLimit: 1000, // Increase limit to 1000kb
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@mantine/core', '@mantine/hooks']
  }
}) }) 

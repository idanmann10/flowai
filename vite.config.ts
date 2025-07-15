import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  
  return {
    plugins: [
      react(),
      // Bundle analyzer - only in production builds
      !isDev && visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      })
    ].filter(Boolean),
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    
    build: {
      // Development optimizations
      minify: isDev ? false : 'esbuild',
      sourcemap: isDev ? true : false,
      target: isDev ? 'esnext' : 'es2015',
      
      rollupOptions: {
        output: {
          // More granular chunking for better caching
          manualChunks: isDev ? undefined : {
            // Core React ecosystem
            'vendor-react': ['react', 'react-dom'],
            'vendor-router': ['react-router-dom'],
            
            // UI Libraries (largest dependencies)
            'vendor-mantine-core': ['@mantine/core'],
            'vendor-mantine-utils': ['@mantine/hooks', '@mantine/notifications'],
            'vendor-icons': ['@tabler/icons-react'],
            
            // External APIs (heavy dependencies)
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ai': ['openai'],
            
            // Utilities
            'vendor-utils': ['zustand', 'date-fns'],
            
            // App-specific chunks
            'app-stores': [
              './src/stores/authStore',
              './src/stores/sessionStore', 
              './src/stores/sessionSummaryStore'
            ],
            'app-services': [
              './src/services/aiSummaryService',
              './src/services/sessionService', 
              './src/services/aiMemoryManager',
              './src/services/finalSessionSummaryService'
            ],
            'app-components': [
              './src/components/Layout',
              './src/components/ui'
            ],
          },
        },
      },
      chunkSizeWarningLimit: isDev ? Infinity : 1000,
    },
    
    optimizeDeps: {
      include: [
        'react', 
        'react-dom', 
        'react-router-dom', 
        '@mantine/core', 
        '@mantine/hooks',
        'zustand'
      ],
      // Exclude heavy dependencies from optimization in dev
      exclude: isDev ? ['@supabase/supabase-js', 'openai'] : []
    },
    
    // Development server optimizations
    server: {
      hmr: {
        overlay: false, // Disable error overlay for faster builds
      },
    },
    
    // Faster dependency resolution
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      // Skip expensive lookups in dev
      extensions: isDev ? ['.ts', '.tsx', '.js', '.jsx'] : ['.ts', '.tsx', '.js', '.jsx', '.json']
    }
  }
})

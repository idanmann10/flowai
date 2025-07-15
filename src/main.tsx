import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/charts/styles.css'
import '@mantine/notifications/styles.css'
import App from './App.tsx'
import './styles/theme.css'
import './styles/clickup-theme.css'

console.log('🚀 Main.tsx loaded - starting React app')
console.log('🎨 Theme CSS imported')

const theme = createTheme({
  primaryColor: 'violet',
  defaultRadius: 'md',
  colors: {
    dark: [
      '#d5d7e0',
      '#acaebf',
      '#8c8fa3',
      '#666980',
      '#4d4f66',
      '#34354a',
      '#2b2c3d',
      '#1d1e30',
      '#0c0d21',
      '#01010a',
    ],
    violet: [
      '#f3f0ff',
      '#e5dbff',
      '#d0bfff',
      '#b197fc',
      '#9775fa',
      '#845ef7',
      '#7950f2',
      '#7048e8',
      '#6741d9',
      '#5f3dc4',
    ],
  },
  other: {
    bgPrimary: '#0a0a0a',
    bgSecondary: '#111111',
    bgCard: 'rgba(26, 27, 30, 0.9)',
    glassBg: 'rgba(255, 255, 255, 0.05)',
    glassBlur: 'blur(20px)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  components: {
    Card: {
      defaultProps: {
        padding: 'lg',
        radius: 'md',
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: 'rgba(26, 27, 30, 0.9)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            backgroundColor: 'rgba(31, 32, 35, 0.9)',
          },
        },
      },
    },
    Button: {
      styles: {
        root: {
          transition: 'all 0.2s ease',
        },
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications />
        <App />
      </MantineProvider>
    </HashRouter>
  </React.StrictMode>
)

console.log('✅ React app mounted to #root') 
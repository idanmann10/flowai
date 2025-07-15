import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import SessionSummaryModal from '../SessionSummaryModal'

const Layout: React.FC = () => {
  return (
    <div className="app-container">
      {/* Main Content Area */}
      <div className="app-content">
        {/* Sidebar */}
        <div className="app-sidebar">
          <Sidebar />
        </div>

        {/* Main Content */}
        <div className="app-main">
          <Outlet />
        </div>
      </div>
      
      {/* Global Modals */}
      <SessionSummaryModal />
    </div>
  )
}

export default Layout 
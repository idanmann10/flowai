import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../stores/authStore'
import { useSessionStore } from '../stores/sessionStore'

interface Team {
  id: number
  name: string
  manager: string
  memberCount: number
  productivity: number
  activeMembers: number
}

const FounderDashboard = () => {
  const { user } = useAuth()
  const { isActive } = useSessionStore()
  const navigate = useNavigate()
  const [teams] = useState<Team[]>([])

  // Auto-redirect to active session if session is active
  useEffect(() => {
    if (isActive) {
      console.log('🔄 [FOUNDER DASHBOARD] Active session detected, redirecting to active session');
      navigate('/active-session');
    }
  }, [isActive, navigate])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Company Dashboard</h1>
      
      <div className="dashboard-grid">
        {/* Company Stats */}
        <div className="stats-card">
          <div className="stats-header">
            <span className="stats-title">Overall Productivity</span>
          </div>
          <div className="stats-value">0%</div>
          <div className="stats-change">
            No data available
          </div>
        </div>

        {/* Total Members */}
        <div className="stats-card">
          <div className="stats-header">
            <span className="stats-title">Total Members</span>
          </div>
          <div className="stats-value">0</div>
          <div className="stats-change">No teams created</div>
        </div>

        {/* Active Now */}
        <div className="stats-card">
          <div className="stats-header">
            <span className="stats-title">Currently Active</span>
          </div>
          <div className="stats-value">0</div>
          <div className="stats-change">No active members</div>
        </div>
      </div>

      {/* Teams Overview */}
      <div className="card mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Teams Overview</h2>
          <button className="button button-primary">
            Create Team
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-secondary text-sm">
                <th className="pb-4">Team</th>
                <th className="pb-4">Manager</th>
                <th className="pb-4">Members</th>
                <th className="pb-4">Productivity</th>
                <th className="pb-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-secondary">
                    No teams configured yet. Create your first team to get started.
                  </td>
                </tr>
              ) : (
                teams.map(team => (
                <tr key={team.id} className="border-t border-white/10">
                  <td className="py-4">
                    <div className="font-medium">{team.name}</div>
                  </td>
                  <td className="py-4">{team.manager}</td>
                  <td className="py-4">
                    {team.activeMembers}/{team.memberCount} active
                  </td>
                  <td className="py-4">
                    <div className="flex items-center">
                      <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent-primary rounded-full"
                          style={{ width: `${team.productivity}%` }}
                        />
                      </div>
                      <span className="ml-2">{team.productivity}%</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <button className="button">Manage</button>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card mt-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <button className="button">
            Company Settings
          </button>
          <button className="button">
            Manage Roles
          </button>
          <button className="button">
            View Reports
          </button>
        </div>
      </div>
    </div>
  )
}

export default FounderDashboard 
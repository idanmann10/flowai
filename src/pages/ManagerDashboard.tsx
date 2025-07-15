import { useState } from 'react'
import { useAuth } from '../stores/authStore'

interface TeamMember {
  id: number
  name: string
  email: string
  role: string
  productivity: number
  activeTime: string
}

const ManagerDashboard = () => {
  const { user } = useAuth()
  const [teamMembers] = useState<TeamMember[]>([])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Team Dashboard</h1>
      
      <div className="dashboard-grid">
        {/* Team Stats */}
        <div className="stats-card">
          <div className="stats-header">
            <span className="stats-title">Team Productivity</span>
          </div>
          <div className="stats-value">0%</div>
          <div className="stats-change">
            No team data available
          </div>
        </div>

        {/* Active Members */}
        <div className="stats-card">
          <div className="stats-header">
            <span className="stats-title">Active Members</span>
          </div>
          <div className="stats-value">0/0</div>
          <div className="stats-change">No members added</div>
        </div>

        {/* Total Hours */}
        <div className="stats-card">
          <div className="stats-header">
            <span className="stats-title">Total Hours Today</span>
          </div>
          <div className="stats-value">0h</div>
          <div className="stats-change">No activity</div>
        </div>
      </div>

      {/* Team Members */}
      <div className="card mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Team Members</h2>
          <button className="button button-primary">
            Add Member
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-secondary text-sm">
                <th className="pb-4">Name</th>
                <th className="pb-4">Role</th>
                <th className="pb-4">Productivity</th>
                <th className="pb-4">Active Time</th>
                <th className="pb-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-secondary">
                    No team members added yet. Add your first team member to get started.
                  </td>
                </tr>
              ) : (
                teamMembers.map(member => (
                <tr key={member.id} className="border-t border-white/10">
                  <td className="py-4">
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-secondary text-sm">{member.email}</div>
                    </div>
                  </td>
                  <td className="py-4">{member.role}</td>
                  <td className="py-4">
                    <div className="flex items-center">
                      <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent-primary rounded-full"
                          style={{ width: `${member.productivity}%` }}
                        />
                      </div>
                      <span className="ml-2">{member.productivity}%</span>
                    </div>
                  </td>
                  <td className="py-4">{member.activeTime}</td>
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
    </div>
  )
}

export default ManagerDashboard 
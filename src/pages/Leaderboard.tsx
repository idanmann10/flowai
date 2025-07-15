import '../styles/theme.css'
import React, { useState, useEffect } from 'react'
import { 
  Container, 
  Paper, 
  Title, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  Avatar, 
  ScrollArea,
  Grid,
  Box,
  Center,
  Loader,
  Button,
  Tabs,
  RingProgress,
  Tooltip
} from '@mantine/core'
import { 
  IconTrophy, 
  IconMedal, 
  IconAward,
  IconCrown,
  IconFlame,
  IconTarget,
  IconClock,
  IconActivity
} from '@tabler/icons-react'
import { useAuth } from '../stores/authStore'
import { supabase } from '../lib/supabaseClient'

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  productivity_score: number;
  total_sessions: number;
  total_focus_time: number;
  streak_days: number;
  rank: number;
  weekly_score: number;
  monthly_score: number;
}

const Leaderboard: React.FC = () => {
  const { user } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('all-time')

  console.log('🏆 Leaderboard component rendering')

  useEffect(() => {
    console.log('🔧 Leaderboard mounted')
    if (user) {
      fetchLeaderboard()
    }
    return () => {
      console.log('🔧 Leaderboard unmounted')
    }
  }, [user, activeTab])

  const fetchLeaderboard = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // First, get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name')

      if (profilesError) {
        throw new Error(`Failed to fetch profiles: ${profilesError.message}`)
      }

      // Then get sessions for each user
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('user_id, productivity_score, active_secs, start_time')

      // If sessions query fails, continue with just profile data
      const sessionData = sessionsError ? [] : (sessions || [])

      // Helper function to calculate streak days from session data
      const calculateStreakDays = (sessions: any[]) => {
        if (sessions.length === 0) return 0
        
        // Sort sessions by date
        const sortedSessions = sessions
          .map(s => new Date(s.start_time).toDateString())
          .sort()
        
        // Remove duplicates (same day sessions)
        const uniqueDays = [...new Set(sortedSessions)]
        
        // Simple streak calculation - count consecutive days from most recent
        let streak = 0
        const today = new Date().toDateString()
        let currentDate = new Date()
        
        for (let i = 0; i < 30; i++) { // Check last 30 days
          const dateStr = currentDate.toDateString()
          if (uniqueDays.includes(dateStr)) {
            streak++
          } else if (streak > 0) {
            break // End of consecutive streak
          }
          currentDate.setDate(currentDate.getDate() - 1)
        }
        
        return streak
      }

      const transformedEmployees: Employee[] = (profiles || []).map((profile, index) => {
        const userSessions = sessionData.filter(s => s.user_id === profile.id)
        const totalSessions = userSessions.length
        const avgProductivity = userSessions.length > 0 
          ? userSessions.reduce((sum, s) => sum + (s.productivity_score || 0), 0) / userSessions.length * 100 
          : 0 // No fallback data - show real data only
        const totalFocusTime = userSessions.reduce((sum, s) => sum + (s.active_secs || 0), 0) / 3600
        
        // Calculate streak days from actual session data
        const streakDays = userSessions.length > 0 ? calculateStreakDays(userSessions) : 0

        return {
          id: profile.id,
          name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
          email: profile.email || '',
          role: 'Employee', // Default role since column doesn't exist
          productivity_score: Math.round(avgProductivity),
          total_sessions: totalSessions,
          total_focus_time: Math.round(totalFocusTime * 10) / 10,
          streak_days: streakDays,
          rank: index + 1,
          weekly_score: Math.round(avgProductivity), // Use same as daily for now
          monthly_score: Math.round(avgProductivity) // Use same as daily for now
        }
      })

      const sortedEmployees = transformedEmployees.sort((a, b) => {
        switch (activeTab) {
          case 'weekly':
            return b.weekly_score - a.weekly_score
          case 'monthly':
            return b.monthly_score - a.monthly_score
          default:
            return b.productivity_score - a.productivity_score
        }
      }).map((emp, index) => ({ ...emp, rank: index + 1 }))

      setEmployees(sortedEmployees)
      setError(null)
      
    } catch (error) {
      console.error('❌ Error fetching leaderboard:', error)
      setError(error instanceof Error ? error.message : 'Failed to load leaderboard. Please try again later.')
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <IconCrown size={20} style={{ color: '#ffd700' }} />
      case 2:
        return <IconMedal size={20} style={{ color: '#c0c0c0' }} />
      case 3:
        return <IconAward size={20} style={{ color: '#cd7f32' }} />
      default:
        return <Text size="sm" c="dimmed">#{rank}</Text>
    }
  }

  const getProductivityColor = (score: number) => {
    if (score >= 80) return 'green'
    if (score >= 60) return 'yellow'
    return 'red'
  }

  const getCurrentScore = (employee: Employee) => {
    switch (activeTab) {
      case 'weekly':
        return employee.weekly_score
      case 'monthly':
        return employee.monthly_score
      default:
        return employee.productivity_score
    }
  }

  if (!user) {
    return (
      <Center style={{ height: '80vh' }}>
        <Stack align="center" gap="md">
          <Text size="xl">🔒</Text>
          <Text c="dimmed" ta="center">Please log in to view the leaderboard</Text>
        </Stack>
      </Center>
    )
  }

  if (loading) {
    return (
      <Center style={{ height: '80vh' }}>
        <Stack align="center" gap="md">
          <Loader size="md" />
          <Text c="dimmed">Loading leaderboard...</Text>
        </Stack>
      </Center>
    )
  }

  if (error) {
    return (
      <Center style={{ height: '80vh' }}>
        <Stack align="center" gap="lg">
          <Text size="xl">⚠️</Text>
          <Text c="dimmed" ta="center">{error}</Text>
          <Button 
            variant="light"
            onClick={() => {
              setLoading(true)
              setError(null)
              fetchLeaderboard()
            }}
          >
            Retry
          </Button>
        </Stack>
      </Center>
    )
  }

  return (
    <Container size="xl" p="xl">
      <Group justify="space-between" mb="xl">
        <Box>
          <Title 
            order={1} 
            className="gradient-text"
            style={{
              background: 'linear-gradient(135deg, #ffd700, #ff6b35)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            🏆 Leaderboard
          </Title>
          <Text c="dimmed" size="lg">
            Compete with your team and climb to the top
          </Text>
        </Box>
        <Paper p="md" className="glass-card">
          <Group gap="xs">
            <IconFlame style={{ color: '#ff6b35' }} size={20} />
            <Text fw={500} size="lg">{employees.length}</Text>
            <Text c="dimmed" size="sm">competitors</Text>
          </Group>
        </Paper>
      </Group>

      {/* Top 3 Podium */}
      {employees.length >= 3 && (
        <Paper p="xl" mb="xl" className="glass-card">
          <Title order={3} ta="center" mb="xl" c="white">Top Performers</Title>
          <Grid>
            {/* 2nd Place */}
            <Grid.Col span={4}>
              <Stack align="center" gap="md">
                <Avatar
                  size={60}
                  style={{
                    background: 'linear-gradient(135deg, #c0c0c0, #e8e8e8)',
                    border: '3px solid #c0c0c0'
                  }}
                >
                  {employees[1]?.name[0]?.toUpperCase()}
                </Avatar>
                <Stack align="center" gap="xs">
                  <IconMedal size={24} style={{ color: '#c0c0c0' }} />
                  <Text fw={600} size="lg">{employees[1]?.name}</Text>
                  <Badge color="gray" variant="light" size="sm">
                    {employees[1]?.role}
                  </Badge>
                  <RingProgress
                    size={80}
                    thickness={8}
                    sections={[{ value: getCurrentScore(employees[1]), color: getProductivityColor(getCurrentScore(employees[1])) }]}
                    label={
                      <Text ta="center" fw={700}>
                        {getCurrentScore(employees[1])}%
                      </Text>
                    }
                  />
                </Stack>
              </Stack>
            </Grid.Col>

            {/* 1st Place */}
            <Grid.Col span={4}>
              <Stack align="center" gap="md">
                <Avatar
                  size={80}
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                    border: '4px solid #ffd700',
                    boxShadow: '0 0 20px rgba(255, 215, 0, 0.4)'
                  }}
                >
                  {employees[0]?.name[0]?.toUpperCase()}
                </Avatar>
                <Stack align="center" gap="xs">
                  <IconCrown size={32} style={{ color: '#ffd700' }} />
                  <Text fw={700} size="xl">{employees[0]?.name}</Text>
                  <Badge color="yellow" variant="light" size="md">
                    {employees[0]?.role}
                  </Badge>
                  <RingProgress
                    size={100}
                    thickness={10}
                    sections={[{ value: getCurrentScore(employees[0]), color: getProductivityColor(getCurrentScore(employees[0])) }]}
                    label={
                      <Text ta="center" fw={700} size="lg">
                        {getCurrentScore(employees[0])}%
                      </Text>
                    }
                  />
                </Stack>
              </Stack>
            </Grid.Col>

            {/* 3rd Place */}
            <Grid.Col span={4}>
              <Stack align="center" gap="md">
                <Avatar
                  size={60}
                  style={{
                    background: 'linear-gradient(135deg, #cd7f32, #daa520)',
                    border: '3px solid #cd7f32'
                  }}
                >
                  {employees[2]?.name[0]?.toUpperCase()}
                </Avatar>
                <Stack align="center" gap="xs">
                  <IconAward size={24} style={{ color: '#cd7f32' }} />
                  <Text fw={600} size="lg">{employees[2]?.name}</Text>
                  <Badge color="orange" variant="light" size="sm">
                    {employees[2]?.role}
                  </Badge>
                  <RingProgress
                    size={80}
                    thickness={8}
                    sections={[{ value: getCurrentScore(employees[2]), color: getProductivityColor(getCurrentScore(employees[2])) }]}
                    label={
                      <Text ta="center" fw={700}>
                        {getCurrentScore(employees[2])}%
                      </Text>
                    }
                  />
                </Stack>
              </Stack>
            </Grid.Col>
          </Grid>
        </Paper>
      )}

      {/* Tabs and Full Rankings */}
      <Paper className="glass-card" p="lg">
        <Tabs value={activeTab} onChange={(value) => value && setActiveTab(value)} mb="lg">
          <Tabs.List>
            <Tabs.Tab value="all-time" leftSection={<IconTrophy size={16} />}>
              All Time
            </Tabs.Tab>
            <Tabs.Tab value="monthly" leftSection={<IconTarget size={16} />}>
              This Month  
            </Tabs.Tab>
            <Tabs.Tab value="weekly" leftSection={<IconActivity size={16} />}>
              This Week
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        <ScrollArea.Autosize mah="60vh">
          <Stack gap="sm">
            {employees.map((employee, index) => (
              <Paper
                key={employee.id}
                p="md"
                className="glass-card hover-lift"
                style={{
                  background: employee.id === user.id 
                    ? 'rgba(139, 92, 246, 0.1)' 
                    : 'rgba(255, 255, 255, 0.03)',
                  border: employee.id === user.id 
                    ? '1px solid rgba(139, 92, 246, 0.3)' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  animationDelay: `${index * 50}ms`,
                  animation: 'fadeIn 0.5s ease-out forwards'
                }}
              >
                <Group justify="space-between">
                  <Group gap="md">
                    <Box style={{ minWidth: 40 }}>
                      {getRankIcon(employee.rank)}
                    </Box>
                    <Avatar
                      size={40}
                      style={{
                        background: employee.rank <= 3 
                          ? employee.rank === 1 ? 'linear-gradient(135deg, #ffd700, #ffed4e)'
                          : employee.rank === 2 ? 'linear-gradient(135deg, #c0c0c0, #e8e8e8)'
                          : 'linear-gradient(135deg, #cd7f32, #daa520)'
                          : 'linear-gradient(135deg, #8b5cf6, #a78bfa)'
                      }}
                    >
                      {employee.name[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Group gap="xs">
                        <Text fw={500} size="md">
                          {employee.name}
                        </Text>
                        {employee.id === user.id && (
                          <Badge color="violet" size="xs" variant="dot">
                            You
                          </Badge>
                        )}
                      </Group>
                      <Group gap="md">
                        <Badge color="gray" variant="subtle" size="xs">
                          {employee.role}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {employee.total_sessions} sessions
                        </Text>
                      </Group>
                    </Box>
                  </Group>

                  <Group gap="lg">
                    <Tooltip label="Total Focus Time">
                      <Group gap="xs">
                        <IconClock size={16} style={{ color: '#9ca3af' }} />
                        <Text size="sm" c="dimmed">
                          {employee.total_focus_time}h
                        </Text>
                      </Group>
                    </Tooltip>
                    <Tooltip label="Current Streak">
                      <Group gap="xs">
                        <IconFlame size={16} style={{ color: '#ff6b35' }} />
                        <Text size="sm" c="dimmed">
                          {employee.streak_days}d
                        </Text>
                      </Group>
                    </Tooltip>
                    <Box ta="right">
                      <Text
                        fw={700}
                        size="lg"
                        c={getProductivityColor(getCurrentScore(employee))}
                        style={{ fontFamily: 'monospace' }}
                      >
                        {getCurrentScore(employee)}%
                      </Text>
                    </Box>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      </Paper>
    </Container>
  )
}

export default Leaderboard 

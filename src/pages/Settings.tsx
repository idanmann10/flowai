import '../styles/theme.css'
import React, { useState, useEffect } from 'react'
import { 
  Container, 
  Paper, 
  Title, 
  Text, 
  Group, 
  Stack, 
  TextInput,
  Switch,
  Button,
  Box,
  Center,
  Loader,
  Alert,
  Divider,
  SegmentedControl,
  Avatar,
  Badge,
  ActionIcon,
  Tooltip,
  Grid,
  Card
} from '@mantine/core'
import { 
  IconUser, 
  IconBell, 
  IconPalette, 
  IconLogout,
  IconCheck,
  IconX,
  IconSettings,
  IconMail,
  IconBellRinging,
  IconCoffee,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconShield,
  IconFlask
} from '@tabler/icons-react'
import { useAuth } from '../stores/authStore'
import { supabase } from '../lib/supabaseClient'

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  job_title: string | null;
  team_id: string | null;
  notification_preferences: {
    email_alerts: boolean;
    desktop_notifications: boolean;
    break_reminders: boolean;
  };
  theme_preference: 'dark' | 'light' | 'system';
}

const defaultNotificationPreferences = {
  email_alerts: false,
  desktop_notifications: true,
  break_reminders: true
}

const defaultThemePreference = 'dark' as const

const Settings: React.FC = () => {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  console.log('⚙️ Settings component rendering')

  useEffect(() => {
    console.log('🔧 Settings mounted')
    if (user) {
      fetchProfile()
    }
    return () => {
      console.log('🔧 Settings unmounted')
    }
  }, [user])

  const fetchProfile = async () => {
    if (!user) {
      console.log('❌ No user found, cannot fetch profile')
      setLoading(false)
      return
    }

    try {
      console.log('📊 Fetching profile for user:', user.id)
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        console.error('❌ Supabase error:', fetchError)
        throw new Error(`Failed to fetch profile: ${fetchError.message}`)
      }

      // Initialize missing fields with defaults
      const profileWithDefaults = {
        ...data,
        notification_preferences: data.notification_preferences || defaultNotificationPreferences,
        theme_preference: data.theme_preference || defaultThemePreference
      }

      setProfile(profileWithDefaults)
      console.log('✅ Profile loaded successfully:', profileWithDefaults)
    } catch (error) {
      console.error('❌ Error fetching profile:', error)
      setError(error instanceof Error ? error.message : 'Failed to load profile settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    try {
      console.log('💾 Saving profile settings...')
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          job_title: profile.job_title,
          notification_preferences: profile.notification_preferences || defaultNotificationPreferences,
          theme_preference: profile.theme_preference || defaultThemePreference
        })
        .eq('id', user?.id)

      if (updateError) {
        console.error('❌ Update error:', updateError)
        throw new Error(`Failed to save settings: ${updateError.message}`)
      }

      setSuccessMessage('Settings saved successfully')
      console.log('✅ Settings saved successfully')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error('❌ Error saving settings:', error)
      setError(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setProfile(prev => prev ? ({ ...prev, [field]: value }) : null)
  }

  const handleNotificationChange = (setting: keyof UserProfile['notification_preferences']) => {
    setProfile(prev => {
      if (!prev) return null
      return {
        ...prev,
        notification_preferences: {
          ...(prev.notification_preferences || defaultNotificationPreferences),
          [setting]: !(prev.notification_preferences?.[setting] ?? defaultNotificationPreferences[setting])
        }
      }
    })
  }

  const handleThemeChange = (theme: string) => {
    setProfile(prev => prev ? ({ ...prev, theme_preference: theme as UserProfile['theme_preference'] }) : null)
  }

  const handleSignOut = async () => {
    try {
      console.log('🚪 Signing out...')
      await signOut()
    } catch (error) {
      console.error('❌ Sign out error:', error)
    }
  }

  if (!user) {
    return (
      <Center style={{ height: '80vh' }}>
        <Stack align="center" gap="md">
          <Text size="xl">🔒</Text>
          <Text c="dimmed" ta="center">Please log in to access settings</Text>
        </Stack>
      </Center>
    )
  }

  if (loading) {
    return (
      <Center style={{ height: '80vh' }}>
        <Stack align="center" gap="md">
          <Loader size="md" />
          <Text c="dimmed">Loading settings...</Text>
        </Stack>
      </Center>
    )
  }

  if (!profile) {
    return (
      <Center style={{ height: '80vh' }}>
        <Stack align="center" gap="lg">
          <Text size="xl">⚠️</Text>
          <Text c="dimmed" ta="center">{error || 'Failed to load profile'}</Text>
          <Button variant="light" onClick={fetchProfile}>
            Retry
          </Button>
        </Stack>
      </Center>
    )
  }

  return (
    <Container size="lg" p="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <Box>
            <Title 
              order={1} 
              className="gradient-text"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Settings
            </Title>
            <Text c="dimmed" size="lg">
              Manage your account and application preferences
            </Text>
          </Box>
          <Avatar
            size="lg"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)'
            }}
          >
            {profile.full_name?.[0]?.toUpperCase() || profile.email[0]?.toUpperCase()}
          </Avatar>
        </Group>

        {/* Success/Error Messages */}
        {successMessage && (
          <Alert icon={<IconCheck size={16} />} title="Success" color="green" variant="light">
            {successMessage}
          </Alert>
        )}

        {error && (
          <Alert icon={<IconX size={16} />} title="Error" color="red" variant="light">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack gap="xl">
            {/* Profile Section */}
            <Paper p="xl" className="glass-card">
              <Group mb="lg" gap="md">
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <IconUser size={20} style={{ color: 'white' }} />
                </Box>
                <Box>
                  <Title order={3} c="white">Profile Information</Title>
                  <Text c="dimmed" size="sm">Update your personal details</Text>
                </Box>
              </Group>
              
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Full Name"
                    placeholder="Enter your full name"
                    value={profile.full_name || ''}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    styles={{
                      input: {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        '&:focus': {
                          borderColor: '#8b5cf6'
                        }
                      },
                      label: {
                        color: 'white',
                        fontWeight: 500
                      }
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Job Title"
                    placeholder="Enter your job title"
                    value={profile.job_title || ''}
                    onChange={(e) => handleInputChange('job_title', e.target.value)}
                    styles={{
                      input: {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        '&:focus': {
                          borderColor: '#8b5cf6'
                        }
                      },
                      label: {
                        color: 'white',
                        fontWeight: 500
                      }
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <TextInput
                    label="Email"
                    value={profile.email}
                    disabled
                    rightSection={
                      <Tooltip label="Contact administrator to change email">
                        <IconShield size={16} style={{ color: '#9ca3af' }} />
                      </Tooltip>
                    }
                    styles={{
                      input: {
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        color: '#9ca3af',
                        cursor: 'not-allowed'
                      },
                      label: {
                        color: 'white',
                        fontWeight: 500
                      }
                    }}
                  />
                  <Text size="xs" c="dimmed" mt="xs">
                    Contact your administrator to change email address
                  </Text>
                </Grid.Col>
              </Grid>
            </Paper>

            {/* Notifications Section - Marked as Beta */}
            <Paper p="xl" className="glass-card">
              <Group mb="lg" gap="md">
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <IconBell size={20} style={{ color: 'white' }} />
                </Box>
                <Box>
                  <Group gap="xs" align="center">
                    <Title order={3} c="white">Notifications</Title>
                    <Badge 
                      color="orange" 
                      variant="light" 
                      size="sm"
                      leftSection={<IconFlask size={12} />}
                    >
                      BETA
                    </Badge>
                  </Group>
                  <Text c="dimmed" size="sm">Configure how you receive updates (Coming Soon)</Text>
                </Box>
              </Group>
              
              <Alert 
                icon={<IconFlask size={16} />} 
                title="Beta Feature" 
                color="orange" 
                variant="light"
                mb="md"
              >
                Notification settings are currently in development. These settings will be functional in a future update.
              </Alert>
              
              <Stack gap="md">
                {[
                  { 
                    key: 'email_alerts', 
                    label: 'Email Alerts', 
                    description: 'Receive productivity reports via email',
                    icon: IconMail
                  },
                  { 
                    key: 'desktop_notifications', 
                    label: 'Desktop Notifications', 
                    description: 'Show notifications for important events',
                    icon: IconBellRinging
                  },
                  { 
                    key: 'break_reminders', 
                    label: 'Break Reminders', 
                    description: 'Get reminded to take regular breaks',
                    icon: IconCoffee
                  }
                ].map(({ key, label, description, icon: Icon }) => (
                  <Card key={key} p="md" className="glass-card" style={{ opacity: 0.6 }}>
                    <Group justify="space-between">
                      <Group gap="md">
                        <Icon size={20} style={{ color: '#8b5cf6' }} />
                        <Box>
                          <Text fw={500} c="white">{label}</Text>
                          <Text size="sm" c="dimmed">{description}</Text>
                        </Box>
                      </Group>
                      <Switch
                        checked={profile.notification_preferences?.[key as keyof UserProfile['notification_preferences']] ?? false}
                        onChange={() => handleNotificationChange(key as keyof UserProfile['notification_preferences'])}
                        color="violet"
                        size="md"
                        disabled
                      />
                    </Group>
                  </Card>
                ))}
              </Stack>
            </Paper>

            {/* Appearance Section - Marked as Beta */}
            <Paper p="xl" className="glass-card">
              <Group mb="lg" gap="md">
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <IconPalette size={20} style={{ color: 'white' }} />
                </Box>
                <Box>
                  <Group gap="xs" align="center">
                    <Title order={3} c="white">Appearance</Title>
                    <Badge 
                      color="orange" 
                      variant="light" 
                      size="sm"
                      leftSection={<IconFlask size={12} />}
                    >
                      BETA
                    </Badge>
                  </Group>
                  <Text c="dimmed" size="sm">Customize the look and feel (Coming Soon)</Text>
                </Box>
              </Group>
              
              <Alert 
                icon={<IconFlask size={16} />} 
                title="Beta Feature" 
                color="orange" 
                variant="light"
                mb="md"
              >
                Theme switching is currently in development. The app will default to dark mode for now.
              </Alert>
              
              <Box style={{ opacity: 0.6 }}>
                <Text fw={500} c="white" mb="md">Theme Preference</Text>
                <SegmentedControl
                  value={profile.theme_preference}
                  onChange={handleThemeChange}
                  data={[
                    { 
                      label: (
                        <Center style={{ gap: 8 }}>
                          <IconSun size={16} />
                          <span>Light</span>
                        </Center>
                      ), 
                      value: 'light' 
                    },
                    { 
                      label: (
                        <Center style={{ gap: 8 }}>
                          <IconMoon size={16} />
                          <span>Dark</span>
                        </Center>
                      ), 
                      value: 'dark' 
                    },
                    { 
                      label: (
                        <Center style={{ gap: 8 }}>
                          <IconDeviceDesktop size={16} />
                          <span>System</span>
                        </Center>
                      ), 
                      value: 'system' 
                    }
                  ]}
                  color="violet"
                  fullWidth
                  disabled
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)'
                  }}
                />
              </Box>
            </Paper>

            {/* Actions */}
            <Group justify="space-between" pt="md">
              <Button
                variant="subtle"
                color="red"
                leftSection={<IconLogout size={16} />}
                onClick={handleSignOut}
                size="md"
              >
                Sign Out
              </Button>
              
              <Button
                type="submit"
                loading={saving}
                leftSection={!saving ? <IconCheck size={16} /> : undefined}
                size="md"
                color="violet"
                style={{
                  background: saving ? undefined : 'linear-gradient(135deg, #8b5cf6, #a78bfa)'
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Container>
  )
}

export default Settings 
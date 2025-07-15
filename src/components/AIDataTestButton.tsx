import React, { useEffect, useState } from 'react'

const AIDataTestButton: React.FC = () => {
  const [testResult, setTestResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Listen for test results
    if (window.electron?.tracker?.onAIDataTestResult) {
      console.log('🤖 DEBUG: Setting up AI data test result listener')
      window.electron.tracker.onAIDataTestResult((result: any) => {
        console.log('🤖 DEBUG: AI data test result:', result)
        setAiData(result)
        setIsLoading(false)
      })
    }
  }, [])

  const handleTestAIData = () => {
    console.log('🤖 DEBUG: Testing AI data generation...')
    setIsLoading(true)
    setAiData(null)
    setCopied(false)
    
    if (window.electron?.tracker?.testAIData) {
      window.electron.tracker.testAIData()
    } else {
      console.error('❌ DEBUG: testAIData method not available')
      setIsLoading(false)
      setAiData({
        error: 'Method not available',
        message: 'testAIData method not found in electron.tracker'
      })
    }
  }

  const formatDataSize = (data: any) => {
    const size = new Blob([JSON.stringify(data)]).size
    return size > 1024 ? `${(size / 1024).toFixed(1)}KB` : `${size}B`
  }

  const getAIDataPreview = () => {
    if (!aiData?.sessionData) return "No data available"
    
    const { sessionData } = aiData
    return `🤖 AI DATA STRUCTURE PREVIEW:

📊 Session Overview:
• Session ID: ${sessionData.sessionId}
• Total Events: ${sessionData.totalEvents}
• Platform: ${sessionData.platform || 'darwin'}

📈 Activity Metrics:
• Keystrokes: ${sessionData.stats?.totalKeystrokes || 0}
• Mouse Clicks: ${sessionData.stats?.totalMouseClicks || 0}  
• App Switches: ${sessionData.stats?.totalAppSwitches || 0}
• Browser Navigation: ${sessionData.stats?.totalBrowserNavigation || 0}

🔄 Recent Events Sample:
${sessionData.events?.slice(-5).map((event: any, i: number) => 
  `• ${event.type} in ${event.activeApp || 'Unknown'}`
).join('\n') || 'No events captured'}

💡 This data gets processed into AI summaries every 90 seconds for cost-effective analysis!`
  }

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <div>
            <Text fw={500} size="lg">🤖 AI Data Generation Test</Text>
            <Text size="sm" c="dimmed">
              Test what data the AI actually receives for summary generation
            </Text>
          </div>
          <Button
            onClick={handleTestAIData}
            loading={isLoading}
            leftSection={<IconBrain size={16} />}
            variant="light"
            color="blue"
          >
            {isLoading ? 'Generating...' : 'Test AI Data'}
          </Button>
        </Group>

        {aiData && (
          <>
            <Alert color="green" variant="light" icon={<IconCheck size={16} />}>
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  ✅ AI Data Generated Successfully!
                </Text>
                <Badge color="green" variant="light">
                  {aiData.eventCount} events • {formatDataSize(aiData)}
                </Badge>
              </Group>
            </Alert>

            <Tabs defaultValue="preview" variant="outline">
              <Tabs.List>
                <Tabs.Tab value="preview" leftSection={<IconEye size={16} />}>
                  AI Data Preview
                </Tabs.Tab>
                <Tabs.Tab value="full" leftSection={<IconCode size={16} />}>
                  Full JSON Data
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="preview" pt="md">
                <Paper p="md" bg="blue.0">
                  <ScrollArea h={300}>
                    <Text size="sm" ff="monospace" style={{ whiteSpace: 'pre-line' }}>
                      {getAIDataPreview()}
                    </Text>
                  </ScrollArea>
                </Paper>
              </Tabs.Panel>

              <Tabs.Panel value="full" pt="md">
                <Paper p="md" bg="gray.0">
                  <ScrollArea h={400}>
                    <Code block style={{ fontSize: '11px' }}>
                      {aiData.copyableData || JSON.stringify(aiData, null, 2)}
                    </Code>
                  </ScrollArea>
                </Paper>
              </Tabs.Panel>
            </Tabs>

            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                📊 Data size: {formatDataSize(aiData)} • Perfect for AI processing
              </Text>
              <Group gap="xs">
                <CopyButton value={aiData.copyableData || JSON.stringify(aiData, null, 2)}>
                  {({ copied, copy }) => (
                    <Button
                      size="sm"
                      variant="light"
                      color={copied ? 'teal' : 'gray'}
                      onClick={() => {
                        copy()
                        setCopied(copied)
                      }}
                      leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    >
                      {copied ? 'Copied!' : 'Copy AI Data'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
            </Group>
          </>
        )}

        {!aiData && (
          <Alert color="blue" variant="light">
            <Text size="sm">
              💡 Start a tracking session and click "Test AI Data" to see exactly what data 
              the AI receives for generating productivity summaries.
            </Text>
          </Alert>
        )}
      </Stack>
    </Paper>
  )
}

export default AIDataTestButton 
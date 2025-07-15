/**
 * LevelAI Event Chunker - Groups raw events into contextual activity chunks
 * 
 * This function processes flat arrays of LevelAI events and groups them into
 * meaningful chunks representing discrete user activities without losing any data.
 */

interface RawEvent {
  timestamp: string
  type: string
  metadata: any
  app?: string
  url?: string
  window_title?: string
  [key: string]: any
}

interface ActivityChunk {
  start: string
  end: string
  primary_app: string
  window_title: string
  primary_url: string
  event_count: number
  events: RawEvent[]
  highlights: {
    clipboard_texts: string[]
    input_texts: string[]
    clicked_urls: string[]
  }
  summary_hint?: string
}

/**
 * Main chunking function - groups events into contextual activity chunks
 */
export function chunk_events(events: RawEvent[]): ActivityChunk[] {
  if (!events || events.length === 0) {
    return []
  }

  // Ensure events are sorted by timestamp
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const chunks: ActivityChunk[] = []
  let currentChunk: RawEvent[] = []
  let lastEvent: RawEvent | null = null

  for (const event of sortedEvents) {
    const shouldStartNewChunk = shouldCreateNewChunk(lastEvent, event, currentChunk)

    if (shouldStartNewChunk && currentChunk.length > 0) {
      // Finalize current chunk
      chunks.push(createChunkFromEvents(currentChunk))
      currentChunk = []
    }

    // Add event to current chunk
    currentChunk.push(event)
    lastEvent = event
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(createChunkFromEvents(currentChunk))
  }

  return chunks
}

/**
 * Determines if a new chunk should be started based on the conditions
 */
function shouldCreateNewChunk(lastEvent: RawEvent | null, currentEvent: RawEvent, currentChunk: RawEvent[]): boolean {
  if (!lastEvent || currentChunk.length === 0) {
    return false // First event or empty chunk
  }

  // 1. Time gap: More than 10 seconds
  const lastTime = new Date(lastEvent.timestamp).getTime()
  const currentTime = new Date(currentEvent.timestamp).getTime()
  const timeDiffSeconds = (currentTime - lastTime) / 1000

  if (timeDiffSeconds > 10) {
    return true
  }

  // 2. App context changes
  const lastApp = extractAppName(lastEvent)
  const currentApp = extractAppName(currentEvent)
  
  if (lastApp !== currentApp) {
    return true
  }

  // 3. URL changes (for web content)
  const lastUrl = extractUrl(lastEvent)
  const currentUrl = extractUrl(currentEvent)
  
  if (lastUrl && currentUrl && lastUrl !== currentUrl) {
    return true
  }

  // 4. Window title changes (for native apps)
  const lastWindow = extractWindowTitle(lastEvent)
  const currentWindow = extractWindowTitle(currentEvent)
  
  if (lastWindow && currentWindow && lastWindow !== currentWindow) {
    return true
  }

  // 5. page_view event with new URL (explicit navigation)
  if (currentEvent.type === 'page_view') {
    const newUrl = currentEvent.metadata?.url || currentEvent.url
    const chunkUrls = currentChunk.map(e => extractUrl(e)).filter(Boolean)
    
    if (newUrl && !chunkUrls.includes(newUrl)) {
      return true
    }
  }

  return false
}

/**
 * Creates a chunk summary from a list of events
 */
function createChunkFromEvents(events: RawEvent[]): ActivityChunk {
  if (events.length === 0) {
    throw new Error('Cannot create chunk from empty events')
  }

  const start = events[0].timestamp
  const end = events[events.length - 1].timestamp

  // Calculate primary app (most common)
  const appCounts = new Map<string, number>()
  events.forEach(event => {
    const app = extractAppName(event)
    if (app) {
      appCounts.set(app, (appCounts.get(app) || 0) + 1)
    }
  })
  
  const primary_app = getMostCommon(appCounts) || 'Unknown'

  // Get last known window title and URL
  const window_title = getLastKnown(events, extractWindowTitle) || 'Unknown'
  const primary_url = getLastKnown(events, extractUrl) || ''

  // Extract highlights
  const highlights = extractHighlights(events)

  // Generate summary hint
  const summary_hint = generateSummaryHint(primary_app, window_title, primary_url, highlights)

  return {
    start,
    end,
    primary_app,
    window_title,
    primary_url,
    event_count: events.length,
    events,
    highlights,
    summary_hint
  }
}

/**
 * Extracts highlights from events (clipboard, input, clicks)
 */
function extractHighlights(events: RawEvent[]): ActivityChunk['highlights'] {
  const clipboard_texts: string[] = []
  const input_texts: string[] = []
  const clicked_urls: string[] = []

  events.forEach(event => {
    // Clipboard texts
    if (event.type === 'clipboard_change' && event.metadata?.content) {
      const content = event.metadata.content.trim()
      if (content && content.length > 0 && content.length < 500) { // Reasonable length
        clipboard_texts.push(content)
      }
    }

    // Input texts (smart batched from v3.1)
    if (event.type === 'text_input' && event.metadata?.text) {
      const text = event.metadata.text.trim()
      if (text && text.length > 0) {
        input_texts.push(text)
      }
    }

    // Clicked URLs (from enhanced DOM context)
    if (event.type === 'element_click') {
      const url = event.metadata?.url || event.url
      const href = event.metadata?.href
      
      if (url && !clicked_urls.includes(url)) {
        clicked_urls.push(url)
      }
      if (href && !clicked_urls.includes(href)) {
        clicked_urls.push(href)
      }
    }

    // Page view URLs
    if (event.type === 'page_view') {
      const url = event.metadata?.url || event.url
      if (url && !clicked_urls.includes(url)) {
        clicked_urls.push(url)
      }
    }
  })

  return {
    clipboard_texts: [...new Set(clipboard_texts)], // Remove duplicates
    input_texts,
    clicked_urls: [...new Set(clicked_urls)] // Remove duplicates
  }
}

/**
 * Generates contextual summary hint based on activity patterns
 */
function generateSummaryHint(app: string, windowTitle: string, url: string, highlights: ActivityChunk['highlights']): string {
  const context = `${app} ${windowTitle} ${url}`.toLowerCase()
  const clipboardText = highlights.clipboard_texts.join(' ').toLowerCase()
  const inputText = highlights.input_texts.join(' ').toLowerCase()

  // CRM/Sales patterns
  if (context.includes('hubspot') || context.includes('salesforce')) {
    if (clipboardText.includes('outreach') || inputText.includes('call') || inputText.includes('email')) {
      return 'Preparing outreach message in CRM'
    }
    if (context.includes('contact') || context.includes('lead')) {
      return 'Managing contacts and leads in CRM'
    }
    return 'Working in CRM system'
  }

  // Documentation patterns
  if (context.includes('docs') || context.includes('notion') || context.includes('confluence')) {
    if (inputText.length > 0) {
      return 'Writing/editing documentation'
    }
    return 'Reading documentation'
  }

  // Coding patterns
  if (context.includes('vscode') || context.includes('github') || context.includes('code')) {
    if (inputText.length > 0) {
      return 'Coding and development work'
    }
    return 'Reviewing code or documentation'
  }

  // Communication patterns
  if (context.includes('slack') || context.includes('teams') || context.includes('discord')) {
    if (inputText.length > 0) {
      return 'Team communication and messaging'
    }
    return 'Reading team messages'
  }

  // Email patterns
  if (context.includes('mail') || context.includes('gmail') || context.includes('outlook')) {
    if (inputText.length > 0) {
      return 'Composing email correspondence'
    }
    return 'Managing email inbox'
  }

  // Browser research patterns
  if (app.toLowerCase().includes('chrome') || app.toLowerCase().includes('safari')) {
    if (highlights.clipboard_texts.length > 0) {
      return 'Research and information gathering'
    }
    if (highlights.clicked_urls.length > 2) {
      return 'Web browsing and navigation'
    }
    return 'Web-based activity'
  }

  // Default based on activity type
  if (inputText.length > 0 && highlights.clipboard_texts.length > 0) {
    return 'Active content creation and research'
  }
  if (inputText.length > 0) {
    return 'Text input and content creation'
  }
  if (highlights.clipboard_texts.length > 0) {
    return 'Information gathering and copying'
  }

  return `${app} activity`
}

// Helper functions for extracting data from events
function extractAppName(event: RawEvent): string | null {
  return event.metadata?.app_name || 
         event.metadata?.app || 
         event.app || 
         event.metadata?.application?.name ||
         null
}

function extractUrl(event: RawEvent): string | null {
  return event.metadata?.url || 
         event.url || 
         null
}

function extractWindowTitle(event: RawEvent): string | null {
  return event.metadata?.window_title || 
         event.metadata?.title || 
         event.window_title ||
         null
}

function getMostCommon<T>(countMap: Map<T, number>): T | null {
  let maxCount = 0
  let mostCommon: T | null = null
  
  for (const [item, count] of countMap.entries()) {
    if (count > maxCount) {
      maxCount = count
      mostCommon = item
    }
  }
  
  return mostCommon
}

function getLastKnown<T>(events: RawEvent[], extractor: (event: RawEvent) => T | null): T | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const value = extractor(events[i])
    if (value) {
      return value
    }
  }
  return null
}

/**
 * Utility function to format chunks for AI analysis
 */
export function formatChunksForAI(chunks: ActivityChunk[]): string {
  return JSON.stringify({
    metadata: {
      total_chunks: chunks.length,
      total_events: chunks.reduce((sum, chunk) => sum + chunk.event_count, 0),
      time_span: chunks.length > 0 ? {
        start: chunks[0].start,
        end: chunks[chunks.length - 1].end
      } : null,
      generated_at: new Date().toISOString()
    },
    activity_chunks: chunks
  }, null, 2)
}

/**
 * Utility function to get chunk statistics
 */
export function getChunkStats(chunks: ActivityChunk[]) {
  const totalEvents = chunks.reduce((sum, chunk) => sum + chunk.event_count, 0)
  const apps = [...new Set(chunks.map(chunk => chunk.primary_app))]
  const urls = [...new Set(chunks.flatMap(chunk => chunk.clicked_urls))]
  
  return {
    total_chunks: chunks.length,
    total_events: totalEvents,
    unique_apps: apps.length,
    unique_urls: urls.length,
    apps_used: apps,
    time_span: chunks.length > 0 ? {
      start: chunks[0].start,
      end: chunks[chunks.length - 1].end,
      duration_minutes: Math.round(
        (new Date(chunks[chunks.length - 1].end).getTime() - 
         new Date(chunks[0].start).getTime()) / 60000
      )
    } : null
  }
} 
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Import AI Memory Manager (we'll need to create this or adapt it)
let aiMemoryManager = null;

// Try to load AI Memory Manager
try {
  const { aiMemoryManager: memoryManager } = require('./aiMemoryManager');
  aiMemoryManager = memoryManager;
  console.log('✅ AI Memory Manager loaded successfully');
} catch (error) {
  console.log('⚠️ AI Memory Manager not available - will use basic analysis');
  // Create a simple fallback memory manager
  aiMemoryManager = {
    async findSimilarMemories(text, userId, limit) {
      console.log('📝 [AI MEMORY] Memory manager not available - skipping similar memories');
      return [];
    },
    async analyzePatterns(userId, days) {
      console.log('📊 [AI MEMORY] Memory manager not available - skipping pattern analysis');
      return [];
    }
  };
}

// Enhanced environment variable handling for production
function getEnvironmentVariable(key, fallback = null) {
    // Check multiple sources for environment variables
    const sources = [
        process.env[key],
        process.env[`VITE_${key}`],
        process.env[`REACT_APP_${key}`],
        process.env[`ELECTRON_${key}`]
    ];
    
    for (const value of sources) {
        if (value) {
            console.log(`✅ Found ${key} in environment`);
            return value;
        }
    }
    
    if (fallback) {
        console.log(`⚠️ Using fallback for ${key}`);
        return fallback;
    }
    
    console.error(`❌ Missing required environment variable: ${key}`);
    return null;
}

// Get API keys with enhanced error handling
const apiKey = getEnvironmentVariable('OPENAI_API_KEY');
const supabaseUrl = getEnvironmentVariable('SUPABASE_URL');
const supabaseKey = getEnvironmentVariable('SUPABASE_ANON_KEY');

class AISummaryService {
  constructor() {
    this.openai = null;
    this.supabase = null;
    this.isInitialized = false;
    this.initializeOpenAI();
    this.initializeSupabase();
    
    // Test embedding functionality after initialization
    setTimeout(async () => {
      if (this.isInitialized) {
        await this.testEmbedding();
      }
    }, 2000); // Wait 2 seconds for initialization
  }

  async initializeOpenAI() {
    try {
      // Get OpenAI API key from environment
      // API key is now handled by getEnvironmentVariable function above
      
      if (!apiKey) {
        console.error('❌ OpenAI API key not found. Please set VITE_OPENAI_API_KEY or OPENAI_API_KEY');
        return;
      }

      this.openai = new OpenAI({
        apiKey: apiKey
      });

      this.isInitialized = true;
      console.log('✅ OpenAI service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI service:', error);
    }
  }

  async initializeSupabase() {
    try {
              // Supabase credentials are now handled by getEnvironmentVariable function above
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Supabase client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Supabase client:', error);
    }
  }

  async createDetailedProductivityPrompt(optimizedEvents, sessionTodos, dailyGoal, userId) {
    const timeSpan = this.calculateTimeSpan(optimizedEvents);
    const appUsageAnalysis = this.analyzeAppUsage(optimizedEvents);
    const eventTypeBreakdown = this.analyzeEventTypes(optimizedEvents);

    // Get memory context if userId is provided
    let memoryContext = '';
    if (userId && aiMemoryManager) {
      try {
        console.log('🧠 [AI MEMORY] Fetching memory context for AI prompt...');
        
        // Find similar past sessions
        const currentSessionText = `Working on apps: ${Object.keys(appUsageAnalysis).join(', ')}. Daily goal: ${dailyGoal || 'none'}`;
        console.log('🔍 [AI MEMORY] Searching for similar sessions with text:', currentSessionText);
        
        const similarMemories = await aiMemoryManager.findSimilarMemories(currentSessionText, userId, 3);
        
        if (similarMemories.length > 0) {
          console.log(`✅ [AI MEMORY] Found ${similarMemories.length} similar past sessions for context`);
          memoryContext += `**MEMORY CONTEXT - Similar Past Sessions:**\n`;
          similarMemories.forEach((memory, index) => {
            const date = new Date(memory.created_at).toLocaleDateString();
            memoryContext += `${index + 1}. ${date}: ${memory.summary_text} (${memory.productivity_score}% productive, similarity: ${Math.round((memory.similarity || 0) * 100)}%)\n`;
          });
          memoryContext += '\n';
        } else {
          console.log('📝 [AI MEMORY] No similar past sessions found (this may be expected for new users)');
        }

        // Get recent pattern insights
        console.log('📊 [AI MEMORY] Analyzing user patterns for context...');
        const patterns = await aiMemoryManager.analyzePatterns(userId, 14);
        if (patterns.length > 0) {
          console.log(`✅ [AI MEMORY] Found ${patterns.length} pattern insights for context`);
          memoryContext += `**USER PATTERNS & INSIGHTS:**\n`;
          patterns.forEach(pattern => {
            memoryContext += `• ${pattern.insight} (confidence: ${Math.round(pattern.confidence * 100)}%)\n`;
          });
          memoryContext += '\n';
        } else {
          console.log('📈 [AI MEMORY] No patterns found yet (this is normal for new users)');
        }

        // Get break recommendation history
        console.log('☕ [AI MEMORY] Analyzing break recommendation history...');
        const breakHistory = await aiMemoryManager.analyzeBreakRecommendations(userId, 7);
        if (breakHistory.length > 0) {
          console.log(`✅ [AI MEMORY] Found ${breakHistory.length} break recommendation patterns`);
          memoryContext += `**BREAK RECOMMENDATION HISTORY:**\n`;
          breakHistory.forEach(breakRec => {
            memoryContext += `• ${breakRec.date}: "${breakRec.recommendation}" → ${breakRec.taken ? 'Taken' : 'Ignored'} → ${breakRec.effective ? 'Productivity ↑' : 'Productivity ↓'}\n`;
          });
          memoryContext += '\n';
        } else {
          console.log('☕ [AI MEMORY] No break recommendation history found (will use defaults)');
        }

        if (memoryContext) {
          console.log('🧠 [AI MEMORY] Memory context added to AI prompt successfully');
        } else {
          console.log('🆕 [AI MEMORY] No memory context available - this will be the first memory stored');
        }
      } catch (error) {
        console.error('❌ [AI MEMORY] Failed to get memory context:', error);
      }
    } else {
      console.log('⚠️ [AI MEMORY] No user ID provided or memory manager not available - skipping memory context');
    }
    
    return `You are an expert productivity analyst with access to this user's historical patterns and memory. Analyze this user's computer activity data from the last ${timeSpan} minutes and provide a detailed, personalized productivity assessment.

${memoryContext}

**CONTEXT:**
${dailyGoal ? `Daily Goal: "${dailyGoal}"` : 'No specific daily goal set'}
Time Period: Last ${timeSpan} minutes of activity
Total Events Analyzed: ${optimizedEvents.length}

**CURRENT TODOS:**
${Array.isArray(sessionTodos) && sessionTodos.length > 0 ? sessionTodos.map(todo => 
  `- ${todo.completed ? '✅' : '⏳'} ${todo.text} (Priority: ${todo.priority || 'medium'})`
).join('\n') : 'No active todos'}

**ACTIVITY DATA:**
${JSON.stringify(optimizedEvents, null, 2)}

**APP & WEBSITE USAGE PATTERNS:**
${Object.entries(appUsageAnalysis).map(([item, data]) => {
  if (data.isWebsite) {
    return `${item}: ${data.events} events, ${data.displayTime || data.timeSpent + 'min'} estimated`;
  } else {
    return `${item}: ${data.events} events, ${data.timeSpent}min estimated`;
  }
}).join('\n')}

**SPECIFIC WEBSITE TRACKING:**
For browser activity, analyze and provide specific website breakdowns instead of just "Chrome" or "Safari". 
Extract the actual websites visited (LinkedIn, GitHub, Google Docs, etc.) and estimate time spent on each.
Include both active interaction time AND inactive/reading time.

**CONTEXTUAL SPECIFICITY:**
- For video editing: Identify specific projects, export actions, file saves
- For content creation: Track what type of content (posts, articles, videos)
- For coding: Identify languages, frameworks, specific features being built
- For research: Note what topics are being researched and information gathered
- For communication: Track what type of messages, meetings, or coordination
- ALWAYS be specific about what the user actually accomplished, not just time spent

**ANALYSIS INSTRUCTIONS:**

1. **KEY ACCOMPLISHMENTS EXTRACTION (SMART PATTERN ANALYSIS):**
   **ANALYZE LIKE A HUMAN**: Look at the data patterns and infer what was actually accomplished:
   
   **PATTERN ANALYSIS APPROACH:**
   - Study the sequence of apps and activities chronologically
   - Look for evidence of completion: file operations, saves, exports, uploads, publishing actions
   - Identify tool chains that work together toward a common goal
   - Recognize when time spent + tools used = meaningful work accomplished
   
   **ACCOMPLISHMENT INFERENCE RULES:**
   - If you see creative/editing apps + file management = assume creation/editing work was completed
   - If you see communication tools + document work = assume business/coordination tasks were completed  
   - If you see research tools + note-taking = assume learning/analysis work was completed
   - If you see development tools + testing = assume coding/building work was completed
   - If you see any focused tool usage for meaningful time = assume productive work was done
   
   **BE CREATIVE AND LOGICAL:**
   - Don't limit yourself to predefined patterns
   - Use common sense about what tools accomplish together
   - Look for evidence in the activity data itself
   - If someone spends focused time in productive tools, assume they accomplished something meaningful
   - Infer the most logical accomplishment based on the tools and time invested
   
   **EXAMPLES OF INFERENCE (but don't limit yourself to these):**
   - Long focused time in any creative tool = "Created/edited content"
   - Sequence of related productivity tools = "Completed workflow tasks"
   - Research + documentation pattern = "Researched and documented findings"
   - ANY sustained productive activity = "Made progress on [type] work"
   
   Only avoid claiming accomplishments if there's clear evidence of very brief usage or abandonment.

2. **PRODUCTIVITY ASSESSMENT WITH CONTEXT ANALYSIS:**
   Calculate Focus% = productive-app seconds ÷ total seconds
   Calculate SwitchRate = app/URL switches per minute
   Calculate DeepWorkMin = longest uninterrupted productive sequence in minutes
   
   **CONTEXT-BASED SCORING:** Before assigning productivity scores, analyze if apps truly work together:
   - Look at window titles, URLs, and content to determine if apps serve the same goal
   - Example: ChatGPT + Google Docs + Email could be content creation workflow (HIGH productivity)
   - Example: Work app + Social media + Work app could be distraction pattern (LOWER productivity)
   - Use text content and context clues to determine genuine workflow vs random switching
   
   **REALISTIC SCORING RUBRIC:**
   • 85-100 = Exceptional focus: Focus ≥80%, SwitchRate ≤1, DeepWorkMin ≥15, OR clear task completion with evidence
   • 70-84  = Good focus: Focus 60-79%, SwitchRate 1-3, DeepWorkMin ≥8, OR consistent productive workflow
   • 50-69  = Mixed focus: Focus 40-59%, SwitchRate 3-5, some productive work, but frequent switching
   • 30-49  = Scattered: Focus 20-39%, SwitchRate 5-8, minimal productive work, lots of switching
   • 0-29   = Very scattered: Focus <20% OR SwitchRate ≥8, mostly unproductive activity
   
   **REALISTIC TASK ANALYSIS:**
   - Group app switches that serve the SAME task within 10 minutes (shorter window)
   - Examples of productive clusters:
     • Content Creation: ChatGPT (draft) → Docs (edit) → Simplified (schedule)
     • Development: VS Code (code) → Browser (test) → Terminal (deploy)
     • Research: Browser (search) → Notion (notes) → ChatGPT (explain)
     • Communication: Slack (discuss) → Docs (document) → Email (follow-up)
   
   - Count as "distraction" if switching to UNRELATED tasks or entertainment
   - Use context clues (window titles, URLs, content) to determine task relationships
   - Be realistic about what constitutes productive work vs. just activity

**REALISTIC PRODUCTIVITY ASSESSMENT:**
Before calculating productivity scores, analyze the actual work patterns:

1. **Evidence-Based Analysis**: Look for concrete evidence of work completion
   - File saves, exports, uploads, publishing actions
   - Communication sent, emails written, messages sent
   - Code commits, deployments, testing
   - Research documented, notes taken, findings recorded
   
2. **Time Quality Assessment**: 
   - How much time was spent in productive apps vs. distractions?
   - Was the time spent actually working or just browsing?
   - Did the user accomplish specific tasks or just move between apps?
   
3. **Realistic Scoring**: 
   - 85-100% = Clear evidence of focused work completion
   - 70-84% = Good productive time with some task completion
   - 50-69% = Mixed productivity, some work done but lots of switching
   - 30-49% = Mostly unproductive, minimal task completion
   - 0-29% = Very scattered, no clear work accomplished

**ENHANCED TASK DETECTION & BULK WORK PATTERNS:**
When identifying completed todos and tasks, look for these patterns:

1. **BULK WORK DETECTION**: Look for repeated patterns that indicate bulk work:
   - Multiple similar actions (drafting emails, sending messages, reviewing ads)
   - Time spent in communication apps (Gmail, LinkedIn, Slack, etc.)
   - Text content patterns showing outreach, messaging, or communication
   - App usage patterns that suggest systematic work (not just browsing)

2. **OUTREACH WORK DETECTION**: 
   - If user spends time in Gmail, LinkedIn, or communication apps = likely outreach work
   - Multiple email drafts or messages sent = bulk outreach completed
   - Time spent in Meta Ads, Google Ads, or advertising platforms = ad review work
   - Look for patterns like: "Drafted 15+ outreach emails", "Reviewed Meta Ads campaign", "Sent 20+ LinkedIn messages"

3. **CONSERVATIVE BUT REALISTIC ESTIMATES**:
   - If user spent 30 minutes in Gmail drafting emails = likely completed 10-15 outreach emails
   - If user spent 20 minutes in Meta Ads = likely reviewed and optimized ads
   - If user spent time in LinkedIn = likely sent connection requests or messages
   - Include time estimates like: "Drafted 15+ outreach emails (30 min)", "Reviewed Meta Ads (20 min)"

4. **EVIDENCE-BASED BUT PATTERN-AWARE**:
   - Don't require specific text evidence for every task
   - Use app usage patterns and time spent to infer completed work
   - If user spent significant time in productive apps, they likely accomplished related tasks
   - Be realistic about what can be accomplished in the time spent

2. **WEBSITE-SPECIFIC ANALYSIS:** CRITICAL - Do NOT say "Chrome" or "Safari". Identify the actual websites:
   - Analyze window titles, URLs, and content to identify SPECIFIC websites and services
   - Examples: "OpenAI API pricing" = "OpenAI", "Explore GPTs" = "ChatGPT", "GitHub" = "GitHub"
   - For any browser activity, you MUST identify the actual website/service being used
   - If you can't identify the specific site, say "Unknown website" instead of "Chrome"
   - Estimated time on each website including inactive time
   - Context of what they were doing on each site
   - Productivity vs distraction assessment for each website

3. **CONTEXT-AWARE TASK CLUSTERING:** Analyze the PURPOSE of each app switch:
   - Look for evidence of related tasks across different apps
   - Group activities that serve the SAME goal within 15 minutes
   - Distinguish between:
     • Productive workflow switches (ChatGPT → Docs → Email for content creation)
     • Distraction switches (Work → Instagram → Work)
     • Break switches (Work → Lunch → Work)
   
   - Use window titles, URLs, and content to determine task relationships
   - Reward productive multi-tool workflows
   - Only penalize switching to UNRELATED tasks

4. **HIDDEN TASK DETECTION:** Look for evidence of completed tasks in:
   - File saves with matching keywords
   - Commit messages containing task phrases
   - Outgoing emails with task-related content
   - Terminal commands related to tasks
   Mention these in analysis but do not add to completedTodos without clear evidence.

5. **BREAK & IDLE TIME ANALYSIS:** Distinguish between intentional breaks and distractions:
   - **Intentional Breaks**: Long periods (>5 min) with no activity = likely healthy breaks
   - **Natural Pauses**: 1-5 minute gaps between tasks = normal workflow pauses  
   - **Task Switching**: Brief gaps (<1 min) = normal app/task transitions
   - **DO NOT PENALIZE BREAKS**: If you detect break patterns, mention them positively
   - **Break Indicators**: Look for patterns like:
     • Complete stop in activity for extended periods
     • Return to productive work after idle time
     • Consistent break timing (lunch, etc.)
   - **Productivity During Breaks**: Score the ACTIVE work periods, not the break time
   - **Break Benefits**: Acknowledge when breaks appear to refresh and improve subsequent work quality

6. **DISTRACTION DETECTION & ANALYSIS:** Identify actual distractions (not breaks):
   - **Real Distractions**: Entertainment, non-work social media during work time
   - **Frequent Purposeless Switching**: Rapid app changes without workflow logic
   - **Off-Task Activities**: Personal activities during focused work time
   - **Context Breaks**: Switching to unrelated tasks that break focus
   - **BUT NOT**: Intentional breaks, lunch, natural workflow pauses
   
   **DISTRACTION ANALYSIS REQUIRED:** If productivity is less than 100%, analyze and identify specific distractions:
   - Look for entertainment websites, social media, gaming, or non-work activities
   - Identify excessive app switching without clear purpose
   - Note time spent on unproductive activities
   - Analyze patterns that broke focus or workflow
   - Provide specific examples of what caused productivity loss
   - Suggest strategies to avoid these distractions in future sessions

7. **PRODUCTIVITY SUGGESTIONS:** Provide 2-3 specific, actionable suggestions based on THIS INTERVAL's analysis:
   - **BE SPECIFIC TO THIS SESSION**: Don't give generic advice, analyze what actually happened
   - **For Content Creation Workflows**: "Great workflow! Consider batching similar content creation tasks together"
   - **For Development Work**: "Strong focus on coding. Consider using split-screen to reduce context switching between editor and browser"
   - **For Video Editing**: "Excellent creative work! Consider setting up templates to speed up future editing workflows"
   - **For Research Work**: "Good information gathering. Try using a note-taking app to capture insights as you research"
   - **For High App Switching**: Only suggest reducing if it's truly unproductive, not if it's workflow-related
   - **For Low Activity**: "Consider taking a break or switching to a different type of task to re-energize"
   - **For Mixed Work**: "Try time-blocking similar tasks together to maintain deeper focus"
   
   **MAKE IT PERSONAL**: Look at what tools they used, what they accomplished, and their work patterns to give tailored advice for improvement.

8. **ENERGY & FOCUS ASSESSMENT:** 
   EnergyLevel = ProductivityPct ± trend adjustment
   
   **ADAPTIVE BREAK RECOMMENDATIONS:**
   Check past break recommendations and their effectiveness:
   • If user took a break when recommended AND productivity improved after → Use same recommendation style
   • If user took a break but productivity declined → Try different approach (shorter breaks, different timing, or no breaks)
   • If user ignored break recommendation AND productivity declined → Emphasize the recommendation more strongly with specific benefits
   • If user ignored break recommendation BUT productivity stayed high → Respect their work style, suggest lighter recommendations or focus on other productivity factors
   • If user consistently ignores breaks but maintains high productivity → Adapt to their flow state, suggest micro-breaks instead
   • If user takes breaks but they're ineffective → Suggest different break types (movement, hydration, eye rest, etc.)
   
   **DEFAULT BREAK MAPPING (if no past data):**
   • 90-100 → "Keep going—you're in flow"
   • 70-89  → "Take a 5-min stretch soon"
   • 40-69  → "Schedule a 15-min recharge break"
   • <40    → "Step away for at least 15 min"

9. **PRODUCTIVITY SUGGESTIONS:** Provide 2-3 specific, actionable suggestions based on the analysis:
   - Focus on immediate, implementable improvements
   - Consider the user's current workflow and tools
   - Suggest specific techniques, tools, or approaches
   - Examples: "Try using Pomodoro technique for the next 25 minutes", "Consider grouping similar tasks together", "Set a specific goal for your next 30-minute block"

**REQUIRED OUTPUT FORMAT:**
You MUST return ONLY a valid JSON object with this exact structure. No markdown, no code blocks, just pure JSON:

{
  "sessionOverview": "High-level summary of the main work focus and activities (e.g., 'AI-assisted content creation session', 'Research and development work', 'Team communication and planning')",
  "summaryText": "Detailed 2-3 sentence summary of what the user accomplished in this time period, including specific apps used and estimated time spent on each major activity.",
  "productivityPct": [0-100 integer representing estimated productivity percentage],
  "completedTodos": ["Array of up to 5 todo texts that appear to have been completed based on activity evidence"],
  "pendingTodos": ["Array of todo texts that are still in progress or not started"],
  "keyTasks": ["Array of 3-5 specific tasks/activities performed, with time estimates where possible - THESE ARE YOUR ACCOMPLISHMENTS"],
  "appUsage": [
    { "app": "OpenAI", "minutes": 15 },
    { "app": "VS Code", "minutes": 45 },
    { "app": "ChatGPT", "minutes": 10 }
  ],
  "distractionPoints": "REQUIRED: If productivity < 100%, provide specific analysis of distractions and time-wasters. Include exact apps/websites that caused distraction, time spent on unproductive activities, and focus-breaking patterns. If productivity is 100%, say 'No significant distractions detected'",
  "distractionsToAvoid": ["Array of 2-3 specific distractions to avoid in future sessions, e.g., 'Limit social media browsing during work time', 'Reduce app switching between unrelated tasks'"],
  "appContext": [
    { "app": "OpenAI", "context": "Researching API pricing and fine-tuning options - identify specific website from window titles" },
    { "app": "VS Code", "context": "Active coding session working on React components" },
    { "app": "ChatGPT", "context": "Exploring GPTs and AI capabilities - analyze window titles to identify actual service" }
  ],
  "energyLevel": 75,
  "breakRecommendation": "Specific suggestion like 'Keep going!', 'Take a 5-min break soon', 'Time for a 15-min recharge', or 'You're in the zone!' based on energy level and productivity trends",
  "energyTrend": "increasing",
  "suggestions": ["Array of 2-3 specific, actionable suggestions to improve productivity, focus, or workflow based on the analysis"]
}

**IMPORTANT GUIDELINES:**
- Be specific and evidence-based in your analysis
- Only mark todos as completed if there's clear evidence in the activity data
- Estimate app usage time based on event frequency and patterns
- Provide detailed context for each app that shows meaningful usage
- Be honest about productivity - don't inflate scores without evidence
- Focus on actionable insights and specific observations
- If no meaningful activity is detected, reflect that in lower productivity scores
- **CRITICAL: Recognize that modern work often involves productive multi-tool workflows**
- **REWARD productive app switching that serves the same goal (ChatGPT → Docs → Email for content creation)**
- **Only penalize switching to UNRELATED tasks or distractions**
- **For AI-assisted work, recognize that ChatGPT/OpenAI usage can be highly productive when used purposefully**
- **Be specific about AI assistance: research, coding help, content creation, problem-solving, learning**
- **Consider task completion and goal achievement, not just time spent in single apps**
- **BREAK AWARENESS: Do NOT penalize intentional breaks, idle time, or natural pauses - they are healthy and necessary**
- **SCORE ACTIVE PERIODS: Calculate productivity based on active work time, not total time including breaks**
- **BREAK BENEFITS: Acknowledge when breaks appear to refresh and improve subsequent work quality**

Analyze the data thoroughly and provide your assessment:`;
  }

  calculateTimeSpan(events) {
    if (events.length === 0) return 0;
    
    const timestamps = events.map(e => new Date(e.timestamp).getTime());
    const earliest = Math.min(...timestamps);
    const latest = Math.max(...timestamps);
    
    return Math.round((latest - earliest) / 60000) || 1; // At least 1 minute
  }

  analyzeAppUsage(events) {
    const appUsage = {};
    const websiteUsage = {};
    
    events.forEach(event => {
      const app = event.app_name || event.window_title || 'Unknown';
      
      // Check if this is a browser event with a URL
      if ((app.toLowerCase().includes('chrome') || 
           app.toLowerCase().includes('safari') || 
           app.toLowerCase().includes('firefox') || 
           app.toLowerCase().includes('edge')) && 
          event.url) {
        
        // Extract domain from URL
        try {
          const domain = this.extractDomain(event.url);
          const websiteKey = `${domain} (Browser)`;
          
          if (!websiteUsage[websiteKey]) {
            websiteUsage[websiteKey] = { 
              events: 0, 
              timeSpent: 0, 
              domain: domain,
              isWebsite: true,
              urls: new Set()
            };
          }
          websiteUsage[websiteKey].events++;
          websiteUsage[websiteKey].urls.add(event.url);
        } catch (e) {
          // If URL parsing fails, fall back to app tracking
          if (!appUsage[app]) {
            appUsage[app] = { events: 0, timeSpent: 0, isWebsite: false };
          }
          appUsage[app].events++;
        }
      } else {
        // Regular app tracking for non-browser apps
        if (!appUsage[app]) {
          appUsage[app] = { events: 0, timeSpent: 0, isWebsite: false };
        }
        appUsage[app].events++;
      }
    });
    
    // Estimate time spent for regular apps
    Object.keys(appUsage).forEach(app => {
      appUsage[app].timeSpent = Math.round(appUsage[app].events * 0.15); // Slightly higher estimate for desktop apps
    });
    
    // Estimate time spent for websites (more granular)
    Object.keys(websiteUsage).forEach(website => {
      // Website events are typically more frequent, so use a different multiplier
      const baseTime = Math.round(websiteUsage[website].events * 0.08); // Base time estimation
      const uniqueUrls = websiteUsage[website].urls.size;
      
      // Add bonus time for websites with multiple unique URLs (indicates more activity)
      const urlBonus = Math.min(uniqueUrls * 0.3, 2); // Max 2 minutes bonus
      websiteUsage[website].timeSpent = Math.max(baseTime + urlBonus, 0.1); // Minimum 6 seconds
      
      // Convert to minutes and seconds for display
      const totalSeconds = Math.round(websiteUsage[website].timeSpent * 60);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      websiteUsage[website].displayTime = minutes > 0 ? 
        `${minutes}m ${seconds}s` : `${seconds}s`;
      
      // Clean up the Set for JSON serialization
      websiteUsage[website].urls = Array.from(websiteUsage[website].urls);
    });
    
    // Merge website usage into app usage for compatibility
    return { ...appUsage, ...websiteUsage };
  }

  extractDomain(url) {
    try {
      // Handle URLs that might not have protocol
      let processedUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        processedUrl = 'https://' + url;
      }
      
      const parsedUrl = new URL(processedUrl);
      let domain = parsedUrl.hostname;
      
      // Remove www. prefix
      if (domain.startsWith('www.')) {
        domain = domain.substring(4);
      }
      
      // Return the domain as-is - let ChatGPT recognize it naturally
      return domain;
    } catch (e) {
      // If URL parsing fails, return the original URL
      return url.split('/')[0] || 'Unknown Website';
    }
  }

  analyzeEventTypes(events) {
    const eventTypes = {};
    
    events.forEach(event => {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    });
    
    return eventTypes;
  }

  cleanAndParseJSON(responseText) {
    try {
      // First, try to parse as-is
      return JSON.parse(responseText);
    } catch (error) {
      // If that fails, try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (innerError) {
          console.error('❌ Failed to parse JSON from code block:', innerError);
        }
      }
      
      // Try to find JSON object in the text
      const jsonObjectMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        try {
          return JSON.parse(jsonObjectMatch[0]);
        } catch (innerError) {
          console.error('❌ Failed to parse JSON object from text:', innerError);
        }
      }
      
      throw new Error(`Failed to parse JSON from response: ${responseText.substring(0, 200)}...`);
    }
  }

  async processSimplePrompt(prompt) {
    if (!this.isInitialized || !this.openai) {
      console.error('❌ OpenAI service not initialized');
      return null;
    }

    try {
      console.log('🤖 Processing simple AI prompt...');
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a productivity assistant. Respond with valid JSON only - no markdown, no code blocks, just pure JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1000
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('No response from OpenAI');
      }

      console.log('🤖 AI response:', responseText);
      const analysis = this.cleanAndParseJSON(responseText);
      return analysis;

    } catch (error) {
      console.error('❌ Failed to process simple prompt:', error);
      return null;
    }
  }

  async processOptimizedData(optimizedEvents, sessionTodos = [], dailyGoal, userId) {
    if (!this.isInitialized || !this.openai) {
      console.error('❌ OpenAI service not initialized');
      return null;
    }

    if (optimizedEvents.length === 0) {
      console.log('⚠️ No optimized events to process');
      return null;
    }

    // Debug and fix sessionTodos
    console.log('🔍 [DEBUG] sessionTodos type:', typeof sessionTodos, 'value:', sessionTodos);
    if (!Array.isArray(sessionTodos)) {
      console.log('⚠️ [DEBUG] sessionTodos is not an array, converting to empty array');
      sessionTodos = [];
    }

    try {
      console.log(`🤖 Processing ${optimizedEvents.length} optimized events with AI...`);
      const startTime = Date.now();

      const prompt = await this.createDetailedProductivityPrompt(optimizedEvents, sessionTodos, dailyGoal, userId);
      
      // 🔍 TOKEN DEBUGGING - Estimate token count
      const promptLength = prompt.length;
      const estimatedTokens = Math.ceil(promptLength / 4); // Rough estimate: ~4 chars per token
      console.log(`🔍 [TOKEN DEBUG] Prompt length: ${promptLength} characters`);
      console.log(`🔍 [TOKEN DEBUG] Estimated tokens: ${estimatedTokens}`);
      console.log(`🔍 [TOKEN DEBUG] Processing ${optimizedEvents.length} events`);
      
      if (estimatedTokens > 25000) {
        console.warn(`⚠️ [TOKEN WARNING] High token count: ${estimatedTokens} (may hit limits)`);
      }
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o", // Switched to gpt-4o for best quality/cost
        messages: [
          {
            role: "system",
            content: "You are an expert productivity analyst specializing in computer activity analysis. You provide detailed, evidence-based assessments of user productivity patterns. CRITICAL: Always respond with valid JSON only - no markdown formatting, no code blocks, no explanations, just pure JSON. The response must be parseable by JSON.parse()."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2, // Low temperature for consistent analysis
        max_tokens: 4000  // Increased for testing - was 1200
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response with error handling
      let analysis;
      try {
        analysis = this.cleanAndParseJSON(responseText);
        console.log('✅ [AI SUMMARY] JSON parsed successfully');
      } catch (parseError) {
        console.error('❌ [AI SUMMARY] Failed to parse JSON response:', parseError);
        return null;
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ AI analysis completed in ${processingTime}ms`);
      
      // Validate the analysis has required fields
      const requiredFields = ['sessionOverview', 'summaryText', 'productivityPct', 'completedTodos', 'pendingTodos', 'keyTasks', 'appUsage', 'distractionPoints', 'appContext', 'energyLevel', 'breakRecommendation', 'energyTrend'];
      const missingFields = requiredFields.filter(field => !analysis[field]);
      
      if (missingFields.length > 0) {
        console.error('❌ [AI SUMMARY] Missing required fields in analysis:', missingFields);
        return null;
      }
      
      console.log('✅ [AI SUMMARY] All required fields present');

      return analysis;

    } catch (error) {
      console.error('❌ Failed to process optimized data with AI:', error);
      return null;
    }
  }

  // Test embedding functionality
  async testEmbedding() {
    try {
      console.log('🧪 [AI MEMORY] Testing embedding functionality...');
      
      if (!aiMemoryManager) {
        console.error('❌ [AI MEMORY] Memory manager not available for testing');
        return false;
      }
      
      const testText = "Working on VS Code, productivity 85%, completed coding tasks";
      const embedding = await aiMemoryManager.generateEmbedding(testText);
      
      if (embedding && embedding.length > 0) {
        console.log('✅ [AI MEMORY] Embedding test successful - dimensions:', embedding.length);
        return true;
      } else {
        console.error('❌ [AI MEMORY] Embedding test failed - no embedding generated');
        return false;
      }
    } catch (error) {
      console.error('❌ [AI MEMORY] Embedding test error:', error);
      return false;
    }
  }

  // Legacy methods for backward compatibility
  async generateIntervalSummary(trackingData) {
    console.log('⚠️ Using legacy generateIntervalSummary - consider using processOptimizedData instead');
    return this.processOptimizedData(trackingData.events || [], trackingData.sessionTodos, trackingData.dailyGoal);
  }

  async generateFinalSessionSummary(summaries, sessionData) {
    console.log('⚠️ Legacy generateFinalSessionSummary called - not implemented in new system');
    return null;
  }

  async saveIntervalSummary(sessionId, userId, analysis, trackingData, chunkNumber, promptUsed) {
    try {
      console.log('[DEBUG][AI SUMMARY] Saving interval summary:', {
        sessionId,
        userId,
        chunkNumber,
        summaryText: analysis.summaryText?.slice(0, 100),
        productivityPct: analysis.productivityPct,
        summaryType: 'productivity_chunk',
        createdAt: new Date().toISOString()
      });

      if (!this.supabase) {
        console.error('[DEBUG][AI SUMMARY] Supabase client not initialized');
        return false;
      }

      const { error } = await this.supabase
        .from('ai_summaries')
        .insert({
          session_id: sessionId,
          user_id: userId,
          summary_text: analysis.summaryText,
          summary_type: 'productivity_chunk',
          chunk_number: chunkNumber,
          productivity_score: analysis.productivityPct,
          energy_level: analysis.energyLevel,
          energy_trend: analysis.energyTrend,
          break_recommendation: analysis.breakRecommendation,
          task_completion: {
            completed: analysis.completedTodos,
            pending: analysis.pendingTodos,
            key_tasks: analysis.keyTasks
          },
          app_usage_summary: analysis.appUsage.reduce((acc, item) => {
            acc[item.app] = item.minutes;
            return acc;
          }, {}),
          suggestions: [analysis.distractionPoints],
          raw_data_analyzed: {
            total_events: trackingData?.events?.length || 0,
            app_context: analysis.appContext,
            energy_metrics: {
              level: analysis.energyLevel,
              trend: analysis.energyTrend,
              recommendation: analysis.breakRecommendation
            }
          },
          ai_prompt_used: promptUsed,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('[DEBUG][AI SUMMARY] Failed to save AI summary to Supabase:', error);
        return false;
      }

      console.log('[DEBUG][AI SUMMARY] Saved interval summary successfully.');
      return true;

    } catch (error) {
      console.error('[DEBUG][AI SUMMARY] Error saving AI summary:', error);
      return false;
    }
  }
}

// Export singleton instance
const aiSummaryService = new AISummaryService();
module.exports = { aiSummaryService };
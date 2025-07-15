const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

class AISummaryService {
  constructor() {
    this.openai = null;
    this.supabase = null;
    this.isInitialized = false;
    this.initializeOpenAI();
    this.initializeSupabase();
  }

  async initializeOpenAI() {
    try {
      // Get OpenAI API key from environment
      const apiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      
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
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Supabase client initialized');
      console.log('✅ Supabase URL:', supabaseUrl.substring(0, 30) + '...');
      console.log('✅ Supabase Key length:', supabaseKey.length);
    } catch (error) {
      console.error('❌ Failed to initialize Supabase client:', error);
    }
  }

  createDetailedProductivityPrompt(optimizedEvents, sessionTodos, dailyGoal) {
    const timeSpan = this.calculateTimeSpan(optimizedEvents);
    const appUsageAnalysis = this.analyzeAppUsage(optimizedEvents);
    const eventTypeBreakdown = this.analyzeEventTypes(optimizedEvents);
    
    return `You are an expert productivity analyst. Analyze this user's computer activity data from the last ${timeSpan} minutes and provide a detailed productivity assessment.

**CONTEXT:**
${dailyGoal ? `Daily Goal: "${dailyGoal}"` : 'No specific daily goal set'}
Time Period: Last ${timeSpan} minutes of activity
Total Events Analyzed: ${optimizedEvents.length}

**CURRENT TODOS:**
${sessionTodos.length > 0 ? sessionTodos.map(todo => 
  `- ${todo.completed ? '✅' : '⏳'} ${todo.text} (Priority: ${todo.priority || 'medium'})`
).join('\n') : 'No active todos'}

**IMPORTANT:** When marking completedTodos in your output, ALWAYS use the exact wording of the todo as shown in the CURRENT TODOS list above. Do not paraphrase or change the text. This is required for robust matching.

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

**EVENT TYPE BREAKDOWN:**
${Object.entries(eventTypeBreakdown).map(([type, count]) => `${type}: ${count}`).join(', ')}

**ANALYSIS INSTRUCTIONS:**

1. **PRODUCTIVITY ASSESSMENT:** Analyze the activity patterns, app switching frequency, text input quality, and task focus. Consider:
   - Are they staying focused on productive apps/websites?
   - How much context switching between apps and websites?
   - Quality and length of text inputs (coding, writing, communication)
   - Time spent on each application and specific website relative to productivity goals

2. **WEBSITE-SPECIFIC ANALYSIS:** CRITICAL - Do NOT say "Chrome" or "Safari". Identify the actual websites:
   - Analyze window titles, URLs, and content to identify SPECIFIC websites and services
   - Examples: "OpenAI API pricing" = "OpenAI", "Explore GPTs" = "ChatGPT", "GitHub" = "GitHub"
   - Window title containing "pricing" or "fine-tuning" = "OpenAI" 
   - For any browser activity, you MUST identify the actual website/service being used
   - Never use generic browser names in your analysis - always identify the specific service
   - If you can't identify the specific site, say "Unknown website" instead of "Chrome"
   - Estimated time on each website including inactive time
   - Context of what they were doing on each site
   - Productivity vs distraction assessment for each website

3. **TODO ANALYSIS:** Based on the activity data, determine:
   - Which todos might have been completed - BE GENEROUS with simple navigation tasks (e.g., "go to Discord" = completed if Discord was accessed)
   - Simple app-based tasks should be marked complete if the app was used (e.g., "open Chrome", "go to Discord", "check email")
   - Complex tasks require more evidence (e.g., "write report", "fix bug", "complete project")
   - Which todos show signs of being worked on
   - Patterns that suggest specific tasks are in progress

4. **APP CONTEXT ANALYSIS:** For each significant app used, infer what the user was doing:
   - Code editors: What type of coding/editing
   - Browsers: What sites, research vs distraction
   - Communication apps: Work-related vs social
   - Creative tools: What type of creation

5. **DISTRACTION DETECTION:** Identify:
   - Excessive social media or entertainment
   - Frequent app switching without purpose
   - Long periods in non-productive applications
   - Context switches that break focus

6. **ENERGY & FOCUS ASSESSMENT:** Analyze patterns that indicate energy levels:
   - High energy: Sustained focus, consistent typing patterns, minimal distraction apps
   - Medium energy: Moderate focus with some context switching, balanced productive work
   - Low energy: Frequent distractions, short bursts of activity, entertainment apps, erratic patterns
   - Fatigue indicators: Increased social media, entertainment, or break-type activities
   - Recommend breaks when patterns suggest declining focus or extended work periods

**REQUIRED OUTPUT FORMAT:**
Return ONLY a valid JSON object with this exact structure:

{
  "summaryText": "Detailed 2-3 sentence summary of what the user accomplished in this time period, including specific apps used and estimated time spent on each major activity.",
  "productivityPct": [0-100 integer representing estimated productivity percentage],
  "energyLevel": [0-100 integer representing estimated current energy/focus level based on activity patterns],
  "shouldTakeBreak": [boolean - true if patterns suggest fatigue or need for break],
  "breakRecommendation": "Specific break recommendation if shouldTakeBreak is true, otherwise null",
  "completedTodos": ["Array of todo texts that appear to have been completed based on activity evidence (MUST use exact wording from CURRENT TODOS)"],
  "pendingTodos": ["Array of todo texts that are still in progress or not started (MUST use exact wording from CURRENT TODOS)"],
  "keyTasks": ["Array of 3-5 specific tasks/activities performed, with time estimates where possible"],
  "appUsage": [
    { "app": "OpenAI", "minutes": [estimated minutes - NEVER use 'Chrome', always identify the actual website] },
    { "app": "VS Code", "minutes": [estimated minutes spent] },
    { "app": "ChatGPT", "minutes": [estimated minutes - extract from window titles and content] }
  ],
  "distractionPoints": "Specific description of any distractions or productivity issues identified, or 'No significant distractions detected' if none found",
  "appContext": [
    { "app": "OpenAI", "context": "Researching API pricing and fine-tuning options - identify specific website from window titles" },
    { "app": "VS Code", "context": "Active coding session working on React components" },
    { "app": "ChatGPT", "context": "Exploring GPTs and AI capabilities - analyze window titles to identify actual service" }
  ],
  "inferredTasks": ["Array of inferred tasks/activities from activity patterns"]
}

**IMPORTANT GUIDELINES:**
- Be specific and evidence-based in your analysis
- BE LENIENT with simple navigation/app-opening tasks - if user accessed an app mentioned in todo, mark it complete
- For example: "go to Discord" = completed if Discord appears in activity data
- For example: "open Chrome" = completed if Chrome/browser activity is detected
- For example: "check email" = completed if email app or webmail is accessed
- Only require strong evidence for complex tasks like "write document", "fix code", "complete analysis"
- Estimate app usage time based on event frequency and patterns
- Provide detailed context for each app that shows meaningful usage
- Be honest about productivity - don't inflate scores without evidence
- Focus on actionable insights and specific observations
- If no meaningful activity is detected, reflect that in lower productivity scores
- **ENERGY ASSESSMENT:** Base energy levels on activity patterns, not just productivity
- **BREAK RECOMMENDATIONS:** Suggest breaks for extended work periods (>45min), signs of fatigue, or declining focus patterns
- Energy can be high even during lower productivity periods if the user is actively engaged

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
      
      // Map common domains to more recognizable names
      const domainMappings = {
        'linkedin.com': 'LinkedIn',
        'github.com': 'GitHub', 
        'stackoverflow.com': 'Stack Overflow',
        'google.com': 'Google Search',
        'youtube.com': 'YouTube',
        'twitter.com': 'Twitter',
        'x.com': 'X (Twitter)',
        'facebook.com': 'Facebook',
        'instagram.com': 'Instagram',
        'reddit.com': 'Reddit',
        'medium.com': 'Medium',
        'notion.so': 'Notion',
        'figma.com': 'Figma',
        'slack.com': 'Slack',
        'discord.com': 'Discord',
        'gmail.com': 'Gmail',
        'outlook.com': 'Outlook',
        'docs.google.com': 'Google Docs',
        'drive.google.com': 'Google Drive',
        'sheets.google.com': 'Google Sheets'
      };
      
      return domainMappings[domain] || domain;
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

  async processOptimizedData(optimizedEvents, sessionTodos = [], dailyGoal) {
    if (!this.isInitialized) {
      console.error('❌ OpenAI service not initialized');
      return null;
    }

    if (optimizedEvents.length === 0) {
      console.log('⚠️ No optimized events to process');
      return null;
    }

    try {
      console.log(`🤖 Processing ${optimizedEvents.length} optimized events with AI...`);
      const startTime = Date.now();

      const prompt = this.createDetailedProductivityPrompt(optimizedEvents, sessionTodos, dailyGoal);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o", // Switched to gpt-4o for best quality/cost
        messages: [
          {
            role: "system",
            content: "You are an expert productivity analyst specializing in computer activity analysis. You provide detailed, evidence-based assessments of user productivity patterns. Always respond with valid JSON only - no markdown formatting, no code blocks, just pure JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2, // Low temperature for consistent analysis
        max_tokens: 1200
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('No response from OpenAI');
      }

      console.log('🤖 Raw AI response:', responseText);

      // Parse the JSON response with error handling
      const analysis = this.cleanAndParseJSON(responseText);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ AI analysis completed in ${processingTime}ms`);
      console.log('📊 AI Summary:', analysis);

      return analysis;

    } catch (error) {
      console.error('❌ Failed to process optimized data with AI:', error);
      return null;
    }
  }

  async saveIntervalSummary(
    sessionId,
    userId,
    analysis,
    trackingData,
    chunkNumber,
    promptUsed
  ) {
    try {
      console.log('💾 SUPABASE: Starting save process...');
      console.log('💾 SUPABASE: Session ID:', sessionId);
      console.log('💾 SUPABASE: User ID:', userId);
      console.log('💾 SUPABASE: Analysis keys:', Object.keys(analysis));
      
      if (!this.supabase) {
        console.error('❌ SUPABASE: Client not initialized');
        return false;
      }

      // Prepare the data to insert
      const dataToInsert = {
        session_id: sessionId,
        user_id: userId,
        summary_text: analysis.summaryText,
        summary_type: 'productivity_chunk',
        chunk_number: chunkNumber,
        productivity_score: analysis.productivityPct,
        task_completion: {
          completed: analysis.completedTodos || [],
          pending: analysis.pendingTodos || [],
          key_tasks: analysis.keyTasks || []
        },
        app_usage_summary: analysis.appUsage ? analysis.appUsage.reduce((acc, item) => {
          acc[item.app] = item.minutes;
          return acc;
        }, {}) : {},
        suggestions: [analysis.distractionPoints || 'No distractions detected'],
        ai_prompt_used: promptUsed,
        created_at: new Date().toISOString()
      };

      console.log('💾 SUPABASE: Data to insert:', JSON.stringify(dataToInsert, null, 2));

      const { data, error } = await this.supabase
        .from('ai_summaries')
        .insert(dataToInsert)
        .select(); // Add select to get back the inserted data

      if (error) {
        console.error('❌ SUPABASE: Insert failed with error:', error);
        console.error('❌ SUPABASE: Error details:', JSON.stringify(error, null, 2));
        return false;
      }

      console.log('✅ SUPABASE: AI summary saved successfully!');
      console.log('✅ SUPABASE: Inserted data:', data);
      return true;

    } catch (error) {
      console.error('❌ SUPABASE: Exception during save:', error);
      console.error('❌ SUPABASE: Error stack:', error.stack);
      return false;
    }
  }
}

// Export singleton instance
const aiSummaryService = new AISummaryService();
module.exports = { aiSummaryService };
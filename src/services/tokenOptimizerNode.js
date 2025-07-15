/**
 * Token Optimizer - Node.js Version
 * Reduces session data tokens by ~96% for AI analysis
 */

class TokenOptimizer {
    constructor(config = {}) {
      console.log('🔧 TokenOptimizer: Constructor called with config:', config);
      this.config = {
        coalesceTextInputs: true,
        coalesceDuplicateSnapshots: true,
        coalesceNetworkBursts: true,
        networkBurstWindow: 2000,
        maxTextCoalesceGap: 10000, // 10 seconds - more aggressive text grouping for fragments like "s" + "ales"
        
        // NEW: Ultra-aggressive filtering settings
        maxScrollEventsPerMinute: 3, // Only keep 3 scroll events per minute max
        minTimeBetweenSnapshots: 45000, // 45 seconds minimum between snapshots
        removeUselessEvents: true,
        onlySnapshotActiveApp: true, // Only snapshot the currently active app
        ...config
      };
      console.log('🔧 TokenOptimizer: Initialized with config:', this.config);
    }
  
    /**
     * Main optimization function - converts verbose session data to minimal tokens
     */
    optimizeSessionData(sessionData) {
      console.log('🔧 TokenOptimizer: Starting token optimization...');
      console.log('🔧 TokenOptimizer: Input sessionData:', typeof sessionData, sessionData ? Object.keys(sessionData) : 'null');
      const startTime = Date.now();
  
      const rawEvents = this.extractRawEvents(sessionData);
      console.log(`📊 Extracted ${rawEvents.length} raw events`);
  
      const optimizedEvents = this.convertToOptimizedFormat(rawEvents);
      console.log(`📊 Converted to ${optimizedEvents.length} optimized events`);
  
      const coalescedEvents = this.applyCoalescing(optimizedEvents);
      
      const endTime = Date.now();
      const tokenReduction = this.estimateTokenReduction(rawEvents.length, coalescedEvents.length);
      
      console.log(`✅ Token optimization complete in ${endTime - startTime}ms`);
      console.log(`📊 Final events: ${coalescedEvents.length} (${tokenReduction.reductionPercent}% reduction)`);
      console.log(`📊 Estimated tokens: ${tokenReduction.originalTokens} → ${tokenReduction.optimizedTokens}`);
  
      return coalescedEvents;
    }
  
    /**
     * Extract raw events from various possible data structures
     */
    extractRawEvents(sessionData) {
      let events = [];
  
      if (sessionData.v3Data?.rawEvents) {
        events = sessionData.v3Data.rawEvents;
      } else if (sessionData.events) {
        events = sessionData.events;
      } else if (sessionData.rawEvents) {
        events = sessionData.rawEvents;
      } else if (Array.isArray(sessionData)) {
        events = sessionData;
      } else if (sessionData.batches) {
        events = sessionData.batches.flatMap(batch => batch.events || []);
      } else if (sessionData.v3Data?.aiBatches) {
        events = sessionData.v3Data.aiBatches.flatMap(batch => batch.events || []);
      } else {
        console.warn('⚠️ Could not extract events from session data structure');
        return [];
      }
  
      return events;
    }
  
    /**
     * Convert verbose events to optimized format with only essential fields
     */
    convertToOptimizedFormat(rawEvents) {
      const optimized = [];
  
      for (const event of rawEvents) {
        const optimizedEvent = this.optimizeEvent(event);
        if (optimizedEvent) {
          optimized.push(optimizedEvent);
        }
      }
  
      return optimized;
    }
  
    /**
     * Optimize a single event according to the field whitelist
     */
    optimizeEvent(event) {
      const timestamp = this.extractTimestamp(event);
      const type = this.extractEventType(event);
  
      if (!timestamp || !type) {
        return null;
      }
  
      const optimized = { timestamp, type };
  
      // Add type-specific fields according to the whitelist
      switch (type) {
        case 'session_start':
        case 'session_end':
          break;
  
        case 'app_focus':
        case 'application_change':
          optimized.app_name = this.extractField(event, [
            'app_name', 
            'object_id', 
            'fullPayload.activeApp.name',
            'metadata.app_name'
          ]);
          break;
  
        case 'window_change':
        case 'window_focus':
          optimized.window_title = this.extractField(event, [
            'window_title', 
            'fullPayload.activeApp.windowTitle',
            'fullPayload.windowTitle',
            'metadata.window_title'
          ]);
          break;
  
        case 'text_input':
        case 'keystroke':
        case 'keydown':
        case 'keyup':
        case 'clipboard_copy':
        case 'clipboard_paste':
          optimized.text = this.extractField(event, [
            'text', 
            'content', 
            'fullPayload.content', 
            'fullPayload.text',
            'metadata.text',
            'metadata.content'
          ]);
          break;
  
        case 'element_click':
        case 'mouse_click':
        case 'click':
          optimized.element_role = this.extractField(event, [
            'element_role', 
            'fullPayload.element.role',
            'metadata.element_role'
          ]);
          optimized.element_label = this.extractField(event, [
            'element_label', 
            'fullPayload.element.label',
            'metadata.element_label'
          ]);
          optimized.element_title = this.extractField(event, [
            'element_title', 
            'fullPayload.element.title',
            'metadata.element_title'
          ]);
          break;
  
        case 'network':
        case 'network_request':
        case 'http_request':
          optimized.url = this.extractField(event, [
            'url', 
            'fullPayload.url',
            'metadata.url'
          ]);
          optimized.method = this.extractField(event, [
            'method', 
            'fullPayload.method',
            'metadata.method'
          ]);
          optimized.status = this.extractField(event, [
            'status', 
            'status_code', 
            'fullPayload.status', 
            'fullPayload.statusCode',
            'metadata.status_code'
          ]);
          optimized.resource_type = this.extractField(event, [
            'resource_type', 
            'fullPayload.resourceType',
            'metadata.resource_type'
          ]);
          break;
  
        case 'content_snapshot':
        case 'screenshot':
        case 'snapshot':
          optimized.snapshot_type = this.extractField(event, [
            'snapshot_type', 
            'fullPayload.snapshot.type'
          ]);
          optimized.content_preview = this.extractField(event, [
            'content_preview', 
            'fullPayload.snapshot.textContent',
            'metadata.content_preview'
          ]);
          optimized.window_title = this.extractField(event, [
            'window_title', 
            'fullPayload.snapshot.activeApp.windowTitle',
            'metadata.window_title'
          ]);
          optimized.url = this.extractField(event, [
            'url', 
            'fullPayload.snapshot.url'
          ]);
          break;
  
        case 'page_view':
        case 'navigation':
          optimized.url = this.extractField(event, [
            'url', 
            'fullPayload.url',
            'metadata.url'
          ]);
          break;
  
        case 'scroll_event':
        case 'scroll':
          // Scroll events don't need additional fields beyond timestamp and type
          break;
  
        case 'enhanced_element_click':
          // Enhanced clicks will be filtered out in aggressive mode, but just in case
          optimized.element_role = this.extractField(event, [
            'element_role', 
            'fullPayload.element.role',
            'metadata.element_role'
          ]);
          optimized.element_label = this.extractField(event, [
            'element_label', 
            'fullPayload.element.label',
            'metadata.element_label'
          ]);
          break;
  
        default:
          // Don't log unknown types - they might be intentionally filtered
          break;
      }
  
      return optimized;
    }
  
    /**
     * Extract timestamp from various possible locations
     */
    extractTimestamp(event) {
      return this.extractField(event, [
        'timestamp', 
        'rawTimestamp', 
        'fullPayload.timestamp',
        'metadata.timestamp'
      ]);
    }
  
    /**
     * Extract event type from various possible locations
     */
    extractEventType(event) {
      return this.extractField(event, [
        'type',
        'eventType',
        'event_type',
        'fullPayload.type'
      ]);
    }
  
    /**
     * Extract field value from multiple possible paths
     */
    extractField(obj, paths) {
      for (const path of paths) {
        const value = this.getNestedValue(obj, path);
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
      return undefined;
    }
  
    /**
     * Get nested object value using dot notation
     */
    getNestedValue(obj, path) {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    }
  
    /**
     * Apply coalescing rules to reduce redundant events
     */
    applyCoalescing(events) {
      console.log(`🔧 TokenOptimizer: Starting coalescing with ${events.length} events`);
      let coalesced = events;
  
      // AGGRESSIVE: Remove noise events FIRST (before coalescing interferes)
      if (this.config.removeUselessEvents) {
        coalesced = this.removeUselessEvents(coalesced);
        console.log(`🗑️ Removed useless events: ${events.length} → ${coalesced.length}`);
      }
  
      // Text coalescing
      if (this.config.coalesceTextInputs) {
        coalesced = this.coalesceTextInputs(coalesced);
        console.log(`📝 Text coalescing: ${coalesced.length} events after text merge`);
      }
  
      // Snapshot filtering
      if (this.config.coalesceDuplicateSnapshots) {
        coalesced = this.coalesceDuplicateSnapshots(coalesced);
        console.log(`📸 Snapshot filtering: ${coalesced.length} events after snapshot filter`);
      }
  
      // Network filtering
      if (this.config.coalesceNetworkBursts) {
        coalesced = this.coalesceNetworkBursts(coalesced);
      }
  
      console.log(`✅ TokenOptimizer: Final result ${events.length} → ${coalesced.length} events (${Math.round((1 - coalesced.length/events.length) * 100)}% reduction)`);
      return coalesced;
    }
  
    /**
     * IMPROVED: Merge text input events within time windows (ignoring interrupting events)
     */
    coalesceTextInputs(events) {
      const coalesced = [];
      const textEvents = [];
      const nonTextEvents = [];
  
      console.log(`🔧 TokenOptimizer: Starting improved text coalescing with ${events.length} events`);
  
      // 1. Separate text events from non-text events
      for (const event of events) {
        if (this.isTextInputEvent(event)) {
          textEvents.push(event);
        } else {
          nonTextEvents.push(event);
        }
      }
  
      console.log(`📝 Found ${textEvents.length} text events and ${nonTextEvents.length} other events`);
  
      // 2. Group text events within time windows
      const textGroups = [];
      let currentGroup = [];
      
      for (const textEvent of textEvents) {
        if (currentGroup.length === 0) {
          currentGroup.push(textEvent);
        } else {
          const lastEvent = currentGroup[currentGroup.length - 1];
          const timeDiff = new Date(textEvent.timestamp).getTime() - new Date(lastEvent.timestamp).getTime();
          
          if (timeDiff <= this.config.maxTextCoalesceGap) {
            currentGroup.push(textEvent);
            console.log(`📝 Added "${textEvent.text}" to group (${timeDiff}ms later)`);
          } else {
            // Time gap too large, start new group
            if (currentGroup.length > 0) {
              textGroups.push(currentGroup);
            }
            currentGroup = [textEvent];
            console.log(`📝 Started new text group with "${textEvent.text}" (gap: ${timeDiff}ms)`);
          }
        }
      }
      
      if (currentGroup.length > 0) {
        textGroups.push(currentGroup);
      }
  
      // 3. Merge each text group
      const mergedTextEvents = [];
      for (const group of textGroups) {
        if (group.length > 1) {
          const merged = this.mergeTextEvents(group);
          mergedTextEvents.push(merged);
          console.log(`✅ Merged ${group.length} text events into: "${merged.text}"`);
        } else {
          mergedTextEvents.push(group[0]);
        }
      }
  
      // 4. Merge all events back together in chronological order
      const allEvents = [...mergedTextEvents, ...nonTextEvents];
      allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
      console.log(`🔧 Improved text coalescing: ${textEvents.length} text events → ${mergedTextEvents.length} merged text events`);
      return allEvents;
    }
  
    /**
     * Check if event is a text input type
     */
    isTextInputEvent(event) {
      const textTypes = ['text_input', 'keystroke', 'keydown', 'keyup', 'clipboard_copy', 'clipboard_paste'];
      return textTypes.includes(event.type) && (event.text !== undefined && event.text !== null && event.text !== '');
    }
  
    /**
     * Check if event can be coalesced with previous text events
     */
    canCoalesceWithPrevious(event, group) {
      if (group.length === 0) return true;
  
      const lastEvent = group[group.length - 1];
      const timeDiff = new Date(event.timestamp).getTime() - new Date(lastEvent.timestamp).getTime();
  
      // More permissive time window for text coalescing
      return timeDiff <= this.config.maxTextCoalesceGap;
    }
  
    /**
     * Merge multiple text events into one with smart joining
     */
    mergeTextEvents(events) {
      const textParts = events
        .map(e => e.text)
        .filter(text => text);
      
      let combinedText;
      
           // Smart text joining logic
       if (textParts.length === 2) {
         const [first, second] = textParts;
         
         // If parts look like word fragments, join without space
         const combined = first + second;
         const looksLikeWordFragments = (
           // Case 1: first part 1-2 chars, second part completes word
           (first.length <= 2 && second.length <= 6) ||
           // Case 2: both parts are short and form a reasonable word
           (first.length <= 4 && second.length <= 2 && combined.length <= 8)
         ) && /^[a-zA-Z]+$/.test(combined);
         
         if (looksLikeWordFragments) {
           combinedText = combined; // Join without space: "s"+"ales"="sales", "mari"+"o"="mario"
         } else {
           combinedText = textParts.join(' '); // Normal joining with space
         }
       } else {
         // Multiple parts - join with spaces
         combinedText = textParts.join(' ');
       }
  
      console.log(`✅ Merged ${events.length} text events: [${textParts.map(t => `"${t}"`).join(', ')}] → "${combinedText}"`);
  
      return {
        timestamp: events[0].timestamp,
        type: 'text_input',
        text: combinedText.trim()
      };
    }
  
    /**
     * AGGRESSIVE: Remove duplicate snapshots with much longer time window
     */
    coalesceDuplicateSnapshots(events) {
      const coalesced = [];
      let lastSnapshot = null;
      let lastSnapshotTime = 0;
  
      console.log(`📸 Starting aggressive snapshot filtering with ${events.length} events`);
  
      for (const event of events) {
        if (this.isSnapshotEvent(event)) {
          const eventTime = new Date(event.timestamp).getTime();
          
          // Filter out useless snapshots
          if (this.isUselessSnapshot(event)) {
            console.log(`🗑️ Filtered useless snapshot: "${event.content_preview?.substring(0,30)}..."`);
            continue; // Skip this snapshot entirely
          }
          
          // MUCH MORE AGGRESSIVE: 45 seconds minimum between snapshots
          if (lastSnapshotTime && (eventTime - lastSnapshotTime) < 45000) {
            const timeDiff = Math.round((eventTime - lastSnapshotTime)/1000);
            console.log(`🗑️ Filtered snapshot too soon (${timeDiff}s ago, need 45s)`);
            continue; // Skip this snapshot
          }
          
          // Check for duplicate content
          if (!this.isDuplicateSnapshot(event, lastSnapshot)) {
            coalesced.push(event);
            lastSnapshot = event;
            lastSnapshotTime = eventTime;
            console.log(`✅ Kept snapshot: "${event.content_preview?.substring(0,50)}..."`);
          } else {
            console.log(`🗑️ Filtered duplicate snapshot content`);
          }
        } else {
          coalesced.push(event);
        }
      }
  
      const removedCount = events.filter(e => this.isSnapshotEvent(e)).length - coalesced.filter(e => this.isSnapshotEvent(e)).length;
      console.log(`📸 Snapshot filtering complete: removed ${removedCount} snapshots`);
  
      return coalesced;
    }
  
    /**
     * Check if event is a snapshot type
     */
    isSnapshotEvent(event) {
      return ['content_snapshot', 'screenshot', 'snapshot'].includes(event.type);
    }
  
    /**
     * Check if two snapshots are duplicates
     */
    isDuplicateSnapshot(event, lastSnapshot) {
      if (!lastSnapshot) return false;
  
      return event.content_preview === lastSnapshot.content_preview &&
             event.window_title === lastSnapshot.window_title;
    }
  
    /**
     * Check if a snapshot is useless and should be filtered out
     */
    isUselessSnapshot(event) {
      // No content preview or very short content
      if (!event.content_preview || event.content_preview.length < 10) {
        return true;
      }
      
      // Generic app titles with no useful content
      const uselessContent = [
        'LevelAI Desktop',
        'Desktop',
        'Finder',
        'Dock',
        'Menu Bar',
        'System Preferences',
        'Activity Monitor'
      ];
      
      if (uselessContent.some(useless => event.content_preview.includes(useless) && event.content_preview.length < 50)) {
        return true;
      }
      
      // Window titles that indicate no useful content
      const uselessWindows = [
        'LevelAI Desktop',
        'Desktop',
        'Dock',
        'Menu Bar'
      ];
      
      if (uselessWindows.includes(event.window_title)) {
        return true;
      }
      
      return false;
    }

    /**
     * Check if a snapshot is from the currently active app
     */
    isSnapshotFromActiveApp(snapshotEvent, filteredEvents) {
      const snapshotTime = new Date(snapshotEvent.timestamp).getTime();
      const snapshotApp = snapshotEvent.window_title || snapshotEvent.app_name;
      
      // Look for recent application_change events within 5 seconds
      const recentAppChanges = filteredEvents
        .filter(e => e.type === 'application_change' || e.type === 'window_change')
        .filter(e => {
          const eventTime = new Date(e.timestamp).getTime();
          return Math.abs(snapshotTime - eventTime) <= 5000; // Within 5 seconds
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Most recent first
      
      if (recentAppChanges.length === 0) {
        // No recent app changes, assume it's from active app
        return true;
      }
      
      // Check if snapshot matches the most recent app change
      const mostRecentAppChange = recentAppChanges[0];
      const activeApp = mostRecentAppChange.app_name || mostRecentAppChange.window_title;
      
      // Allow snapshot if it matches the active app or if no clear active app
      return !activeApp || snapshotApp === activeApp || snapshotApp.includes(activeApp) || activeApp.includes(snapshotApp);
    }
  
    /**
     * Group network requests within time windows
     */
    coalesceNetworkBursts(events) {
      const coalesced = [];
      let currentGroup = [];
  
      for (const event of events) {
        const isNetworkEvent = this.isNetworkEvent(event);
  
        if (isNetworkEvent && this.canCoalesceNetworkEvent(event, currentGroup)) {
          currentGroup.push(event);
        } else {
          if (currentGroup.length > 0) {
            coalesced.push(currentGroup[0]); // Keep first request in burst
            currentGroup = [];
          }
  
          if (isNetworkEvent) {
            currentGroup.push(event);
          } else {
            coalesced.push(event);
          }
        }
      }
  
      if (currentGroup.length > 0) {
        coalesced.push(currentGroup[0]);
      }
  
      return coalesced;
    }
  
    /**
     * Check if event is a network type
     */
    isNetworkEvent(event) {
      return ['network', 'network_request', 'http_request'].includes(event.type);
    }
  
    /**
     * Check if network event can be coalesced with previous ones
     */
    canCoalesceNetworkEvent(event, group) {
      if (group.length === 0) return true;
  
      const lastEvent = group[group.length - 1];
      const timeDiff = new Date(event.timestamp).getTime() - new Date(lastEvent.timestamp).getTime();
  
      return timeDiff <= this.config.networkBurstWindow;
    }
  
    /**
     * Estimate token reduction achieved
     */
    estimateTokenReduction(originalEventCount, optimizedEventCount) {
      const originalTokensPerEvent = 40;
      const optimizedTokensPerEvent = 15;
      const overhead = 50;
  
      const originalTokens = (originalEventCount * originalTokensPerEvent) + overhead;
      const optimizedTokens = (optimizedEventCount * optimizedTokensPerEvent) + overhead;
      
      const reductionPercent = Math.round(((originalTokens - optimizedTokens) / originalTokens) * 100);
  
      return {
        originalTokens,
        optimizedTokens,
        reductionPercent,
        originalEventCount,
        optimizedEventCount
      };
    }
  
    /**
     * Create a summary of the optimization results
     */
    createOptimizationSummary(originalData, optimizedEvents) {
      const originalEventCount = this.extractRawEvents(originalData).length;
      const reduction = this.estimateTokenReduction(originalEventCount, optimizedEvents.length);
  
      return {
        ...reduction,
        eventTypeBreakdown: this.getEventTypeBreakdown(optimizedEvents),
        optimizationConfig: this.config,
        timestamp: new Date().toISOString()
      };
    }
  
    /**
     * Filter out scroll event spam - keep only meaningful scroll patterns
     */
    filterScrollSpam(events) {
      const filtered = [];
      let lastScrollTime = 0;
      let scrollCount = 0;
      let scrollBurst = [];
  
      for (const event of events) {
        if (event.type === 'scroll_event') {
          const eventTime = new Date(event.timestamp).getTime();
          
          // Group scroll events within 5 seconds
          if (eventTime - lastScrollTime < 5000) {
            scrollBurst.push(event);
            scrollCount++;
          } else {
            // End of scroll burst - summarize it
            if (scrollBurst.length > 3) {
              // Replace burst with single scroll summary
              filtered.push({
                timestamp: scrollBurst[0].timestamp,
                type: 'scroll_session',
                scroll_duration: Math.round((new Date(scrollBurst[scrollBurst.length - 1].timestamp).getTime() - new Date(scrollBurst[0].timestamp).getTime()) / 1000),
                scroll_events: scrollBurst.length
              });
            } else {
              // Keep short scroll sequences
              filtered.push(...scrollBurst);
            }
            
            // Start new burst
            scrollBurst = [event];
            scrollCount = 1;
          }
          lastScrollTime = eventTime;
        } else {
          // Non-scroll event - flush any pending scroll burst
          if (scrollBurst.length > 3) {
            filtered.push({
              timestamp: scrollBurst[0].timestamp,
              type: 'scroll_session',
              scroll_duration: Math.round((new Date(scrollBurst[scrollBurst.length - 1].timestamp).getTime() - new Date(scrollBurst[0].timestamp).getTime()) / 1000),
              scroll_events: scrollBurst.length
            });
          } else if (scrollBurst.length > 0) {
            filtered.push(...scrollBurst);
          }
          scrollBurst = [];
          
          filtered.push(event);
        }
      }
  
      // Handle any remaining scroll burst
      if (scrollBurst.length > 3) {
        filtered.push({
          timestamp: scrollBurst[0].timestamp,
          type: 'scroll_session',
          scroll_duration: Math.round((new Date(scrollBurst[scrollBurst.length - 1].timestamp).getTime() - new Date(scrollBurst[0].timestamp).getTime()) / 1000),
          scroll_events: scrollBurst.length
        });
      } else if (scrollBurst.length > 0) {
        filtered.push(...scrollBurst);
      }
  
      return filtered;
    }
  
          /**
      * ULTRA-AGGRESSIVE: Remove all useless/empty events
      */
     removeUselessEvents(events) {
       const filtered = [];
       let lastEventByType = {};
       let scrollEventsInLastMinute = [];
       let lastSnapshotTime = 0;
  
       for (const event of events) {
         const eventTime = new Date(event.timestamp).getTime();
         
         // 1. ALWAYS KEEP: Essential navigation events
         if (['session_start', 'session_end', 'app_focus', 'window_change', 'page_view'].includes(event.type)) {
           filtered.push(event);
           continue;
         }
  
         // 2. TEXT INPUTS: Keep only if they have actual text content
         if (event.type === 'text_input') {
           if (event.text && event.text.trim().length > 0) {
             filtered.push(event);
           } else {
             console.log(`🗑️ Filtered empty text input`);
           }
           continue;
         }
  
         // 3. TEXT SELECTION: Usually empty, skip unless has content
         if (event.type === 'text_selection') {
           if (event.text && event.text.trim().length > 0) {
             filtered.push(event);
           } else {
             console.log(`🗑️ Filtered empty text selection`);
           }
           continue;
         }
  
         // 4. SCROLL SPAM: Limit to max 2 scroll events per minute
         if (event.type === 'scroll_event') {
           // Remove scroll events older than 1 minute
           scrollEventsInLastMinute = scrollEventsInLastMinute.filter(time => eventTime - time < 60000);
           
           if (scrollEventsInLastMinute.length < 2) { // Reduced from 3 to 2
             scrollEventsInLastMinute.push(eventTime);
             filtered.push(event);
           } else {
             console.log(`🗑️ Filtered excess scroll event (${scrollEventsInLastMinute.length} in last minute)`);
           }
           continue;
         }
  
         // 5. CONTENT SNAPSHOTS: Only keep if they have actual content AND are from active app
         if (event.type === 'content_snapshot') {
           // Check multiple possible content fields
           const contentPreview = event.content_preview || event.content || event.text || '';
           const windowTitle = event.window_title || '';
           const url = event.url || '';
           
           // Must have meaningful content AND respect time window
           const hasContent = contentPreview.trim().length > 10 || 
                             windowTitle.trim().length > 0 || 
                             url.trim().length > 0;
           const isNotTooSoon = eventTime - lastSnapshotTime >= this.config.minTimeBetweenSnapshots;
           
           // NEW: Only snapshot active app - check if this snapshot is from a recent app change
           const isFromActiveApp = this.isSnapshotFromActiveApp(event, filtered);
           
           if (hasContent && isNotTooSoon && !this.isUselessSnapshot(event) && isFromActiveApp) {
             filtered.push(event);
             lastSnapshotTime = eventTime;
             console.log(`✅ Kept active app snapshot: "${contentPreview.substring(0,30) || windowTitle.substring(0,30) || url.substring(0,30)}..."`);
           } else {
             const reason = !hasContent ? 'no content' : 
                           !isNotTooSoon ? 'too soon' : 
                           this.isUselessSnapshot(event) ? 'useless' : 
                           !isFromActiveApp ? 'background app' : 'unknown';
             console.log(`🗑️ Filtered snapshot (${reason}) - content: ${contentPreview.length}chars, time: ${isNotTooSoon}, active: ${isFromActiveApp}`);
           }
           continue;
         }
  
         // 6. REMOVE ALL ENHANCED DUPLICATES: enhanced_element_click is always redundant
         if (event.type === 'enhanced_element_click') {
           console.log(`🗑️ Filtered enhanced duplicate click`);
           continue;
         }
  
         // 7. ELEMENT CLICKS: Only keep if they have meaningful information
         if (event.type.includes('click')) {
           const hasLabel = event.element_label && event.element_label.trim().length > 0;
           const hasRole = event.element_role && event.element_role.trim().length > 0;
           
           if (hasLabel || hasRole) {
             // Also check for duplicate clicks at same timestamp
             const duplicateClick = filtered.find(e => 
               e.timestamp === event.timestamp && 
               e.type.includes('click') &&
               e.element_label === event.element_label
             );
             
             if (!duplicateClick) {
               filtered.push(event);
             } else {
               console.log(`🗑️ Filtered duplicate click at same timestamp`);
             }
           } else {
             console.log(`🗑️ Filtered empty click (no label/role)`);
           }
           continue;
         }
  
         // 8. APP/WINDOW CHANGES: Filter redundant consecutive changes
         if (event.type === 'application_change' || event.type === 'window_change') {
           const lastAppChange = filtered
             .slice(-3) // Look at last 3 events
             .find(e => e.type === event.type);
           
           if (lastAppChange && 
               (lastAppChange.app_name === event.app_name || lastAppChange.window_title === event.window_title)) {
             console.log(`🗑️ Filtered redundant ${event.type} (same app/window)`);
             continue;
           }
         }

         // 9. DUPLICATE EVENTS: Same event type within 2 seconds
         const lastSimilar = lastEventByType[event.type];
         if (lastSimilar && eventTime - lastSimilar < 2000) {
           console.log(`🗑️ Filtered duplicate ${event.type} (${Math.round((eventTime - lastSimilar)/1000)}s ago)`);
           continue;
         }
         lastEventByType[event.type] = eventTime;
  
         // 10. KEEP EVERYTHING ELSE THAT PASSED ALL FILTERS
         filtered.push(event);
       }
  
       return filtered;
     }
  
    /**
     * Get breakdown of event types in optimized data
     */
    getEventTypeBreakdown(events) {
      const breakdown = {};
      
      for (const event of events) {
        breakdown[event.type] = (breakdown[event.type] || 0) + 1;
      }
  
      return breakdown;
    }
  }
  
  module.exports = TokenOptimizer;  
/**
 * Comprehensive Functionality Test for AI Understanding
 * 
 * Tests all critical features needed for AI to understand user activity
 */

const UniversalTrackerV3 = require('../core/universal-tracker-v3');
const path = require('path');

async function runComprehensiveTest() {
  console.log('🔍 Comprehensive Functionality Test for AI Understanding');
  console.log('======================================================\n');
  
  const tracker = new UniversalTrackerV3({
    rawDataPath: './tracker/v3/output/raw/',
    batchDataPath: './tracker/v3/output/batches/',
    layers: {
      osHooks: { 
        captureClipboard: true,
        textInputTimeout: 2000
      },
      enhancedText: {
        pollingInterval: 500,
        textChangeThreshold: 2,
        sessionTimeout: 3000
      },
      snapshots: { 
        snapshotInterval: 10000, // Every 10 seconds
        enableScreenshots: false, // Keep simple for testing
        enableTextCapture: true,  // Essential for AI
        enableUIHierarchy: true
      },
      macosCapture: {
        captureClipboard: true,
        textInputTimeout: 2000
      }
      // macOS capture automatically enabled on macOS
    }
  });
  
  let testDuration = 45; // 45 seconds for comprehensive test
  
  try {
    console.log('🚀 Starting comprehensive tracker...\n');
    await tracker.start();
    
    console.log('📋 Test Activities for AI Understanding:');
    console.log('========================================');
    console.log('During the next 45 seconds, please:');
    console.log('1. 📝 Switch to a text editor and type a sentence');
    console.log('2. 🌐 Switch to a web browser and navigate');
    console.log('3. 📱 Switch to another app (Notes, ChatGPT, etc.)');
    console.log('4. 📋 Copy and paste some text');
    console.log('5. 🖱️ Click around in different applications\n');
    
    console.log('⏱️ Test will run for 45 seconds...\n');
    
    // Show real-time stats
    const statsInterval = setInterval(() => {
      const stats = tracker.getStats();
      const osHooksStats = stats.layers.osHooks || {};
      const enhancedTextStats = stats.layers.enhancedText || {};
      const macosStats = stats.layers.macosCapture || {};
      
      console.log(`📊 Real-time Stats:`, {
        'Raw Events': stats.components.rawDataCollector.totalEvents,
        'Batches': stats.components.batchProcessor.totalBatches,
        'Snapshots': stats.components.snapshotManager.totalSnapshots,
        'App Changes': osHooksStats.appChanges || 0,
        'Text Inputs': (enhancedTextStats.textInputs || 0) + (macosStats.textInputs || 0) + (osHooksStats.textInputs || 0),
        'Screen Captures': macosStats.screenCaptures || 0,
        'Clipboard': osHooksStats.clipboardEvents || 0,
        'Current App': osHooksStats.currentApp || 'Unknown'
      });
    }, 5000);
    
    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, testDuration * 1000));
    
    clearInterval(statsInterval);
    
    console.log('\n🛑 Stopping tracker and analyzing results...\n');
    await tracker.stop();
    
    // Analyze results
    await analyzeResults(tracker);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function analyzeResults(tracker) {
  console.log('📊 COMPREHENSIVE ANALYSIS FOR AI UNDERSTANDING');
  console.log('===============================================\n');
  
  const finalStats = tracker.getStats();
  const osHooksStats = finalStats.layers.osHooks || {};
  const enhancedTextStats = finalStats.layers.enhancedText || {};
  const macosStats = finalStats.layers.macosCapture || {};
  const snapshotStats = finalStats.components.snapshotManager || {};
  
  // Overall session stats
  console.log('📈 Session Overview:');
  console.log('===================');
  console.log(`Session ID: ${finalStats.session.sessionId}`);
  console.log(`Duration: ${Math.round(finalStats.session.duration / 1000)}s`);
  console.log(`Total Raw Events: ${finalStats.components.rawDataCollector.totalEvents}`);
  console.log(`AI Batches Created: ${finalStats.components.batchProcessor.totalBatches}`);
  console.log('');
  
  // App switching analysis
  console.log('🔄 App Switching (Context Changes):');
  console.log('===================================');
  console.log(`App changes detected: ${osHooksStats.appChanges || 0}`);
  console.log(`Current app: ${osHooksStats.currentApp || 'Unknown'}`);
  console.log(`Current window: ${osHooksStats.currentWindow || 'Unknown'}`);
  if (osHooksStats.appChanges > 0) {
    console.log('✅ AI can track context switches between applications');
  } else {
    console.log('⚠️ No app switches detected - try switching between apps');
  }
  console.log('');
  
  // Text input analysis
  console.log('📝 Text Input Tracking:');
  console.log('=======================');
  const totalTextInputs = (enhancedTextStats.textInputs || 0) + (macosStats.textInputs || 0) + (osHooksStats.textInputs || 0);
  const totalSentences = (enhancedTextStats.sentences || 0) + (osHooksStats.sentences || 0);
  const keystrokesDetected = (enhancedTextStats.charactersTracked || 0) + (osHooksStats.keystrokes || 0);
  
  console.log(`Text input sessions: ${totalTextInputs}`);
  console.log(`Sentences detected: ${totalSentences}`);
  console.log(`Characters tracked: ${keystrokesDetected}`);
  console.log(`macOS text captures: ${macosStats.textInputs || 0}`);
  
  if (totalTextInputs > 0 || macosStats.textInputs > 0) {
    console.log('✅ AI can see what you\'re typing');
  } else if (keystrokesDetected > 0) {
    console.log('🔶 Keystrokes detected but no complete text inputs');
  } else {
    console.log('⚠️ No text input detected - try typing in a text editor');
  }
  console.log('');
  
  // Screen content analysis
  console.log('📸 Screen Content Capture:');
  console.log('==========================');
  console.log(`Content snapshots taken: ${snapshotStats.totalSnapshots || 0}`);
  console.log(`Text content captured: ${snapshotStats.textCaptured || 0}`);
  console.log(`macOS screen captures: ${macosStats.screenCaptures || 0}`);
  console.log(`Screenshots taken: ${snapshotStats.screenshotsTaken || 0}`);
  
  const hasScreenContent = (snapshotStats.textCaptured || 0) + (macosStats.screenCaptures || 0) > 0;
  
  if (hasScreenContent) {
    console.log('✅ AI can see screen content and context');
  } else if (snapshotStats.totalSnapshots > 0) {
    console.log('🔶 Snapshots taken but no text content captured');
  } else {
    console.log('⚠️ No screen content captured');
  }
  console.log('');
  
  // Clipboard analysis
  console.log('📋 Clipboard & Content Sharing:');
  console.log('===============================');
  console.log(`Clipboard events: ${osHooksStats.clipboardEvents || 0}`);
  if (osHooksStats.clipboardEvents > 0) {
    console.log('✅ AI can track copy/paste activities');
  } else {
    console.log('⚠️ No clipboard activity detected - try copying some text');
  }
  console.log('');
  
  // AI Readiness Assessment
  console.log('🤖 AI UNDERSTANDING READINESS:');
  console.log('==============================');
  
  const checks = [
    { name: 'App Context Switching', passed: osHooksStats.appChanges > 0 },
    { name: 'Text Input Capture', passed: totalTextInputs > 0 || macosStats.textInputs > 0 || keystrokesDetected > 0 },
    { name: 'Screen Content Capture', passed: hasScreenContent },
    { name: 'Data Processing (Batches)', passed: finalStats.components.batchProcessor.totalBatches > 0 },
    { name: 'Content Snapshots', passed: snapshotStats.totalSnapshots > 0 }
  ];
  
  let passedChecks = 0;
  checks.forEach(check => {
    const status = check.passed ? '✅' : '❌';
    console.log(`${status} ${check.name}`);
    if (check.passed) passedChecks++;
  });
  
  const score = Math.round((passedChecks / checks.length) * 100);
  console.log(`\n🎯 AI Understanding Score: ${score}%`);
  
  if (score >= 80) {
    console.log('🎉 EXCELLENT: AI has comprehensive understanding of your activities!');
  } else if (score >= 60) {
    console.log('👍 GOOD: AI has good understanding, some features need attention');
  } else {
    console.log('⚠️ NEEDS IMPROVEMENT: Several features need to be fixed for optimal AI understanding');
  }
  
  console.log('\n📁 Data Locations:');
  console.log('==================');
  console.log(`Raw data: ${path.resolve('./tracker/v3/output/raw/')}`);
  console.log(`AI batches: ${path.resolve('./tracker/v3/output/batches/')}`);
  
  // Show file analysis
  await showFileAnalysis();
}

async function showFileAnalysis() {
  console.log('\n📄 Latest Captured Data:');
  console.log('========================');
  
  try {
    const fs = require('fs').promises;
    
    // Show latest raw file
    const rawFiles = await fs.readdir('./tracker/v3/output/raw/');
    const latestRaw = rawFiles.filter(f => f.endsWith('.jsonl')).pop();
    
    if (latestRaw) {
      const rawContent = await fs.readFile(`./tracker/v3/output/raw/${latestRaw}`, 'utf8');
      const lines = rawContent.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
      
      console.log(`📄 Raw events in ${latestRaw}: ${lines.length} events`);
      
      // Count event types
      const eventTypes = {};
      lines.forEach(line => {
        try {
          const event = JSON.parse(line);
          eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;
        } catch (e) {}
      });
      
      console.log('Event types captured:', Object.keys(eventTypes).join(', '));
      
      // Show sample events
      if (lines.length > 0) {
        console.log('\nSample Events:');
        lines.slice(0, 3).forEach((line, i) => {
          try {
            const event = JSON.parse(line);
            console.log(`${i + 1}. ${event.layer}:${event.eventType} at ${new Date(event.rawTimestamp).toLocaleTimeString()}`);
          } catch (e) {}
        });
      }
    }
    
    // Show latest batch file
    const batchFiles = await fs.readdir('./tracker/v3/output/batches/');
    const latestBatch = batchFiles.filter(f => f.endsWith('.json')).pop();
    
    if (latestBatch) {
      const batchContent = await fs.readFile(`./tracker/v3/output/batches/${latestBatch}`, 'utf8');
      const batch = JSON.parse(batchContent);
      
      console.log(`\n📦 AI batch ${latestBatch}:`);
      console.log(`- ${batch.events?.length || 0} AI-ready events`);
      console.log(`- Created: ${new Date(batch.batchMetadata.createdAt).toLocaleTimeString()}`);
      console.log(`- Reason: ${batch.batchMetadata.sendReason}`);
    }
    
  } catch (error) {
    console.log('Could not analyze files:', error.message);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Test interrupted by user');
  process.exit(0);
});

// Run the test
runComprehensiveTest().catch(console.error);
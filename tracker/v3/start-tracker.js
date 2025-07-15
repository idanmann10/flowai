#!/usr/bin/env node

/**
 * Universal Activity Tracker v3 - Start Script
 * 
 * Simple script to start tracking with custom duration
 */

const UniversalTrackerV3 = require('./core/universal-tracker-v3');
const path = require('path');

async function startTracking() {
  console.log('🚀 Universal Activity Tracker v3');
  console.log('==================================\n');
  
  const duration = parseInt(process.argv[2]) || 60;
  console.log(`⏱️ Will track for ${duration} seconds`);
  console.log('💡 Activities being captured:');
  console.log('  • App focus changes');
  console.log('  • Clipboard events'); 
  console.log('  • Periodic content snapshots');
  console.log('  • All data processed into AI-ready batches\n');
  
  const tracker = new UniversalTrackerV3({
    rawDataPath: './tracker/v3/output/raw/',
    batchDataPath: './tracker/v3/output/batches/',
    layers: {
      osHooks: { 
        captureClipboard: true,
        textInputTimeout: 2000
      },
      snapshots: { 
        snapshotInterval: 10000, 
        enableScreenshots: false 
      }
    }
  });
  
  let statsInterval;
  
  try {
    await tracker.start();
    console.log('✅ Tracker started successfully!\n');
    
    statsInterval = setInterval(() => {
      const stats = tracker.getStats();
      console.log(`📊 Events: ${stats.components.rawDataCollector.totalEvents} | ` +
                  `Batches: ${stats.components.batchProcessor.totalBatches} | ` +
                  `Snapshots: ${stats.components.snapshotManager.totalSnapshots}`);
    }, 5000);
    
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (statsInterval) clearInterval(statsInterval);
    
    console.log('\n🛑 Stopping tracker...');
    await tracker.stop();
    
    const finalStats = tracker.getStats();
    console.log('\n📊 Final Results:');
    console.log('==================');
    console.log(`Session ID: ${finalStats.session.sessionId}`);
    console.log(`Raw events: ${finalStats.components.rawDataCollector.totalEvents}`);
    console.log(`Batches: ${finalStats.components.batchProcessor.totalBatches}`);
    console.log(`Snapshots: ${finalStats.components.snapshotManager.totalSnapshots}`);
    
    console.log('\n📁 Output Locations:');
    console.log('====================');
    console.log(`Raw data: ${path.resolve('./tracker/v3/output/raw/')}`);
    console.log(`AI batches: ${path.resolve('./tracker/v3/output/batches/')}`);
    
    console.log('\n✅ Tracking complete!');
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n⚠️ Received interrupt signal, stopping...');
  process.exit(0);
});

startTracking().catch(console.error); 
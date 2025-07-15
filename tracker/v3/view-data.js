#!/usr/bin/env node

/**
 * Universal Activity Tracker v3 - Data Viewer
 * 
 * View captured raw data and AI batches
 */

const fs = require('fs').promises;
const path = require('path');

async function viewData() {
  console.log('📄 Universal Activity Tracker v3 - Data Viewer');
  console.log('================================================\n');
  
  const rawDir = './tracker/v3/output/raw/';
  const batchDir = './tracker/v3/output/batches/';
  
  try {
    // List raw data files
    console.log('📊 Raw Data Files:');
    console.log('==================');
    
    try {
      const rawFiles = await fs.readdir(rawDir);
      const jsonlFiles = rawFiles.filter(f => f.endsWith('.jsonl'));
      
      if (jsonlFiles.length === 0) {
        console.log('No raw data files found. Run the tracker first!\n');
      } else {
        for (const file of jsonlFiles.slice(-3)) { // Show last 3 files
          console.log(`📄 ${file}`);
          await showRawFilePreview(path.join(rawDir, file));
        }
      }
    } catch (error) {
      console.log('No raw data directory found\n');
    }
    
    // List batch files
    console.log('\n📦 AI Batch Files:');
    console.log('==================');
    
    try {
      const batchFiles = await fs.readdir(batchDir);
      const jsonFiles = batchFiles.filter(f => f.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        console.log('No batch files found\n');
      } else {
        for (const file of jsonFiles.slice(-2)) { // Show last 2 files
          console.log(`📦 ${file}`);
          await showBatchFilePreview(path.join(batchDir, file));
        }
      }
    } catch (error) {
      console.log('No batch data directory found\n');
    }
    
    // Show usage instructions
    console.log('\n💡 Usage Instructions:');
    console.log('======================');
    console.log('To start tracking: node tracker/v3/start-tracker.js [seconds]');
    console.log('To view this data:  node tracker/v3/view-data.js');
    console.log('\nExamples:');
    console.log('  node tracker/v3/start-tracker.js     # Track for 60 seconds');
    console.log('  node tracker/v3/start-tracker.js 30  # Track for 30 seconds');
    
  } catch (error) {
    console.error('❌ Error viewing data:', error);
  }
}

async function showRawFilePreview(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    console.log(`   📈 ${lines.length} events captured`);
    
    if (lines.length > 0) {
      // Show first event
      try {
        const firstEvent = JSON.parse(lines[0]);
        console.log(`   🎯 Session: ${firstEvent.sessionId}`);
        console.log(`   ⏰ Started: ${new Date(firstEvent.rawTimestamp).toLocaleTimeString()}`);
        
        // Count event types
        const eventTypes = {};
        lines.slice(0, 10).forEach(line => {
          try {
            const event = JSON.parse(line);
            eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;
          } catch (e) {}
        });
        
        console.log(`   📊 Event types: ${Object.keys(eventTypes).join(', ')}`);
      } catch (e) {
        console.log('   ⚠️ Error parsing events');
      }
    }
    
    console.log('');
  } catch (error) {
    console.log(`   ❌ Error reading file: ${error.message}\n`);
  }
}

async function showBatchFilePreview(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const batch = JSON.parse(content);
    
    console.log(`   📦 Batch ID: ${batch.batchMetadata.batchId}`);
    console.log(`   📊 ${batch.aiEvents.length} AI events from ${batch.rawEventReferences.length} raw events`);
    console.log(`   ⏰ Created: ${new Date(batch.batchMetadata.createdAt).toLocaleTimeString()}`);
    console.log(`   🔄 Reason: ${batch.batchMetadata.sendReason}`);
    
    if (batch.aiEvents.length > 0) {
      const eventTypes = batch.aiEvents.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {});
      
      console.log(`   🎯 AI event types: ${Object.keys(eventTypes).join(', ')}`);
    }
    
    console.log('');
  } catch (error) {
    console.log(`   ❌ Error reading batch: ${error.message}\n`);
  }
}

viewData().catch(console.error); 
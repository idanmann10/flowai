/**
 * Universal Activity Tracker v3 - Component Tests
 */

const RawDataCollector = require('../core/raw-data-collector');
const BatchProcessor = require('../core/batch-processor');
const OSHooksLayer = require('../layers/os-hooks');
const UniversalTrackerV3 = require('../core/universal-tracker-v3');

class ComponentTests {
  constructor() {
    this.testResults = [];
    this.sessionId = `test_session_${Date.now()}`;
    console.log('🧪 Component Tests v3 initialized');
  }

  async runAllTests() {
    console.log('\n=== Universal Activity Tracker v3 Component Tests ===\n');
    
    try {
      await this.testRawDataCollector();
      await this.testBatchProcessor();
      await this.testOSHooksLayer();
      await this.testUniversalTracker();
      
      this.printTestSummary();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  async testRawDataCollector() {
    console.log('📊 Testing Raw Data Collector...');
    
    try {
      const collector = new RawDataCollector({
        rawDataPath: './tracker/v3/output/raw/',
        bufferSize: 10,
        flushInterval: 1000
      });

      // Test initialization
      this.assert(collector.stats.eventsCollected === 0, 'Initial stats should be zero');
      
      // Test start
      await collector.start(this.sessionId);
      this.assert(collector.isActive === true, 'Should be active after start');
      
      // Test event recording
      collector.recordRawEvent('test_layer', 'test_event', { data: 'test' });
      this.assert(collector.stats.eventsCollected === 1, 'Should record event');
      
      // Test multiple events
      for (let i = 0; i < 5; i++) {
        collector.recordRawEvent('test_layer', 'test_event', { iteration: i });
      }
      this.assert(collector.stats.eventsCollected === 6, 'Should record multiple events');
      
      // Test stop
      await collector.stop();
      this.assert(collector.isActive === false, 'Should be inactive after stop');
      
      console.log('✅ Raw Data Collector tests passed');
      this.testResults.push({ component: 'RawDataCollector', status: 'PASS' });
      
    } catch (error) {
      console.error('❌ Raw Data Collector tests failed:', error);
      this.testResults.push({ component: 'RawDataCollector', status: 'FAIL', error: error.message });
    }
  }

  async testBatchProcessor() {
    console.log('📦 Testing Batch Processor...');
    
    try {
      const rawCollector = new RawDataCollector({
        rawDataPath: './tracker/v3/output/raw/',
        bufferSize: 100
      });
      
      const processor = new BatchProcessor({
        batchDataPath: './tracker/v3/output/batches/',
        batchInterval: 5000,
        maxBatchEvents: 10
      });

      // Start collector first
      await rawCollector.start(this.sessionId);
      
      // Test start
      await processor.start(this.sessionId, rawCollector);
      this.assert(processor.isActive === true, 'Should be active after start');
      
      // Simulate some raw events
      rawCollector.recordRawEvent('os_hooks', 'keydown', { 
        key: 'h', 
        timestamp: new Date().toISOString(),
        activeApp: 'TestApp'
      });
      
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test stop
      await processor.stop();
      await rawCollector.stop();
      
      console.log('✅ Batch Processor tests passed');
      this.testResults.push({ component: 'BatchProcessor', status: 'PASS' });
      
    } catch (error) {
      console.error('❌ Batch Processor tests failed:', error);
      this.testResults.push({ component: 'BatchProcessor', status: 'FAIL', error: error.message });
    }
  }

  async testOSHooksLayer() {
    console.log('⌨️ Testing OS Hooks Layer...');
    
    try {
      const rawCollector = new RawDataCollector();
      await rawCollector.start(this.sessionId);
      
      const osHooks = new OSHooksLayer(rawCollector, {
        captureAllKeystrokes: true,
        textInputTimeout: 1000
      });

      // Test text input processing (simulate typing)
      osHooks.processTextInput('h', Date.now());
      osHooks.processTextInput('e', Date.now());
      osHooks.processTextInput('l', Date.now());
      osHooks.processTextInput('l', Date.now());
      osHooks.processTextInput('o', Date.now());
      osHooks.processTextInput(' ', Date.now());
      osHooks.processTextInput('w', Date.now());
      osHooks.processTextInput('o', Date.now());
      osHooks.processTextInput('r', Date.now());
      osHooks.processTextInput('l', Date.now());
      osHooks.processTextInput('d', Date.now());
      
      this.assert(osHooks.textInputState.isBuilding === true, 'Should be building text');
      this.assert(osHooks.textInputState.currentBuffer === 'hello world', 'Should build correct text');
      
      // Test sentence detection
      this.assert(osHooks.isSentence('hello world') === true, 'Should detect as sentence');
      this.assert(osHooks.isSentence('hi') === false, 'Should not detect short text as sentence');
      
      // Test finishing text input
      osHooks.finishTextInput('test');
      this.assert(osHooks.textInputState.isBuilding === false, 'Should finish text input');
      this.assert(osHooks.stats.textInputs === 1, 'Should count text input');
      
      await rawCollector.stop();
      
      console.log('✅ OS Hooks Layer tests passed');
      this.testResults.push({ component: 'OSHooksLayer', status: 'PASS' });
      
    } catch (error) {
      console.error('❌ OS Hooks Layer tests failed:', error);
      this.testResults.push({ component: 'OSHooksLayer', status: 'FAIL', error: error.message });
    }
  }

  async testUniversalTracker() {
    console.log('🚀 Testing Universal Tracker v3...');
    
    try {
      const tracker = new UniversalTrackerV3({
        rawDataPath: './tracker/v3/output/raw/',
        batchDataPath: './tracker/v3/output/batches/',
        layers: {
          osHooks: { captureAllKeystrokes: true, textInputTimeout: 1000 },
          network: { captureRequestBodies: false },
          snapshots: { snapshotInterval: 5000, enableScreenshots: false }
        }
      });

      // Test initialization
      this.assert(tracker.sessionId !== null, 'Should have session ID');
      
      console.log('✅ Universal Tracker v3 tests passed');
      this.testResults.push({ component: 'UniversalTracker', status: 'PASS' });
      
    } catch (error) {
      console.error('❌ Universal Tracker v3 tests failed:', error);
      this.testResults.push({ component: 'UniversalTracker', status: 'FAIL', error: error.message });
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  printTestSummary() {
    console.log('\n=== Test Summary ===');
    
    let passed = 0;
    let failed = 0;
    
    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${result.component}: ${result.status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.status === 'PASS') passed++;
      else failed++;
    });
    
    console.log(`\nTotal: ${passed + failed} tests`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed!');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tests = new ComponentTests();
  tests.runAllTests().catch(console.error);
}

module.exports = ComponentTests; 
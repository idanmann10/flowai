/**
 * Universal Activity Tracker v3 - Event Schema
 * 
 * Defines all raw event types and standardized AI-ready event formats.
 * Maintains both raw unfiltered data and processed events.
 */

/**
 * Raw Event Layers - Direct capture from each tracking layer
 */
const RAW_EVENT_LAYERS = {
  OS_HOOKS: 'os_hooks',
  NETWORK: 'network',
  DOM: 'dom',
  ACCESSIBILITY: 'accessibility',
  CONTENT: 'content',
  SNAPSHOTS: 'snapshots'
};

/**
 * Raw Event Types - Unfiltered events from each layer
 */
const RAW_EVENT_TYPES = {
  // OS Hooks Layer
  KEYDOWN: 'keydown',
  KEYUP: 'keyup',
  MOUSEDOWN: 'mousedown',
  MOUSEUP: 'mouseup',
  MOUSEMOVE: 'mousemove',
  MOUSEWHEEL: 'mousewheel',
  CLIPBOARD_COPY: 'clipboard_copy',
  CLIPBOARD_PASTE: 'clipboard_paste',
  APP_FOCUS: 'app_focus',
  WINDOW_CHANGE: 'window_change',
  
  // Network Layer
  HTTP_REQUEST: 'http_request',
  HTTP_RESPONSE: 'http_response',
  WEBSOCKET_SEND: 'websocket_send',
  WEBSOCKET_RECEIVE: 'websocket_receive',
  WEBSOCKET_CONNECT: 'websocket_connect',
  WEBSOCKET_DISCONNECT: 'websocket_disconnect',
  
  // DOM Layer
  DOM_CLICK: 'dom_click',
  DOM_INPUT: 'dom_input',
  DOM_SUBMIT: 'dom_submit',
  DOM_FOCUS: 'dom_focus',
  DOM_BLUR: 'dom_blur',
  DOM_NAVIGATION: 'dom_navigation',
  DOM_CONTENT_CHANGE: 'dom_content_change',
  
  // Accessibility Layer
  AX_ELEMENT_FOCUS: 'ax_element_focus',
  AX_TREE_CHANGE: 'ax_tree_change',
  AX_VALUE_CHANGE: 'ax_value_change',
  AX_UI_HIERARCHY: 'ax_ui_hierarchy',
  
  // Content Layer
  FORM_FIELD_CHANGE: 'form_field_change',
  EDITOR_CONTENT_CHANGE: 'editor_content_change',
  TEXT_SELECTION: 'text_selection',
  FULL_FORM_CAPTURE: 'full_form_capture',
  
  // Snapshots Layer
  SCREEN_SNAPSHOT: 'screen_snapshot',
  UI_HIERARCHY_SNAPSHOT: 'ui_hierarchy_snapshot',
  CONTENT_SNAPSHOT: 'content_snapshot'
};

/**
 * AI-Ready Event Types - Processed and standardized events
 */
const AI_EVENT_TYPES = {
  // Navigation events
  screen_change: 'screen_change',
  app_focus_change: 'app_focus_change',
  
  // User input events
  element_click: 'element_click',
  form_submit: 'form_submit',
  text_input: 'text_input',
  typed_content: 'typed_content',
  shortcut_action: 'shortcut_action',
  
  // Data events
  api_call: 'api_call',
  data_load: 'data_load',
  
  // File and clipboard events
  file_open: 'file_open',
  file_save: 'file_save',
  clipboard_copy: 'clipboard_copy',
  clipboard_paste: 'clipboard_paste',
  
  // System events
  notification_received: 'notification_received',
  
  // Session events
  task_start: 'task_start',
  task_end: 'task_end',
  
  // Content snapshots
  content_snapshot: 'content_snapshot'
};

/**
 * Raw Event Schema - Structure for unfiltered events
 */
const RAW_EVENT_SCHEMA = {
  rawTimestamp: 'string',      // High-precision timestamp
  layer: 'string',             // Which tracking layer generated this
  eventType: 'string',         // Raw event type from that layer
  fullPayload: 'object',       // Complete unfiltered data
  sessionId: 'string',         // Session identifier
  sequenceId: 'number'         // Sequential event ID within session
};

/**
 * AI Event Schema - Structure for processed events
 */
const AI_EVENT_SCHEMA = {
  type: 'string',              // Standardized snake_case event type
  timestamp: 'string',         // ISO 8601 timestamp
  object_type: 'string',       // What was acted upon
  object_id: 'string',         // Unique identifier
  metadata: 'object',          // Event-specific details
  context: 'object',           // Session and environment context
  source_events: 'array'       // References to raw events that created this
};

/**
 * Content Snapshot Schema
 */
const CONTENT_SNAPSHOT_SCHEMA = {
  timestamp: 'string',
  snapshotId: 'string',
  textPreview: 'string',       // First 2000 chars of visible text
  fullText: 'string',          // Complete text content if available
  uiHierarchy: 'object',       // UI element tree
  screenshot: 'object',        // Screen capture metadata
  activeElements: 'array',     // Currently focused/active elements
  formFields: 'object'         // All form field values
};

/**
 * Batch Schema - Structure for AI-ready batches
 */
const BATCH_SCHEMA = {
  batchMetadata: {
    sessionId: 'string',
    batchId: 'string',
    start: 'string',
    end: 'string',
    totalEvents: 'number',
    totalRawEvents: 'number',
    sendReason: 'string',
    version: 'string'
  },
  events: 'array',             // Processed AI-ready events
  contentSnapshot: 'object',   // Periodic snapshot
  rawEventReferences: 'array'  // References to raw events used
};

/**
 * Object Types for AI inference
 */
const OBJECT_TYPES = {
  // CRM objects
  CONTACT: 'Contact',
  COMPANY: 'Company',
  DEAL: 'Deal',
  LEAD: 'Lead',
  OPPORTUNITY: 'Opportunity',
  
  // Development objects
  REPOSITORY: 'Repository',
  PULL_REQUEST: 'PullRequest',
  ISSUE: 'Issue',
  COMMIT: 'Commit',
  BRANCH: 'Branch',
  
  // Communication objects
  EMAIL: 'Email',
  MESSAGE: 'Message',
  CHANNEL: 'Channel',
  THREAD: 'Thread',
  CONVERSATION: 'Conversation',
  
  // Document objects
  DOCUMENT: 'Document',
  SPREADSHEET: 'Spreadsheet',
  PRESENTATION: 'Presentation',
  PDF: 'PDF',
  NOTE: 'Note',
  
  // Web objects
  WEBPAGE: 'Webpage',
  FORM: 'Form',
  BUTTON: 'Button',
  LINK: 'Link',
  FIELD: 'Field',
  
  // System objects
  APPLICATION: 'Application',
  WINDOW: 'Window',
  FILE: 'File',
  FOLDER: 'Folder',
  
  // Session objects
  SESSION: 'Session',
  TASK: 'Task',
  WORKFLOW: 'Workflow',
  SNAPSHOT: 'Snapshot'
};

/**
 * Network Request/Response Schema for complete capture
 */
const NETWORK_SCHEMA = {
  REQUEST: {
    method: 'string',
    url: 'string',
    headers: 'object',
    body: 'string',
    timestamp: 'string',
    requestId: 'string'
  },
  RESPONSE: {
    status: 'number',
    headers: 'object',
    body: 'string',
    timestamp: 'string',
    requestId: 'string',
    duration: 'number'
  },
  WEBSOCKET_FRAME: {
    direction: 'string',      // 'send' or 'receive'
    data: 'string',
    timestamp: 'string',
    connectionId: 'string',
    frameType: 'string'
  }
};

/**
 * Accessibility UI Element Schema
 */
const ACCESSIBILITY_ELEMENT_SCHEMA = {
  role: 'string',
  name: 'string',
  value: 'string',
  description: 'string',
  bounds: 'object',
  children: 'array',
  properties: 'object',
  actions: 'array'
};

/**
 * Form Field Schema for complete capture
 */
const FORM_FIELD_SCHEMA = {
  fieldType: 'string',         // text, email, password, textarea, select, etc.
  name: 'string',
  id: 'string',
  label: 'string',
  value: 'string',
  placeholder: 'string',
  required: 'boolean',
  validation: 'object',
  bounds: 'object'
};

/**
 * Create a raw event with standardized structure
 */
function createRawEvent(layer, eventType, payload, sessionId, sequenceId) {
  return {
    rawTimestamp: new Date().toISOString(),
    layer,
    eventType,
    fullPayload: payload,
    sessionId,
    sequenceId
  };
}

/**
 * Create an AI-ready event with standardized structure
 */
function createAIEvent(type, objectType, objectId, metadata = {}, context = {}, sourceEvents = []) {
  return {
    type,
    timestamp: new Date().toISOString(),
    object_type: objectType,
    object_id: objectId,
    metadata,
    context,
    source_events: sourceEvents
  };
}

/**
 * Create a content snapshot
 */
function createContentSnapshot(textPreview, uiHierarchy, additionalData = {}) {
  return {
    timestamp: new Date().toISOString(),
    snapshotId: `snapshot_${Date.now()}`,
    textPreview: textPreview.substring(0, 2000),
    fullText: textPreview,
    uiHierarchy,
    ...additionalData
  };
}

/**
 * Create a batch with metadata
 */
function createBatch(sessionId, events, contentSnapshot, rawEventReferences, sendReason) {
  const now = new Date().toISOString();
  
  return {
    batchMetadata: {
      sessionId,
      batchId: `batch_${Date.now()}`,
      start: events.length > 0 ? events[0].timestamp : now,
      end: now,
      totalEvents: events.length,
      totalRawEvents: rawEventReferences.length,
      sendReason,
      version: '3.0.0'
    },
    events,
    contentSnapshot,
    rawEventReferences
  };
}

module.exports = {
  RAW_EVENT_LAYERS,
  RAW_EVENT_TYPES,
  AI_EVENT_TYPES,
  RAW_EVENT_SCHEMA,
  AI_EVENT_SCHEMA,
  CONTENT_SNAPSHOT_SCHEMA,
  BATCH_SCHEMA,
  OBJECT_TYPES,
  NETWORK_SCHEMA,
  ACCESSIBILITY_ELEMENT_SCHEMA,
  FORM_FIELD_SCHEMA,
  createRawEvent,
  createAIEvent,
  createContentSnapshot,
  createBatch
}; 
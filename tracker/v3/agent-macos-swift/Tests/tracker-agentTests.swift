import XCTest
import Foundation

class TrackerAgentTests: XCTestCase {
    
    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.
    }

    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }

    func testAnyCodableEncoding() throws {
        // Test encoding different types
        let stringValue = AnyCodable("test string")
        let intValue = AnyCodable(42)
        let boolValue = AnyCodable(true)
        
        let encoder = JSONEncoder()
        
        // Test string encoding
        let stringData = try encoder.encode(stringValue)
        let stringJSON = String(data: stringData, encoding: .utf8)
        XCTAssertEqual(stringJSON, "\"test string\"")
        
        // Test int encoding
        let intData = try encoder.encode(intValue)
        let intJSON = String(data: intData, encoding: .utf8)
        XCTAssertEqual(intJSON, "42")
        
        // Test bool encoding
        let boolData = try encoder.encode(boolValue)
        let boolJSON = String(data: boolData, encoding: .utf8)
        XCTAssertEqual(boolJSON, "true")
    }
    
    func testTrackingEventEncoding() throws {
        let timestamp = "2024-01-01T12:00:00.000Z"
        let event = TrackingEvent(
            type: "test_event",
            timestamp: timestamp,
            metadata: [
                "key_code": AnyCodable(65),
                "character": AnyCodable("a"),
                "x": AnyCodable(100),
                "y": AnyCodable(200)
            ]
        )
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(event)
        let json = String(data: data, encoding: .utf8)
        
        XCTAssertNotNil(json)
        XCTAssertTrue(json!.contains("\"type\":\"test_event\""))
        XCTAssertTrue(json!.contains("\"timestamp\":\"\(timestamp)\""))
        XCTAssertTrue(json!.contains("\"metadata\""))
    }
    
    func testEventTypeGeneration() {
        // Test that we can generate all expected event types
        let expectedEventTypes = [
            "key_down",
            "key_up", 
            "mouse_down",
            "mouse_up",
            "app_focus",
            "app_blur",
            "window_change",
            "screen_content",
            "session_start",
            "session_end"
        ]
        
        for eventType in expectedEventTypes {
            let event = TrackingEvent(
                type: eventType,
                timestamp: ISO8601DateFormatter().string(from: Date()),
                metadata: [:]
            )
            
            XCTAssertEqual(event.type, eventType)
            XCTAssertNotNil(event.timestamp)
        }
    }
    
    func testJSONValidation() throws {
        // Test that generated JSON is valid
        let event = TrackingEvent(
            type: "key_down",
            timestamp: ISO8601DateFormatter().string(from: Date()),
            metadata: [
                "key_code": AnyCodable(65),
                "character": AnyCodable("a"),
                "modifiers": AnyCodable(256)
            ]
        )
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(event)
        
        // Verify we can decode it back
        let decoder = JSONDecoder()
        let decodedEvent = try decoder.decode(TrackingEvent.self, from: data)
        
        XCTAssertEqual(decodedEvent.type, event.type)
        XCTAssertEqual(decodedEvent.timestamp, event.timestamp)
        XCTAssertEqual(decodedEvent.metadata.count, event.metadata.count)
    }
    
    func testTimestampFormat() {
        let formatter = ISO8601DateFormatter()
        let date = Date()
        let timestamp = formatter.string(from: date)
        
        // Verify ISO8601 format
        XCTAssertTrue(timestamp.contains("T"))
        XCTAssertTrue(timestamp.contains("Z"))
        XCTAssertTrue(timestamp.count >= 19) // Basic ISO8601 length
    }
    
    func testMetadataTypes() throws {
        // Test that metadata can handle various data types
        let metadata: [String: AnyCodable] = [
            "string_field": AnyCodable("test"),
            "int_field": AnyCodable(42),
            "bool_field": AnyCodable(true),
            "double_field": AnyCodable(3.14)
        ]
        
        let event = TrackingEvent(
            type: "test_event",
            timestamp: ISO8601DateFormatter().string(from: Date()),
            metadata: metadata
        )
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(event)
        let json = String(data: data, encoding: .utf8)
        
        XCTAssertNotNil(json)
        XCTAssertTrue(json!.contains("\"string_field\":\"test\""))
        XCTAssertTrue(json!.contains("\"int_field\":42"))
        XCTAssertTrue(json!.contains("\"bool_field\":true"))
        XCTAssertTrue(json!.contains("\"double_field\":3.14"))
    }
}

// MARK: - Event Models (Copied for testing)
struct TrackingEvent: Codable {
    let type: String
    let timestamp: String
    let metadata: [String: AnyCodable]
}

struct AnyCodable: Codable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        switch value {
        case let string as String:
            try container.encode(string)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let bool as Bool:
            try container.encode(bool)
        case let dict as [String: Any]:
            let anyDict = dict.mapValues { AnyCodable($0) }
            try container.encode(anyDict)
        default:
            try container.encode("\(value)")
        }
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else {
            value = ""
        }
    }
} 
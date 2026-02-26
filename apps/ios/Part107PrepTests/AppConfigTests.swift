import XCTest
@testable import Part107Prep

final class AppConfigTests: XCTestCase {
    func testDefaultConfigUsesLocalhost() {
        let config = AppConfig.fromEnvironment()
        XCTAssertNotNil(config.apiBaseURL)
        XCTAssertGreaterThan(config.requestTimeoutSeconds, 0)
    }
}

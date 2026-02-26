import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case transport(String)
    case invalidResponse
    case statusCode(Int)
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid API URL."
        case .transport(let message): return "Network error: \(message)"
        case .invalidResponse: return "Invalid server response."
        case .statusCode(let code): return "Server returned status \(code)."
        case .decoding(let message): return "Failed to decode response: \(message)"
        }
    }
}

struct APIClient {
    let config: AppConfig
    var urlSession: URLSession = .shared

    init(config: AppConfig, urlSession: URLSession = .shared) {
        self.config = config
        self.urlSession = urlSession
    }

    func getQuestions(category: String = "All", questionType: String = "confirmed_test") async throws -> [Question] {
        guard var components = URLComponents(url: config.apiBaseURL.appendingPathComponent("/api/questions"), resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL
        }
        components.queryItems = [
            URLQueryItem(name: "category", value: category),
            URLQueryItem(name: "type", value: questionType),
        ]

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = config.requestTimeoutSeconds
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await urlSession.data(for: request)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            throw APIError.statusCode(http.statusCode)
        }

        do {
            let decoded = try JSONDecoder().decode(QuestionApiResponse.self, from: data)
            return decoded.questions
        } catch {
            throw APIError.decoding(error.localizedDescription)
        }
    }
}

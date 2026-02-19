// Part107Prep/ViewModels/QuizViewModel.swift
// Quiz engine logic — drives both Study and Exam modes
// Shared across iPhone, iPad, and macOS

import Foundation
import SwiftUI

@MainActor
class QuizViewModel: ObservableObject {
    
    // MARK: - Published State
    
    @Published var mode: QuizMode = .study
    @Published var questions: [Question] = []
    @Published var currentIndex: Int = 0
    @Published var answers: [String: UserAnswer] = [:]
    @Published var flaggedQuestions: Set<String> = []
    @Published var isComplete: Bool = false
    @Published var selectedOption: String? = nil
    @Published var answerState: AnswerState = .unanswered
    @Published private(set) var allQuestions: [Question] = []
    
    // Timer
    @Published var remainingTimeMs: Int = ExamConstants.timeLimitMs
    @Published var isTimerRunning: Bool = false
    private var timer: Timer?
    private var startTime: Date?
    private var questionStartTime: Date = Date()
    
    enum AnswerState {
        case unanswered
        case correct
        case incorrect
    }
    
    // MARK: - Computed Properties
    
    var currentQuestion: Question? {
        guard currentIndex < questions.count else { return nil }
        return questions[currentIndex]
    }
    
    var progress: Double {
        guard !questions.isEmpty else { return 0 }
        return Double(currentIndex + 1) / Double(questions.count)
    }
    
    var correctCount: Int {
        answers.values.filter { $0.isCorrect }.count
    }
    
    var scorePercent: Int {
        guard !answers.isEmpty else { return 0 }
        return Int(round(Double(correctCount) / Double(answers.count) * 100))
    }
    
    var passed: Bool {
        scorePercent >= ExamConstants.passingPercent
    }
    
    // MARK: - Load Questions
    
    func loadQuestions(from bundle: Bundle = .main) {
        var loadedQuestions: [Question] = []
        let files = ["regulations", "airspace", "weather", "operations", "loading_performance"]
        
        for file in files {
            if let url = bundle.url(forResource: file, withExtension: "json"),
               let data = try? Data(contentsOf: url) {
                do {
                    let decoded = try JSONDecoder().decode([Question].self, from: data)
                    loadedQuestions.append(contentsOf: decoded)
                } catch {
                    print("Failed to decode \(file).json: \(error)")
                }
            }
        }
        
        self.allQuestions = loadedQuestions
        self.questions = loadedQuestions.shuffled()
    }
    
    // MARK: - Start Session
    
    func startStudySession(category: QuestionCategory? = nil) {
        mode = .study
        var pool = allQuestions
        if let category = category {
            pool = pool.filter { $0.category == category }
        }
        questions = pool.shuffled()
        resetSession()
    }
    
    func startExamSession() {
        mode = .exam
        questions = Array(allQuestions.shuffled().prefix(ExamConstants.totalQuestions))
        resetSession()
        startTimer()
    }
    
    private func resetSession() {
        currentIndex = 0
        answers = [:]
        flaggedQuestions = []
        isComplete = false
        selectedOption = nil
        answerState = .unanswered
        questionStartTime = Date()
    }
    
    // MARK: - Answer Logic
    
    func submitAnswer(_ optionId: String) {
        guard let question = currentQuestion, answerState == .unanswered else { return }
        
        let isCorrect = optionId == question.correctOptionId
        let timeSpent = Int(Date().timeIntervalSince(questionStartTime) * 1000)
        
        selectedOption = optionId
        answerState = isCorrect ? .correct : .incorrect
        
        let answer = UserAnswer(
            questionId: question.id,
            selectedOptionId: optionId,
            isCorrect: isCorrect,
            timeSpentMs: timeSpent,
            flaggedForReview: flaggedQuestions.contains(question.id),
            timestamp: Date()
        )
        answers[question.id] = answer
        
        // In exam mode, auto-advance is not triggered — user controls navigation
    }
    
    // MARK: - Navigation
    
    func nextQuestion() {
        if currentIndex < questions.count - 1 {
            currentIndex += 1
            selectedOption = answers[questions[currentIndex].id]?.selectedOptionId
            answerState = selectedOption != nil
                ? (answers[questions[currentIndex].id]?.isCorrect == true ? .correct : .incorrect)
                : .unanswered
            questionStartTime = Date()
        } else {
            completeSession()
        }
    }
    
    func previousQuestion() {
        guard currentIndex > 0 else { return }
        currentIndex -= 1
        selectedOption = answers[questions[currentIndex].id]?.selectedOptionId
        answerState = selectedOption != nil
            ? (answers[questions[currentIndex].id]?.isCorrect == true ? .correct : .incorrect)
            : .unanswered
    }
    
    func goToQuestion(_ index: Int) {
        guard index >= 0 && index < questions.count else { return }
        currentIndex = index
        selectedOption = answers[questions[currentIndex].id]?.selectedOptionId
        if mode == .exam {
            // In exam mode, keep the selected state but don't show correct/incorrect
            answerState = .unanswered
        } else {
            answerState = selectedOption != nil
                ? (answers[questions[currentIndex].id]?.isCorrect == true ? .correct : .incorrect)
                : .unanswered
        }
    }
    
    // MARK: - Flag for Review
    
    func toggleFlag() {
        guard let question = currentQuestion else { return }
        if flaggedQuestions.contains(question.id) {
            flaggedQuestions.remove(question.id)
        } else {
            flaggedQuestions.insert(question.id)
        }
    }
    
    // MARK: - Timer (Exam Mode)
    
    private func startTimer() {
        startTime = Date()
        remainingTimeMs = ExamConstants.timeLimitMs
        isTimerRunning = true
        
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self = self, let startTime = self.startTime else { return }
                let elapsed = Int(Date().timeIntervalSince(startTime) * 1000)
                self.remainingTimeMs = max(0, ExamConstants.timeLimitMs - elapsed)
                
                if self.remainingTimeMs <= 0 {
                    self.completeSession()
                }
            }
        }
    }
    
    func stopTimer() {
        timer?.invalidate()
        timer = nil
        isTimerRunning = false
    }
    
    // MARK: - Complete Session
    
    func completeSession() {
        stopTimer()
        isComplete = true
    }
    
    func getResult() -> SessionResult {
        let correctCount = answers.values.filter { $0.isCorrect }.count
        let totalTime = answers.values.reduce(0) { $0 + $1.timeSpentMs }
        
        // Category breakdown
        var categoryMap: [QuestionCategory: (total: Int, correct: Int)] = [:]
        for question in questions {
            var entry = categoryMap[question.category] ?? (total: 0, correct: 0)
            entry.total += 1
            if let answer = answers[question.id], answer.isCorrect {
                entry.correct += 1
            }
            categoryMap[question.category] = entry
        }
        
        let breakdown = categoryMap.map { cat, stats in
            CategoryScore(
                category: cat,
                total: stats.total,
                correct: stats.correct,
                percent: stats.total > 0 ? Int(round(Double(stats.correct) / Double(stats.total) * 100)) : 0
            )
        }.sorted { $0.percent < $1.percent }
        
        let weakCategories = breakdown
            .filter { $0.percent < ExamConstants.passingPercent && $0.total >= 2 }
            .map { $0.category }
        
        return SessionResult(
            sessionId: UUID().uuidString,
            mode: mode,
            totalQuestions: questions.count,
            correctCount: correctCount,
            incorrectCount: answers.count - correctCount,
            unansweredCount: questions.count - answers.count,
            scorePercent: questions.count > 0 ? Int(round(Double(correctCount) / Double(questions.count) * 100)) : 0,
            passed: (questions.count > 0 ? Double(correctCount) / Double(questions.count) * 100 : 0) >= Double(ExamConstants.passingPercent),
            totalTimeMs: totalTime,
            categoryBreakdown: breakdown,
            weakestCategories: weakCategories,
            flaggedQuestions: Array(flaggedQuestions)
        )
    }
    
    // MARK: - Formatting
    
    var formattedRemainingTime: String {
        let totalSeconds = remainingTimeMs / 1000
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60
        
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        }
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// Part107Prep/Part107PrepApp.swift
// Main app entry point — universal app for iPhone, iPad, and Mac

import SwiftUI

@main
struct Part107PrepApp: App {
    @StateObject private var quizVM = QuizViewModel()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(quizVM)
        }
        #if os(macOS)
        .defaultSize(width: 900, height: 700)
        #endif
    }
}

// MARK: - Main Content View

struct ContentView: View {
    @EnvironmentObject var quizVM: QuizViewModel
    
    var body: some View {
        NavigationStack {
            HomeView()
        }
        .onAppear {
            quizVM.loadQuestions()
        }
        #if os(macOS)
        .frame(minWidth: 600, minHeight: 500)
        #endif
    }
}

// MARK: - Home View

struct HomeView: View {
    @EnvironmentObject var quizVM: QuizViewModel
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Hero
                VStack(spacing: 12) {
                    Text("🛩️")
                        .font(.system(size: 60))
                    Text("Part 107 Prep")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    Text("FAA Remote Pilot Exam Prep — Updated 2026")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 20)
                
                // Action Cards
                VStack(spacing: 12) {
                    NavigationLink {
                        StudyCategoryView()
                    } label: {
                        FeatureCard(
                            icon: "📖",
                            title: "Study Mode",
                            subtitle: "Instant feedback — learn why you're right or wrong",
                            color: .blue
                        )
                    }
                    .buttonStyle(.plain)
                    
                    NavigationLink {
                        ExamSetupView()
                    } label: {
                        FeatureCard(
                            icon: "🎯",
                            title: "Exam Mode",
                            subtitle: "60 questions, 2 hours — simulate the real test",
                            color: .purple
                        )
                    }
                    .buttonStyle(.plain)
                    
                    NavigationLink {
                        Text("Charts Viewer — Coming Soon")
                            .navigationTitle("Charts")
                    } label: {
                        FeatureCard(
                            icon: "🗺️",
                            title: "Sectional Charts",
                            subtitle: "High-res, pinch-to-zoom chart viewer",
                            color: .green
                        )
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal)
                
                // Quick Stats
                HStack(spacing: 16) {
                    StatBadge(value: "\(quizVM.questions.count)", label: "Questions")
                    StatBadge(value: "70%", label: "To Pass")
                    StatBadge(value: "2hrs", label: "Time Limit")
                    StatBadge(value: "2026", label: "Updated")
                }
                .padding(.horizontal)
            }
            .padding(.bottom, 40)
        }
        .navigationTitle("Part 107 Prep")
    }
}

// MARK: - Reusable Components

struct FeatureCard: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 16) {
            Text(icon)
                .font(.title)
                .frame(width: 50, height: 50)
                .background(color.opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundStyle(.tertiary)
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

struct StatBadge: View {
    let value: String
    let label: String
    
    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Study Category Selection

struct StudyCategoryView: View {
    @EnvironmentObject var quizVM: QuizViewModel
    
    var body: some View {
        List {
            NavigationLink("All Categories") {
                StudyQuizView()
                    .onAppear { quizVM.startStudySession() }
            }
            
            ForEach(QuestionCategory.allCases) { category in
                let count = quizVM.questions.filter { $0.category == category }.count
                if count > 0 {
                    NavigationLink {
                        StudyQuizView()
                            .onAppear { quizVM.startStudySession(category: category) }
                    } label: {
                        HStack {
                            Text(category.icon)
                            Text(category.rawValue)
                            Spacer()
                            Text("\(count)")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Study Mode")
    }
}

// MARK: - Exam Setup

struct ExamSetupView: View {
    @EnvironmentObject var quizVM: QuizViewModel
    @State private var showExam = false
    
    var body: some View {
        VStack(spacing: 24) {
            Text("🎯")
                .font(.system(size: 60))
            Text("Practice Exam")
                .font(.title)
                .fontWeight(.bold)
            
            VStack(spacing: 12) {
                InfoRow(label: "Questions", value: "\(min(60, quizVM.questions.count))")
                InfoRow(label: "Time Limit", value: "2 Hours")
                InfoRow(label: "Passing Score", value: "70%")
                InfoRow(label: "Feedback", value: "After submission only")
            }
            .padding()
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            
            NavigationLink("Begin Exam →") {
                ExamQuizView()
                    .onAppear { quizVM.startExamSession() }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding()
        .navigationTitle("Exam Setup")
    }
}

struct InfoRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}

// MARK: - Placeholder Quiz Views

struct StudyQuizView: View {
    @EnvironmentObject var quizVM: QuizViewModel
    
    var body: some View {
        Text("Study Quiz — Question \(quizVM.currentIndex + 1) of \(quizVM.questions.count)")
            .navigationTitle("Study Mode")
        // Full quiz UI will be built here
    }
}

struct ExamQuizView: View {
    @EnvironmentObject var quizVM: QuizViewModel
    
    var body: some View {
        Text("Exam — \(quizVM.formattedRemainingTime) remaining")
            .navigationTitle("Practice Exam")
        // Full exam UI will be built here
    }
}

function QuizList({ quizzes, loading, onRefresh, onSelectQuiz }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Saved quizzes</h2>
        <button type="button" className="secondary-button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {loading ? <p>Loading...</p> : null}

      <div className="quiz-list">
        {quizzes.map((quiz) => (
          <button
            key={quiz.id}
            type="button"
            className="quiz-list-item"
            onClick={() => onSelectQuiz(quiz)}
          >
            <strong>{quiz.title}</strong>
            <span>{quiz.description || 'No description'}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default QuizList

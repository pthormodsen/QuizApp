import { useEffect, useState } from 'react'
import QuizForm from '../components/QuizForm'
import QuizList from '../components/QuizList'
import { createQuiz, getQuizzes } from '../api/quizApi'

function QuizPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState(null)

  useEffect(() => {
    loadQuizzes()
  }, [])

  async function loadQuizzes() {
    setLoading(true)
    setMessage('')

    try {
      const data = await getQuizzes()
      setQuizzes(data)
    } catch {
      setMessage('Could not load quizzes. Is the backend running on port 8080?')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')

    const payload = {
      title,
      description,
    }

    try {
      await createQuiz(payload)
      setTitle('')
      setDescription('')
      setMessage('Quiz created.')
      await loadQuizzes()
    } catch {
      setMessage('Could not create quiz.')
    }
  }

  return (
    <div className="app-shell">
      <main className="simple-layout">
        <QuizForm
          title={title}
          description={description}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onSubmit={handleSubmit}
          message={message}
        />

        <QuizList
          quizzes={quizzes}
          loading={loading}
          onRefresh={loadQuizzes}
          onSelectQuiz={setSelectedQuiz}
        />
      </main>
    </div>
  )
}

export default QuizPage

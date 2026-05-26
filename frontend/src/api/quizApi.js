const API_BASE_URL = 'http://localhost:8080/api/quizzes'

export async function getQuizzes() {
  const response = await fetch(API_BASE_URL)

  if (!response.ok) {
    throw new Error('Could not load quizzes')
  }

  return response.json()
}

export async function createQuiz(payload) {
  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Could not create quiz')
  }

  return response.json()
}

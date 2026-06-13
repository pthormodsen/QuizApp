type Question = {
  id: number;
  text: string;
};

function QuestionList({ questions }: { questions: Question[] }) {
  return (
    <div>
      <h2>Questions</h2>
      {questions.length === 0 ? (
        <p>No questions yet. Add the first one!</p>
      ) : (
        questions.map((question) => <p key={question.id}>{question.text}</p>)
      )}
    </div>
  );
}

export default QuestionList;

function QuizForm({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onSubmit,
  message,
}) {
  return (
    <section className="panel">
      <p className="eyebrow">Quiz App</p>
      <h1>Create a simple quiz</h1>
      <p className="lede">
        This version only saves a title and description. Keep it small until the
        flow feels easy.
      </p>

      <form onSubmit={onSubmit} className="quiz-form">
        <label>
          Title
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Java basics"
            required
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Small quiz about Java"
            rows="4"
          />
        </label>

        <button type="submit">Save quiz</button>
      </form>

      {message ? <p className="message">{message}</p> : null}
    </section>
  )
}

export default QuizForm

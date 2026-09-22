import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";

function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (email.trim() === "" || password.trim() === "") {
      setError("Email and password are required");
      return;
    }

    try {
      setIsSubmitting(true);
      await register(email, password);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError("An account with that email already exists");
        } else if (err.fieldErrors) {
          setError(Object.values(err.fieldErrors).join(" "));
        } else {
          setError(err.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <form
        className="card flex w-full max-w-[520px] flex-col gap-3"
        onSubmit={handleSubmit}
      >
        <h2 className="title">Create an account</h2>
        <p className="m-0 text-muted">
          Recruiters and visitors can preview the app instantly with the demo
          flow.
        </p>
        {error && <p className="m-0 mb-3 text-red-600">{error}</p>}
        <input
          className="field w-full"
          type="email"
          placeholder="Email"
          value={email}
          disabled={isSubmitting}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="field w-full"
          type="password"
          placeholder="Password"
          value={password}
          disabled={isSubmitting}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="m-0 text-xs text-muted">
          Password must be 8-72 characters and include at least one letter and one number.
        </p>
        <div className="button-row">
          <button
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating account..." : "Register"}
          </button>
          <Link
            className="rounded-md bg-[#eef1ff] px-3.5 py-2.5 font-bold text-[#172033] no-underline"
            to="/demo"
          >
            View demo
          </Link>
        </div>
        <p className="m-0 text-center">
          Already have an account? <Link className="font-semibold underline" to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}

export default RegisterPage;

import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
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
      await login(email, password);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("Invalid email or password");
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
    <div className="flex min-h-screen w-full items-center justify-center bg-[#5d6fe4] px-5 py-8">
      <form
        className="flex w-full max-w-[520px] flex-col gap-3 rounded-lg border border-[#dfe3f0] bg-white p-[18px] shadow-[0_10px_24px_rgba(22,28,45,0.14)]"
        onSubmit={handleSubmit}
      >
        <h2 className="title">Log in</h2>
        {error && <p className="m-0 mb-3 text-red-600">{error}</p>}
        <input
          className="w-full rounded-md border border-[#cfd5e6] px-3 py-[11px]"
          type="email"
          placeholder="Email"
          value={email}
          disabled={isSubmitting}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-[#cfd5e6] px-3 py-[11px]"
          type="password"
          placeholder="Password"
          value={password}
          disabled={isSubmitting}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex justify-center">
          <button
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
          <Link
            className="rounded-md bg-[#eef1ff] px-3.5 py-2.5 font-bold text-[#172033] no-underline"
            to="/demo"
          >
            View demo
          </Link>
        </div>
        <p className="m-0 text-center">
          No account yet? <Link className="font-semibold underline" to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}

export default LoginPage;

import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";

function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await register(email, password);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("An account with that email already exists");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#5d6fe4] px-5 py-8">
      <form
        className="flex w-full max-w-[520px] flex-col gap-3 rounded-lg border border-[#dfe3f0] bg-white p-[18px] shadow-[0_10px_24px_rgba(22,28,45,0.14)]"
        onSubmit={handleSubmit}
      >
        <h2 className="m-0">Create an account</h2>
        {error && <p className="m-0 mb-3 text-red-600">{error}</p>}
        <input
          className="w-full rounded-md border border-[#cfd5e6] px-3 py-[11px]"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-[#cfd5e6] px-3 py-[11px]"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex flex-wrap gap-2.5">
          <button
            className="cursor-pointer rounded-md bg-[#172033] px-3.5 py-2.5 font-bold text-white"
            type="submit"
          >
            Register
          </button>
        </div>
        <p>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}

export default RegisterPage;

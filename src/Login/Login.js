import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginAdmin } from "../api/authService";
import Modal from "../components/Modal/Modal";
import "./Login.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleClose = () => {
    navigate("/");
  };

  const submitHandler = async (event) => {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    try {
      setLoading(true);
      const data = await loginAdmin({ username: username.trim(), password });
      localStorage.setItem("adminToken", data?.token);
      navigate("/admin");
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={handleClose} maxWidth="520px">
      <section className="login__card" aria-label="Admin login form">
        <h1 className="login__title">Admin Login</h1>
        <p className="login__subtitle">
          Sign in to manage gallery, services, and settings.
        </p>

        {error && <div className="login__error">{error}</div>}

        <form className="login__form" onSubmit={submitHandler}>
          <label className="login__label" htmlFor="login-username">
            Username
          </label>
          <input
            id="login-username"
            type="text"
            className="login__input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
          />

          <label className="login__label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            className="login__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
          />

          <button className="login__button" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="login__help">
          Need the admin password? Contact the site owner for access.
        </p>
      </section>
    </Modal>
  );
}

export default Login;

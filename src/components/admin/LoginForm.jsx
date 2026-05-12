import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import styles from './LoginForm.module.css';

function makeCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
}

export default function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState(makeCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');

  const captchaText = useMemo(() => `${captcha.a} + ${captcha.b}`, [captcha]);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (Number(captchaInput) !== captcha.answer) {
      setError('CAPTCHA incorrecto.');
      setCaptcha(makeCaptcha());
      setCaptchaInput('');
      return;
    }
    const ok = login(password);
    if (!ok) {
      setError('Clave incorrecta.');
      setCaptcha(makeCaptcha());
      setCaptchaInput('');
      setPassword('');
      return;
    }
    navigate('/admin');
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <img src="/images/logo-club.png" alt="" className={styles.logo} />
        <h1 className={styles.title}>Panel administrativo</h1>
        <p className={styles.sub}>Acceso restringido al staff del club.</p>

        <div className={styles.field}>
          <label htmlFor="pwd">Clave</label>
          <input
            id="pwd"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="captcha">¿Cuánto es {captchaText}?</label>
          <input
            id="captcha"
            type="number"
            value={captchaInput}
            onChange={e => setCaptchaInput(e.target.value)}
            required
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className="btn btn-primary btn-block">Ingresar</button>
      </form>
    </div>
  );
}

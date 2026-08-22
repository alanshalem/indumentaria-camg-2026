import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { errorMessage } from '@/services/apiError';
import { Alert, Button, Field } from '@/ui';
import styles from './LoginForm.module.css';

interface Captcha {
  a: number;
  b: number;
  answer: number;
}

const makeCaptcha = (): Captcha => {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
};

/**
 * El CAPTCHA es sólo fricción contra bots triviales: al ser client-side, no es
 * una defensa. La real es el rate limit del servidor sobre /api/auth/login.
 */
export function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState<Captcha>(makeCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetChallenge = useCallback(() => {
    setCaptcha(makeCaptcha());
    setCaptchaInput('');
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (Number(captchaInput) !== captcha.answer) {
      setError('CAPTCHA incorrecto.');
      resetChallenge();
      return;
    }

    setIsSubmitting(true);
    try {
      await login(password);
      navigate('/admin', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught, 'No se pudo iniciar sesión.'));
      setPassword('');
      resetChallenge();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <img src="/images/logo-club.png" alt="" className={styles.logo} />
        <h1 className={styles.title}>Panel administrativo</h1>
        <p className={styles.sub}>Acceso restringido al staff del club.</p>

        {/* Los gestores de contraseñas necesitan un campo de usuario para
            asociar la clave a este sitio; el panel tiene un único admin. */}
        <input
          type="text"
          name="username"
          value="admin"
          autoComplete="username"
          readOnly
          hidden
          aria-hidden="true"
        />

        <Field
          label="Clave"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        <Field
          label={`¿Cuánto es ${captcha.a} + ${captcha.b}?`}
          type="number"
          value={captchaInput}
          onChange={(event) => setCaptchaInput(event.target.value)}
          inputMode="numeric"
          required
        />

        <Alert>{error}</Alert>

        <Button type="submit" block loading={isSubmitting}>
          {isSubmitting ? 'Verificando…' : 'Ingresar'}
        </Button>
      </form>
    </div>
  );
}

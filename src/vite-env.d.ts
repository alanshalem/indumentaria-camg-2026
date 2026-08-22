/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base de la API. Vacío en producción (mismo origen). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

// Stylesheets werden vom Build (esbuild) eingebunden; für die Typprüfung genügt, dass es sie gibt.
declare module '*.css';

/** Version der gebauten Oberfläche, vom Build eingesetzt (scripts/build.ts) */
declare const __APP_VERSION__: string;

import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="not-found-screen">
      <AlertCircle size={34} aria-hidden="true" />
      <p className="eyebrow">GRILL CRAFT / 404</p>
      <h1>That page<br /><em>isn’t on the menu.</em></h1>
      <a href="/">Back to Grill Craft</a>
    </main>
  );
}

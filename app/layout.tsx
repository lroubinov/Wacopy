import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'מעבירון — טקסט מהטלפון למחשב',
  description: 'העברת טקסט מהירה ופשוטה מהטלפון למחשב דרך הרשת המקומית.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}

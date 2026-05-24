import { useState, useEffect } from 'react';

type Theme = 'dark' | 'light';
const STORAGE_KEY = 'haven-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'dark';
  });

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('dark', 'light');
    html.classList.add(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return { theme, toggleTheme };
}

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/button';

export function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button size="icon" variant="ghost" onClick={toggleTheme} aria-label="Toggle colour theme" title="Toggle light/dark theme">
      {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
    </Button>
  );
}

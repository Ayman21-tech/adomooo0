import React, { createContext, useContext, useEffect, useState } from 'react';

type FontSize = 'small' | 'medium' | 'large' | 'extra-large';

interface AccessibilitySettings {
  highContrast: boolean;
  fontSize: FontSize;
  dyslexicFont: boolean;
  screenReaderOptimized: boolean;
}

interface AccessibilityContextType extends AccessibilitySettings {
  setHighContrast: (val: boolean) => void;
  setFontSize: (val: FontSize) => void;
  setDyslexicFont: (val: boolean) => void;
  setScreenReaderOptimized: (val: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('high-contrast') === 'true');
  const [fontSize, setFontSize] = useState<FontSize>(() => (localStorage.getItem('font-size') as FontSize) || 'medium');
  const [dyslexicFont, setDyslexicFont] = useState(() => localStorage.getItem('dyslexic-font') === 'true');
  const [screenReaderOptimized, setScreenReaderOptimized] = useState(() => localStorage.getItem('sr-optimized') === 'true');

  useEffect(() => {
    localStorage.setItem('high-contrast', highContrast.toString());
    document.documentElement.classList.toggle('high-contrast', highContrast);
  }, [highContrast]);

  useEffect(() => {
    localStorage.setItem('font-size', fontSize);
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('dyslexic-font', dyslexicFont.toString());
    document.documentElement.classList.toggle('dyslexic-font', dyslexicFont);
  }, [dyslexicFont]);

  useEffect(() => {
    localStorage.setItem('sr-optimized', screenReaderOptimized.toString());
    document.documentElement.classList.toggle('sr-optimized', screenReaderOptimized);
  }, [screenReaderOptimized]);

  return (
    <AccessibilityContext.Provider 
      value={{ 
        highContrast, setHighContrast, 
        fontSize, setFontSize, 
        dyslexicFont, setDyslexicFont,
        screenReaderOptimized, setScreenReaderOptimized
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

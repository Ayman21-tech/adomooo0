import en from './translations/en.json';
import bn from './translations/bn.json';

export type Language = 'en' | 'bangla';

const translations: Record<string, typeof en> = {
  en,
  english: en,
  bangla: bn,
  bn,
};

/**
 * Get a translated string by dot-notation key.
 * Supports {{variable}} interpolation.
 * 
 * Example: t('progress.welcomeUser', lang, { name: 'Ayman' })
 */
export function t(key: string, lang: Language | string = 'en', vars?: Record<string, string | number>): string {
  const langKey = lang === 'bangla' || lang === 'bn' ? 'bangla' : 'en';
  const dict = translations[langKey] || translations.en;
  
  const keys = key.split('.');
  let value: any = dict;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English
      value = translations.en;
      for (const fk of keys) {
        if (value && typeof value === 'object' && fk in value) {
          value = value[fk];
        } else {
          return key; // Key not found
        }
      }
      break;
    }
  }

  if (typeof value !== 'string') return key;

  // Interpolate variables
  if (vars) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      return vars[varName]?.toString() ?? `{{${varName}}}`;
    });
  }

  return value;
}

export { en, bn };

export interface Subject {
  id: string;
  name: string;
  category: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  subjects: Subject[];
}

export const categories: Category[] = [
  {
    id: 'languages',
    name: 'Languages',
    icon: '📘',
    subjects: [
      { id: 'english', name: 'English', category: 'languages' },
      { id: 'english-language', name: 'English Language', category: 'languages' },
      { id: 'english-literature', name: 'English Literature', category: 'languages' },
      { id: 'bangla', name: 'Bangla', category: 'languages' },
      { id: 'bangla-language', name: 'Bangla Language', category: 'languages' },
      { id: 'bangla-literature', name: 'Bangla Literature', category: 'languages' },
      { id: 'spanish', name: 'Spanish', category: 'languages' },
      { id: 'french', name: 'French', category: 'languages' },
      { id: 'arabic', name: 'Arabic', category: 'languages' },
      { id: 'hindi', name: 'Hindi', category: 'languages' },
      { id: 'chinese', name: 'Chinese', category: 'languages' },
    ],
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    icon: '📐',
    subjects: [
      { id: 'mathematics', name: 'Mathematics', category: 'mathematics' },
      { id: 'general-mathematics', name: 'General Mathematics', category: 'mathematics' },
      { id: 'higher-mathematics', name: 'Higher Mathematics', category: 'mathematics' },
      { id: 'algebra', name: 'Algebra', category: 'mathematics' },
      { id: 'geometry', name: 'Geometry', category: 'mathematics' },
      { id: 'calculus', name: 'Calculus', category: 'mathematics' },
      { id: 'statistics', name: 'Statistics', category: 'mathematics' },
    ],
  },
  {
    id: 'science',
    name: 'Science',
    icon: '🔬',
    subjects: [
      { id: 'science', name: 'Science', category: 'science' },
      { id: 'general-science', name: 'General Science', category: 'science' },
      { id: 'physics', name: 'Physics', category: 'science' },
      { id: 'chemistry', name: 'Chemistry', category: 'science' },
      { id: 'biology', name: 'Biology', category: 'science' },
      { id: 'environmental-science', name: 'Environmental Science', category: 'science' },
    ],
  },
  {
    id: 'social-studies',
    name: 'Social Studies',
    icon: '🌍',
    subjects: [
      { id: 'social-studies', name: 'Social Studies', category: 'social-studies' },
      { id: 'history', name: 'History', category: 'social-studies' },
      { id: 'geography', name: 'Geography', category: 'social-studies' },
      { id: 'civics', name: 'Civics', category: 'social-studies' },
      { id: 'economics', name: 'Economics', category: 'social-studies' },
      { id: 'psychology', name: 'Psychology', category: 'social-studies' },
      { id: 'philosophy', name: 'Philosophy', category: 'social-studies' },
    ],
  },
  {
    id: 'technology',
    name: 'Technology',
    icon: '💻',
    subjects: [
      { id: 'ict', name: 'Information & Communication Technology', category: 'technology' },
      { id: 'computer-science', name: 'Computer Science', category: 'technology' },
      { id: 'programming', name: 'Programming', category: 'technology' },
    ],
  },
  {
    id: 'business-studies',
    name: 'Business Studies',
    icon: '📊',
    subjects: [
      { id: 'accounting', name: 'Accounting', category: 'business-studies' },
      { id: 'business-entrepreneurship', name: 'Business & Entrepreneurship', category: 'business-studies' },
      { id: 'finance-banking', name: 'Finance & Banking', category: 'business-studies' },
      { id: 'marketing', name: 'Marketing', category: 'business-studies' },
    ],
  },
  {
    id: 'arts-health',
    name: 'Arts & Health',
    icon: '🎨',
    subjects: [
      { id: 'art', name: 'Art & Design', category: 'arts-health' },
      { id: 'music', name: 'Music', category: 'arts-health' },
      { id: 'physical-education', name: 'Physical Education & Health', category: 'arts-health' },
      { id: 'religious-studies', name: 'Religious Studies', category: 'arts-health' },
    ],
  },
];

export const classLevels = [
  'Pre-K',
  'Kindergarten',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
];

export function getSubjectById(id: string): Subject | undefined {
  for (const category of categories) {
    const subject = category.subjects.find(s => s.id === id);
    if (subject) return subject;
  }
  return undefined;
}

export function getCategoryBySubjectId(subjectId: string): Category | undefined {
  return categories.find(cat => cat.subjects.some(s => s.id === subjectId));
}

export function getAllSubjects(): Subject[] {
  return categories.flatMap(cat => cat.subjects);
}

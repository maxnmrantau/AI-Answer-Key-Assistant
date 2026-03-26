export interface QuestionItem {
  id: string;
  type: 'text' | 'image';
  content: string; // text content or base64 for image
  name?: string; // file name for image
  mimeType?: string; // mimeType for image
  result?: {
    answer: string;
    explanation: string;
  };
  loading?: boolean;
  error?: string;
}

export interface FileData {
  name: string;
  base64: string;
  mimeType: string;
}

export interface AIResponse {
  answer: string;
  explanation: string;
  confidence: number;
}

export interface GeneratedQuestion {
  question: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  correctAnswer: string;
  explanation: string;
}

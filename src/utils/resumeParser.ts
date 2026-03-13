import { ResumeContext } from '../../types';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

const MAX_RESUME_CHARS = 8000;

const cleanResumeText = (text: string): string => {
  return text
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\t ]{2,}/g, ' ')
    .trim();
};

const extractPdfText = async (file: File): Promise<string> => {
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item?.str || '')
      .join(' ')
      .trim();
    if (text) {
      pageTexts.push(text);
    }
  }

  return pageTexts.join('\n');
};

const extractDocxText = async (file: File): Promise<string> => {
  const mammoth: any = await import('mammoth/mammoth.browser');
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value || '';
};

const extractTextByType = async (file: File): Promise<string> => {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
    return extractPdfText(file);
  }

  if (
    lowerName.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return extractDocxText(file);
  }

  return file.text();
};

export const parseResumeFile = async (file: File): Promise<ResumeContext> => {
  const rawText = await extractTextByType(file);
  const cleanedText = cleanResumeText(rawText);

  if (!cleanedText) {
    throw new Error('Could not extract readable text from this file. Try a text-based PDF/DOCX/TXT resume.');
  }

  return {
    fileName: file.name,
    resumeText: cleanedText.slice(0, MAX_RESUME_CHARS),
    uploadedAt: Date.now(),
  };
};

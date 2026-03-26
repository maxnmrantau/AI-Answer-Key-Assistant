/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileText, 
  Upload, 
  X, 
  Search, 
  Image as ImageIcon, 
  Type, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  FileUp,
  Sparkles,
  BookOpen,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  Key,
  Settings2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';
import { FileData, GeneratedQuestion, QuestionItem } from './types';

const MODEL_NAME = "gemini-3-flash-preview";

export default function App() {
  const [pdfFiles, setPdfFiles] = useState<FileData[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [activeTab, setActiveTab] = useState<'checker' | 'generator'>('checker');
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(5);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('gemini_api_keys');
    return saved ? JSON.parse(saved) : [];
  });
  const [newKey, setNewKey] = useState('');
  const [activeKeyIndex, setActiveKeyIndex] = useState(0);

  // Save keys to localStorage
  React.useEffect(() => {
    localStorage.setItem('gemini_api_keys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  const addApiKey = () => {
    if (newKey.trim() && !apiKeys.includes(newKey.trim())) {
      setApiKeys(prev => [...prev, newKey.trim()]);
      setNewKey('');
    }
  };

  const removeApiKey = (index: number) => {
    setApiKeys(prev => prev.filter((_, i) => i !== index));
    if (activeKeyIndex >= index && activeKeyIndex > 0) {
      setActiveKeyIndex(prev => prev - 1);
    }
  };

  const getEffectiveApiKey = () => {
    if (apiKeys.length > 0) {
      return apiKeys[activeKeyIndex];
    }
    return process.env.GEMINI_API_KEY || '';
  };

  const rotateApiKey = () => {
    if (apiKeys.length > 1) {
      setActiveKeyIndex(prev => (prev + 1) % apiKeys.length);
      return true;
    }
    return false;
  };

  const onDropPdfs = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setPdfFiles(prev => [...prev, {
          name: file.name,
          base64,
          mimeType: file.type
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const onDropImage = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const newQuestion: QuestionItem = {
          id: Math.random().toString(36).substring(7),
          type: 'image',
          content: base64,
          name: file.name,
          mimeType: file.type
        };
        setQuestions(prev => [...prev, newQuestion]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const addTextQuestion = () => {
    const newQuestion: QuestionItem = {
      id: Math.random().toString(36).substring(7),
      type: 'text',
      content: ''
    };
    setQuestions(prev => [...prev, newQuestion]);
  };

  const updateQuestionContent = (id: string, content: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, content } : q));
  };

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const { getRootProps: getPdfRootProps, getInputProps: getPdfInputProps, isDragActive: isPdfDragActive } = useDropzone({
    onDrop: onDropPdfs,
    accept: { 'application/pdf': ['.pdf'] }
  } as any);

  const { getRootProps: getImageRootProps, getInputProps: getImageInputProps, isDragActive: isImageDragActive } = useDropzone({
    onDrop: onDropImage,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    multiple: true
  } as any);

  const removePdf = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFindAnswer = async () => {
    if (pdfFiles.length === 0) {
      setError("Silakan upload setidaknya satu PDF kunci jawaban.");
      return;
    }

    if (questions.length === 0) {
      setError("Silakan tambahkan setidaknya satu pertanyaan.");
      return;
    }

    const emptyTextQuestions = questions.filter(q => q.type === 'text' && !q.content.trim());
    if (emptyTextQuestions.length > 0) {
      setError("Beberapa pertanyaan teks masih kosong.");
      return;
    }

    setLoading(true);
    setError(null);

    const tryProcess = async (retryCount = 0): Promise<void> => {
      try {
        const currentKey = getEffectiveApiKey();
        if (!currentKey) {
          throw new Error("API Key tidak ditemukan. Silakan masukkan API Key di panel kiri.");
        }

        const ai = new GoogleGenAI({ apiKey: currentKey });
        
        const pdfParts = pdfFiles.map(file => ({
          inlineData: {
            data: file.base64,
            mimeType: file.mimeType
          }
        }));

        const systemInstruction = `
          Anda adalah asisten ahli pemeriksa jawaban. 
          Tugas Anda adalah mencari jawaban yang benar untuk pertanyaan yang diberikan berdasarkan dokumen PDF kunci jawaban yang diunggah.
          
          Instruksi:
          1. Analisis pertanyaan (bisa berupa teks atau gambar screenshot pilihan ganda).
          2. Cari informasi yang relevan di dalam PDF yang disediakan.
          3. Tentukan jawaban yang paling tepat.
          4. Berikan jawaban akhir dan penjelasan singkat mengapa jawaban tersebut benar berdasarkan dokumen.
          5. Jika jawaban tidak ditemukan di PDF, berikan jawaban terbaik berdasarkan pengetahuan umum Anda tetapi beri catatan bahwa itu tidak ditemukan di dokumen.
          
          Format Output (JSON):
          {
            "answer": "Jawaban singkat (misal: A. Jakarta)",
            "explanation": "Penjelasan singkat berdasarkan dokumen"
          }
        `;

        // Process questions in parallel
        const processQuestion = async (q: QuestionItem, index: number) => {
          if (q.result) return;

          setQuestions(prev => prev.map((item, idx) => idx === index ? { ...item, loading: true } : item));

          const questionPart = q.type === 'text' 
            ? { text: `Pertanyaan: ${q.content}` }
            : { 
                inlineData: { 
                  data: q.content, 
                  mimeType: q.mimeType! 
                } 
              };

          try {
            const response = await ai.models.generateContent({
              model: MODEL_NAME,
              contents: [
                { parts: [...pdfParts, questionPart] }
              ],
              config: {
                systemInstruction,
                responseMimeType: "application/json"
              }
            });

            const data = JSON.parse(response.text || "{}");
            setQuestions(prev => prev.map((item, idx) => idx === index ? { ...item, result: data, loading: false } : item));
          } catch (err: any) {
            console.error(`Error processing question ${index}:`, err);
            
            // Check for auth/quota errors to trigger rotation
            const errorMsg = err.message?.toLowerCase() || "";
            if ((errorMsg.includes("api_key_invalid") || errorMsg.includes("quota") || errorMsg.includes("401") || errorMsg.includes("429")) && rotateApiKey()) {
              throw new Error("ROTATION_TRIGGERED");
            }

            setQuestions(prev => prev.map((item, idx) => idx === index ? { ...item, error: "Gagal memproses pertanyaan ini.", loading: false } : item));
          }
        };

        await Promise.all(questions.map((q, idx) => processQuestion(q, idx)));

      } catch (err: any) {
        if (err.message === "ROTATION_TRIGGERED" && retryCount < apiKeys.length) {
          console.log("Rotating API Key and retrying...");
          return tryProcess(retryCount + 1);
        }
        console.error("AI Error:", err);
        setError(err.message || "Terjadi kesalahan sistem. Pastikan file tidak terlalu besar.");
      }
    };

    await tryProcess();
    setLoading(false);
  };

  const handleGenerateQuestions = async () => {
    if (pdfFiles.length === 0) {
      setError("Silakan upload setidaknya satu PDF sebagai referensi soal.");
      return;
    }

    setLoading(true);
    setError(null);

    const tryGenerate = async (retryCount = 0): Promise<void> => {
      try {
        const currentKey = getEffectiveApiKey();
        if (!currentKey) {
          throw new Error("API Key tidak ditemukan. Silakan masukkan API Key di panel kiri.");
        }

        const ai = new GoogleGenAI({ apiKey: currentKey });
        
        const pdfParts = pdfFiles.map(file => ({
          inlineData: {
            data: file.base64,
            mimeType: file.mimeType
          }
        }));

        const existingQuestionsText = generatedQuestions.length > 0 
          ? `Berikut adalah daftar pertanyaan yang sudah dibuat sebelumnya (JANGAN MEMBUAT PERTANYAAN YANG SAMA DENGAN INI): \n${generatedQuestions.map(q => q.question).join('\n')}`
          : "";

        const systemInstruction = `
          Anda adalah asisten ahli pembuat soal ujian. 
          Tugas Anda adalah membuat ${questionCount} soal pilihan ganda yang berkualitas berdasarkan dokumen-dokumen PDF yang diunggah.
          
          Instruksi:
          1. Analisis isi dari SEMUA dokumen PDF yang disediakan.
          2. Buatlah tepat ${questionCount} soal pilihan ganda (A, B, C, D) yang relevan dengan materi di PDF.
          3. Pastikan soal bervariasi tingkat kesulitannya dan mencakup berbagai topik dari dokumen-dokumen tersebut.
          4. Berikan kunci jawaban dan penjelasan singkat untuk setiap soal.
          5. PENTING: Jangan membuat soal yang sama atau sangat mirip dengan daftar pertanyaan yang sudah ada.
          
          ${existingQuestionsText}
          
          Format Output (JSON Array of Objects):
          [
            {
              "question": "Pertanyaan soal...",
              "options": {
                "a": "Pilihan A",
                "b": "Pilihan B",
                "c": "Pilihan C",
                "d": "Pilihan D"
              },
              "correctAnswer": "a",
              "explanation": "Penjelasan mengapa A benar..."
            }
          ]
        `;

        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: [
            { parts: [...pdfParts, { text: `Buatkan ${questionCount} soal pilihan ganda baru dari dokumen-dokumen ini. Pastikan soal-soal ini berbeda dari yang sebelumnya.` }] }
          ],
          config: {
            systemInstruction,
            responseMimeType: "application/json"
          }
        });

        const data = JSON.parse(response.text || "[]");
        setGeneratedQuestions(prev => [...prev, ...data]);
      } catch (err: any) {
        const errorMsg = err.message?.toLowerCase() || "";
        if ((errorMsg.includes("api_key_invalid") || errorMsg.includes("quota") || errorMsg.includes("401") || errorMsg.includes("429")) && rotateApiKey() && retryCount < apiKeys.length) {
          console.log("Rotating API Key and retrying generation...");
          return tryGenerate(retryCount + 1);
        }
        console.error("AI Error:", err);
        setError(err.message || "Terjadi kesalahan saat membuat soal. Coba lagi nanti.");
      }
    };

    await tryGenerate();
    setLoading(false);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
          AI Answer Key Assistant
        </h1>
        <p className="text-slate-500 mb-6">
          Upload database kunci jawaban dan temukan jawaban atau buat soal baru.
        </p>

        <div className="flex justify-center">
          <div className="inline-flex bg-slate-200/50 p-1 rounded-xl backdrop-blur-sm border border-slate-200">
            <button 
              onClick={() => setActiveTab('checker')}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all",
                activeTab === 'checker' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Search className="w-4 h-4" />
              Cek Jawaban
            </button>
            <button 
              onClick={() => setActiveTab('generator')}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all",
                activeTab === 'generator' ? "bg-white shadow-sm text-purple-600" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Sparkles className="w-4 h-4" />
              Generator Soal
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar: Database Upload */}
        <div className="lg:col-span-1 space-y-6">
          {/* API Key Management */}
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-500" />
              Manajemen API Key
            </h2>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="password"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Masukkan Gemini API Key..."
                  className="flex-1 p-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <button 
                  onClick={addApiKey}
                  className="p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {apiKeys.map((key, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg border text-xs transition-all",
                      activeKeyIndex === idx ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        activeKeyIndex === idx ? "bg-green-500 animate-pulse" : "bg-slate-300"
                      )} />
                      <span className="truncate font-mono">
                        {key.substring(0, 8)}...{key.substring(key.length - 4)}
                      </span>
                    </div>
                    <button 
                      onClick={() => removeApiKey(idx)}
                      className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {apiKeys.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg space-y-3">
                    <p className="text-[11px] text-amber-800 font-bold flex items-center gap-1">
                      <Settings2 className="w-3 h-3" />
                      Cara Mendapatkan API Key:
                    </p>
                    <ol className="text-[10px] text-amber-700 space-y-1.5 list-decimal ml-4 leading-relaxed">
                      <li>Buka <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-amber-900">Google AI Studio</a></li>
                      <li>Login dengan akun Google Anda.</li>
                      <li>Klik tombol <strong>"Create API key"</strong>.</li>
                      <li>Pilih project (atau buat baru) dan klik <strong>"Create API key in existing project"</strong>.</li>
                      <li>Salin key tersebut dan tempelkan di kolom input di atas.</li>
                    </ol>
                    <p className="text-[9px] text-amber-600 italic">
                      *Sistem akan otomatis merotasi key jika salah satu mencapai limit atau expired.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Settings2 className="w-3 h-3" />
                      Butuh key tambahan? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700">Klik di sini</a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Database Kunci Jawaban
            </h2>
            
            <div 
              {...getPdfRootProps()} 
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                isPdfDragActive ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-400"
              )}
            >
              <input {...getPdfInputProps()} />
              <FileUp className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-600">
                Klik atau tarik file PDF ke sini
              </p>
            </div>

            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {pdfFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-xs truncate font-medium">{file.name}</span>
                  </div>
                  <button 
                    onClick={() => removePdf(idx)}
                    className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {pdfFiles.length === 0 && (
                <p className="text-xs text-center text-slate-400 py-4 italic">
                  Belum ada file diunggah
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Main Content: Question Input & Results */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'checker' ? (
            <>
              <section className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Daftar Pertanyaan</h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={addTextQuestion}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Tambah Teks
                    </button>
                    <div {...getImageRootProps()}>
                      <input {...getImageInputProps()} />
                      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors">
                        <ImageIcon className="w-3 h-3" />
                        Tambah Screenshot
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="relative group p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <button 
                        onClick={() => removeQuestion(q.id)}
                        className="absolute -top-2 -right-2 p-1.5 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-xs font-bold text-slate-400">
                          {idx + 1}
                        </div>
                        
                        <div className="flex-1">
                          {q.type === 'text' ? (
                            <textarea 
                              value={q.content}
                              onChange={(e) => updateQuestionContent(q.id, e.target.value)}
                              placeholder="Ketik pertanyaan di sini..."
                              className="w-full p-3 bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm min-h-[100px]"
                              rows={4}
                            />
                          ) : (
                            <div className="flex items-center gap-4">
                              <img 
                                src={`data:${q.mimeType};base64,${q.content}`} 
                                alt="Screenshot" 
                                className="h-16 rounded-lg object-cover border border-slate-200"
                                referrerPolicy="no-referrer"
                              />
                              <div className="overflow-hidden">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Screenshot</p>
                                <p className="text-sm font-medium text-slate-700 truncate">{q.name}</p>
                              </div>
                            </div>
                          )}

                          {q.loading && (
                            <div className="mt-2 flex items-center gap-2 text-blue-500">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span className="text-xs font-medium">Menganalisis...</span>
                            </div>
                          )}

                          {q.error && (
                            <div className="mt-2 flex items-center gap-2 text-red-500">
                              <AlertCircle className="w-3 h-3" />
                              <span className="text-xs font-medium">{q.error}</span>
                            </div>
                          )}

                          {q.result && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-green-100 animate-in fade-in slide-in-from-top-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Check className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-bold text-blue-600">{q.result.answer}</span>
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed italic">
                                {q.result.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {questions.length === 0 && (
                    <div 
                      {...getImageRootProps()}
                      className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer"
                    >
                      <input {...getImageInputProps()} />
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <FileUp className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600">Belum ada pertanyaan</p>
                      <p className="text-xs text-slate-400 mt-1">Klik untuk upload screenshot atau gunakan tombol di atas</p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleFindAnswer}
                  disabled={loading || questions.length === 0}
                  className={cn(
                    "w-full py-3 px-6 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200",
                    loading || questions.length === 0 ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sedang Memproses Semua Pertanyaan...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Cek Semua Jawaban
                    </>
                  )}
                </button>

                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="glass-card p-8 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Generator Soal Baru</h2>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                  AI akan menganalisis SEMUA dokumen PDF Anda dan membuat soal latihan pilihan ganda secara otomatis.
                </p>

                <div className="max-w-xs mx-auto mb-8">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-left">
                    Jumlah Pertanyaan
                  </label>
                  <select 
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium"
                  >
                    <option value={5}>5 Pertanyaan</option>
                    <option value={10}>10 Pertanyaan</option>
                    <option value={25}>25 Pertanyaan</option>
                    <option value={50}>50 Pertanyaan</option>
                    <option value={100}>100 Pertanyaan</option>
                  </select>
                </div>

                <button 
                  onClick={handleGenerateQuestions}
                  disabled={loading || pdfFiles.length === 0}
                  className={cn(
                    "w-full py-4 px-6 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-200",
                    loading || pdfFiles.length === 0 ? "bg-purple-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 active:scale-[0.98]"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sedang Membuat {questionCount} Soal...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      Buat {questionCount} Soal Latihan
                    </>
                  )}
                </button>

                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 text-left">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}
              </section>

              {generatedQuestions.length > 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      Daftar Soal Latihan ({generatedQuestions.length})
                    </h2>
                    <button 
                      onClick={() => setGeneratedQuestions([])}
                      className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                    >
                      Hapus Semua
                    </button>
                  </div>
                  {generatedQuestions.map((q, idx) => (
                    <section key={idx} className="glass-card p-6 overflow-hidden">
                      <div className="flex gap-4">
                        <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-500 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="space-y-4 w-full">
                          <p className="text-lg font-medium text-slate-800">{q.question}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(q.options).map(([key, value]) => (
                              <div 
                                key={key}
                                className={cn(
                                  "p-3 rounded-lg border text-sm transition-all",
                                  q.correctAnswer.toLowerCase() === key.toLowerCase() 
                                    ? "bg-green-50 border-green-200 text-green-800 font-medium" 
                                    : "bg-slate-50 border-slate-100 text-slate-600"
                                )}
                              >
                                <span className="uppercase font-bold mr-2">{key}.</span>
                                {value}
                              </div>
                            ))}
                          </div>
                          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">Penjelasan</h4>
                            <p className="text-sm text-slate-600 italic">
                              {q.explanation}
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

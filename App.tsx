
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Presentation, Slide, SlideLayout, PresentationStyle, ColorPalette } from './types';
import { generatePresentation, generateSlideImage, editSlideImage, regenerateSlideContent } from './services/geminiService';
import SlideRenderer from './components/SlideRenderer';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const STYLE_OPTIONS: PresentationStyle[] = ['Professional', 'Creative', 'Minimalist', 'Futuristic', 'Organic'];

const PALETTES: ColorPalette[] = [
  { name: 'Deep Sea', primary: '#1e3a8a', secondary: '#1e40af', accent: '#3b82f6', bg: '#f8fafc', text: '#0f172a' },
  { name: 'Sunset', primary: '#9a3412', secondary: '#c2410c', accent: '#f97316', bg: '#fffafb', text: '#431407' },
  { name: 'Forest', primary: '#064e3b', secondary: '#065f46', accent: '#10b981', bg: '#f0fdf4', text: '#022c22' },
  { name: 'Midnight', primary: '#111827', secondary: '#1f2937', accent: '#6366f1', bg: '#030712', text: '#f9fafb' },
  { name: 'Soft Rose', primary: '#881337', secondary: '#9f1239', accent: '#fb7185', bg: '#fff1f2', text: '#4c0519' },
];

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<PresentationStyle>('Professional');
  const [selectedPalette, setSelectedPalette] = useState<ColorPalette>(PALETTES[0]);
  const [slideCount, setSlideCount] = useState(8);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isRegeneratingContent, setIsRegeneratingContent] = useState(false);
  const [isAddingSlide, setIsAddingSlide] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [regenerationPrompt, setRegenerationPrompt] = useState('');
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [exportProgress, setExportProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local editing state
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editContentText, setEditContentText] = useState('');
  const [isModified, setIsModified] = useState(false);

  // New Slide Form State
  const [newSlideTitle, setNewSlideTitle] = useState('');
  const [newSlideLayout, setNewSlideLayout] = useState<SlideLayout>('content');

  // Sync edit state when current slide changes
  useEffect(() => {
    if (presentation && presentation.slides[currentSlideIndex]) {
      const slide = presentation.slides[currentSlideIndex];
      setEditTitle(slide.title);
      setEditSubtitle(slide.subtitle || '');
      setEditContentText(slide.content.join('\n'));
      setIsModified(false);
    }
  }, [currentSlideIndex, presentation]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setLoadingStatus('Architecting presentation structure...');
    try {
      const newPres = await generatePresentation(topic, selectedStyle, selectedPalette, slideCount);
      setPresentation(newPres);
      setCurrentSlideIndex(0);
      
      setLoadingStatus('Generating custom AI visuals...');
      const slidesWithImages = [...newPres.slides];
      
      for (let i = 0; i < slidesWithImages.length; i++) {
        const slide = slidesWithImages[i];
        if (slide.layout.includes('image') && slide.imagePrompt) {
          const imageUrl = await generateSlideImage(slide.imagePrompt);
          if (imageUrl) {
            slidesWithImages[i] = { ...slide, imageUrl };
            setPresentation(prev => prev ? { ...prev, slides: [...slidesWithImages] } : null);
          }
        }
      }
    } catch (error) {
      console.error("Generation failed", error);
      alert("Something went wrong during generation. Please check your API key.");
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const handleSaveSlideContent = () => {
    if (!presentation) return;
    const updatedSlides = [...presentation.slides];
    const currentSlide = updatedSlides[currentSlideIndex];
    
    updatedSlides[currentSlideIndex] = {
      ...currentSlide,
      title: editTitle,
      subtitle: editSubtitle || undefined,
      content: editContentText.split('\n').filter(line => line.trim() !== '')
    };

    setPresentation({ ...presentation, slides: updatedSlides });
    setIsModified(false);
  };

  const handleRegenerateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presentation || !regenerationPrompt.trim() || isRegeneratingContent) return;

    setIsRegeneratingContent(true);
    try {
      const currentSlide = presentation.slides[currentSlideIndex];
      const result = await regenerateSlideContent(currentSlide, regenerationPrompt, presentation.theme);
      
      if (result) {
        setEditTitle(result.title || editTitle);
        setEditSubtitle(result.subtitle || editSubtitle);
        setEditContentText(result.content?.join('\n') || editContentText);
        setIsModified(true);
        setRegenerationPrompt('');
      }
    } catch (err) {
      console.error("Regeneration failed", err);
      alert("AI content refinement failed. Please try again.");
    } finally {
      setIsRegeneratingContent(false);
    }
  };

  const handleExportPDF = async () => {
    if (!presentation) return;
    setIsExportMenuOpen(false);
    setIsExporting(true);
    setExportProgress(0);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [1280, 720]
    });

    try {
      const totalSlides = presentation.slides.length;
      for (let i = 0; i < totalSlides; i++) {
        setCurrentSlideIndex(i);
        setExportProgress(Math.round((i / totalSlides) * 100));
        await new Promise(resolve => setTimeout(resolve, 800)); // Increased wait for images

        const slideElement = document.querySelector('.main-slide-container');
        if (slideElement) {
          const canvas = await html2canvas(slideElement as HTMLElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, 0, 1280, 720);
        }
      }
      
      setExportProgress(100);
      pdf.save(`${presentation.title.replace(/\s+/g, '_')}_Presentation.pdf`);
    } catch (err) {
      console.error("PDF Export failed", err);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportImage = async () => {
    if (!presentation) return;
    setIsExportMenuOpen(false);
    const slideElement = document.querySelector('.main-slide-container');
    if (!slideElement) return;

    setIsExporting(true);
    setExportProgress(50);
    try {
      const canvas = await html2canvas(slideElement as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `Slide_${currentSlideIndex + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Image export failed", err);
    } finally {
      setIsExporting(false);
      setExportProgress(100);
    }
  };

  const handleToggleImage = async () => {
    if (!presentation) return;
    const currentSlide = presentation.slides[currentSlideIndex];
    const updatedSlides = [...presentation.slides];
    
    if (currentSlide.imageUrl) {
      updatedSlides[currentSlideIndex] = {
        ...currentSlide,
        imageUrl: undefined,
        imagePrompt: undefined,
        layout: 'content'
      };
      setPresentation({ ...presentation, slides: updatedSlides });
    } else {
      setIsEditingImage(true);
      try {
        const prompt = currentSlide.imagePrompt || `A professional visual representation of: ${currentSlide.title}. ${currentSlide.content.join(' ')}`;
        const newImageUrl = await generateSlideImage(prompt);
        if (newImageUrl) {
          updatedSlides[currentSlideIndex] = {
            ...currentSlide,
            imageUrl: newImageUrl,
            imagePrompt: prompt,
            layout: 'image-right'
          };
          setPresentation({ ...presentation, slides: updatedSlides });
        }
      } catch (error) {
        console.error("Failed to generate image", error);
      } finally {
        setIsEditingImage(false);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !presentation) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const updatedSlides = [...presentation.slides];
      const currentSlide = updatedSlides[currentSlideIndex];
      
      updatedSlides[currentSlideIndex] = {
        ...currentSlide,
        imageUrl: base64,
        layout: currentSlide.layout.includes('image') ? currentSlide.layout : 'image-right'
      };
      
      setPresentation({ ...presentation, slides: updatedSlides });
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = '';
  };

  const handleEditImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presentation || !editPrompt.trim()) return;

    const currentSlide = presentation.slides[currentSlideIndex];
    if (!currentSlide.imageUrl) return;

    setIsEditingImage(true);
    try {
      const newImageUrl = await editSlideImage(currentSlide.imageUrl, editPrompt);
      if (newImageUrl) {
        const updatedSlides = [...presentation.slides];
        updatedSlides[currentSlideIndex] = { ...currentSlide, imageUrl: newImageUrl };
        setPresentation({ ...presentation, slides: updatedSlides });
        setEditPrompt('');
      }
    } catch (error) {
      console.error("Image edit failed", error);
    } finally {
      setIsEditingImage(false);
    }
  };

  const handleAddSlide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presentation) return;

    const newSlide: Slide = {
      id: crypto.randomUUID(),
      title: newSlideTitle || "New Slide",
      content: ["Start typing your content here..."],
      layout: newSlideLayout,
      notes: "Custom added slide."
    };

    const updatedSlides = [...presentation.slides];
    updatedSlides.splice(currentSlideIndex + 1, 0, newSlide);
    
    setPresentation({ ...presentation, slides: updatedSlides });
    setCurrentSlideIndex(currentSlideIndex + 1);
    setIsAddingSlide(false);
    setNewSlideTitle('');
  };

  const nextSlide = () => {
    if (presentation && currentSlideIndex < presentation.slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  const currentSlide = presentation?.slides[currentSlideIndex];
  const isImageSlide = !!currentSlide?.imageUrl;

  if (isFullScreen && presentation) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50 cursor-none">
        <div className="w-full max-h-full aspect-video animate-slide-in" key={currentSlideIndex}>
          <SlideRenderer slide={presentation.slides[currentSlideIndex]} />
        </div>
        <button 
          onClick={() => setIsFullScreen(false)}
          className="fixed top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full transition-all cursor-default"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="14" x="3" y="5" rx="2" ry="2"/><path d="M7 10h10M7 14h10"/></svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Presentation Architect</h1>
        </div>

        {presentation && (
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-500 font-medium">
              Slide {currentSlideIndex + 1} of {presentation.slides.length}
            </span>
            
            <div className="relative">
              <button 
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 transition-colors flex items-center space-x-2 font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                <span>Export</span>
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-1 animate-slide-in">
                  <button 
                    onClick={handleExportPDF}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center space-x-3"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>Download PDF</span>
                  </button>
                  <button 
                    onClick={handleExportImage}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center space-x-3"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <span>Export Current Slide</span>
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsFullScreen(true)}
              className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md hover:bg-indigo-100 transition-colors flex items-center space-x-2 font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              <span>Present</span>
            </button>
            <button 
              onClick={() => setPresentation(null)}
              className="text-slate-500 hover:text-slate-800 transition-colors font-medium text-sm"
            >
              New Project
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {!presentation ? (
          <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
            <div className="max-w-4xl w-full text-center space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 py-12">
              <div>
                <h2 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
                  Transform ideas into <span className="text-indigo-600 underline decoration-indigo-200 decoration-8 underline-offset-4">stunning</span> presentations.
                </h2>
                <p className="text-xl text-slate-600">
                  Select your style, choose a palette, and let Gemini 3 build your deck.
                </p>
              </div>

              <div className="bg-white p-10 rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 text-left space-y-8">
                {/* Topic Input */}
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest">Presentation Topic</label>
                  <input
                    type="text"
                    placeholder="E.g. The history of solar exploration in the 21st century"
                    className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-inner bg-slate-50/50"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   {/* Style Selection */}
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest">Visual Style</label>
                    <div className="flex flex-wrap gap-2">
                      {STYLE_OPTIONS.map(style => (
                        <button
                          key={style}
                          onClick={() => setSelectedStyle(style)}
                          className={`px-5 py-3 rounded-xl border-2 transition-all font-semibold ${
                            selectedStyle === style 
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100' 
                              : 'border-slate-100 hover:border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Palette Selection */}
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest">Color Palette</label>
                    <div className="flex flex-wrap gap-3">
                      {PALETTES.map(palette => (
                        <button
                          key={palette.name}
                          onClick={() => setSelectedPalette(palette)}
                          className={`flex items-center space-x-2 px-4 py-3 rounded-xl border-2 transition-all ${
                            selectedPalette.name === palette.name 
                              ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' 
                              : 'border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex -space-x-1">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: palette.primary }}></div>
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: palette.accent }}></div>
                          </div>
                          <span className={`text-sm font-semibold ${selectedPalette.name === palette.name ? 'text-indigo-700' : 'text-slate-500'}`}>
                            {palette.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Slide Count & Submit */}
                <div className="flex flex-col md:flex-row items-center justify-between pt-6 border-t border-slate-50 gap-6">
                  <div className="flex items-center space-x-6 w-full md:w-auto">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Slide Count</label>
                    <input 
                      type="range" 
                      min="5" 
                      max="15" 
                      value={slideCount} 
                      onChange={(e) => setSlideCount(parseInt(e.target.value))}
                      className="flex-1 md:w-48 accent-indigo-600"
                    />
                    <span className="bg-indigo-600 text-white px-3 py-1 rounded-full font-bold text-sm min-w-[2.5rem] text-center">
                      {slideCount}
                    </span>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isLoading || !topic.trim()}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-indigo-500/30 flex items-center justify-center space-x-3 transform active:scale-95"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Architecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Build Presentation</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {isLoading && (
                <div className="flex flex-col items-center space-y-4 pt-4">
                   <div className="text-indigo-600 font-bold text-lg animate-pulse">
                    {loadingStatus}
                   </div>
                   <div className="w-80 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 animate-[loading_2s_infinite]"></div>
                   </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
              <div className="p-4 flex items-center justify-between">
                <span className="font-semibold text-slate-400 text-xs uppercase tracking-wider">Slides</span>
                <button 
                  onClick={() => setIsAddingSlide(true)}
                  className="p-1 hover:bg-indigo-100 text-indigo-600 rounded-md transition-colors"
                  title="Add Slide"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7v14"/></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-10">
                {presentation.slides.map((slide, idx) => (
                  <div key={slide.id} className="space-y-1">
                    <button
                      onClick={() => setCurrentSlideIndex(idx)}
                      className={`w-full text-left rounded-lg transition-all group relative ${
                        currentSlideIndex === idx 
                          ? 'ring-4 ring-indigo-500 ring-offset-2 scale-[1.02] opacity-100' 
                          : 'hover:scale-[1.02] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="pointer-events-none">
                         <SlideRenderer slide={slide} isThumbnail={true} className="rounded-md" />
                      </div>
                      <div className="absolute top-2 left-2 bg-slate-900/50 text-white w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold backdrop-blur-sm">
                        {idx + 1}
                      </div>
                    </button>
                    <div className="text-[10px] px-1 font-medium text-slate-400 truncate uppercase">
                      {slide.title}
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <div className="flex-1 flex flex-col bg-slate-100 p-8 overflow-y-auto items-center">
              <div className="max-w-5xl w-full flex flex-col space-y-8">
                <div className="relative group main-slide-container">
                  <div key={currentSlideIndex} className="animate-slide-in">
                    <SlideRenderer slide={presentation.slides[currentSlideIndex]} />
                  </div>
                  
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none group-hover:pointer-events-auto">
                     <button 
                      onClick={prevSlide}
                      disabled={currentSlideIndex === 0}
                      className="ml-4 p-3 bg-white/90 shadow-lg rounded-full text-slate-800 disabled:opacity-30 hover:bg-white transition-all transform hover:scale-110 opacity-0 group-hover:opacity-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                  </div>
                  <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none group-hover:pointer-events-auto">
                    <button 
                      onClick={nextSlide}
                      disabled={currentSlideIndex === presentation.slides.length - 1}
                      className="mr-4 p-3 bg-white/90 shadow-lg rounded-full text-slate-800 disabled:opacity-30 hover:bg-white transition-all transform hover:scale-110 opacity-0 group-hover:opacity-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-200">
                      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                          <span>Edit Slide Content</span>
                        </h3>
                        <div className="flex items-center space-x-3">
                          <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 uppercase">
                            Layout: {currentSlide?.layout}
                          </span>
                          {isModified && (
                            <button 
                              onClick={handleSaveSlideContent}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-xs font-bold transition-all shadow-md flex items-center space-x-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                              <span>Save Changes</span>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                         {/* AI Refinement Section */}
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-2">
                           <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center space-x-2">
                             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                             <span>AI Refine Slide</span>
                           </label>
                           <form onSubmit={handleRegenerateContent} className="flex gap-2">
                             <input 
                              type="text"
                              value={regenerationPrompt}
                              onChange={(e) => setRegenerationPrompt(e.target.value)}
                              placeholder="E.g. Make it more professional, add statistics, or translate to French..."
                              className="flex-1 px-4 py-2 text-sm rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-300 outline-none transition-all"
                              disabled={isRegeneratingContent}
                             />
                             <button 
                               type="submit"
                               disabled={!regenerationPrompt.trim() || isRegeneratingContent}
                               className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center space-x-2"
                             >
                               {isRegeneratingContent ? (
                                 <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                               ) : "Refine"}
                             </button>
                           </form>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Title</label>
                          <input 
                            type="text"
                            value={editTitle}
                            onChange={(e) => { setEditTitle(e.target.value); setIsModified(true); }}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                          />
                        </div>

                        {(currentSlide?.layout === 'title' || editSubtitle) && (
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Subtitle</label>
                            <input 
                              type="text"
                              value={editSubtitle}
                              onChange={(e) => { setEditSubtitle(e.target.value); setIsModified(true); }}
                              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bullet Points (One per line)</label>
                          <textarea 
                            rows={6}
                            value={editContentText}
                            onChange={(e) => { setEditContentText(e.target.value); setIsModified(true); }}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-mono"
                            placeholder="Enter bullet points here..."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-200">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                          <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-2-2-5 5V3H7v8L2 8v11h19V8Z"/><path d="M7 21v-4"/><path d="M11 21v-4"/><path d="M15 21v-4"/></svg>
                            <span>Slide Visuals</span>
                          </h3>
                          <div className="flex items-center space-x-2">
                             <input 
                              type="file" 
                              ref={fileInputRef} 
                              className="hidden" 
                              accept="image/*"
                              onChange={handleImageUpload}
                             />
                             <button 
                              onClick={() => fileInputRef.current?.click()}
                              className="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 bg-slate-100 text-slate-600 hover:bg-slate-200"
                             >
                               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                               <span>Upload</span>
                             </button>

                             <button 
                              onClick={handleToggleImage}
                              disabled={isEditingImage}
                              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                                isImageSlide 
                                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {isEditingImage ? (
                                 <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : isImageSlide ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7v14"/></svg>
                              )}
                              <span>{isImageSlide ? 'Remove Image' : 'AI Generate'}</span>
                            </button>
                          </div>
                        </div>
                        
                        {isImageSlide ? (
                          <div className="space-y-6">
                            <form onSubmit={handleEditImage} className="flex space-x-2">
                                <input 
                                  type="text" 
                                  placeholder="E.g. 'Add a sunset filter', 'Make it neon style'"
                                  className="flex-1 px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                                  value={editPrompt}
                                  onChange={(e) => setEditPrompt(e.target.value)}
                                  disabled={isEditingImage}
                                />
                                <button 
                                  type="submit" 
                                  disabled={isEditingImage || !editPrompt.trim()}
                                  className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center space-x-2 whitespace-nowrap"
                                >
                                  {isEditingImage ? 'Editing...' : 'Apply Edit'}
                                </button>
                            </form>
                            <div className="flex gap-2">
                               {(['image-left', 'image-right'] as SlideLayout[]).map(l => (
                                 <button 
                                  key={l}
                                  onClick={() => setPresentation(p => p ? { ...p, slides: p.slides.map((s, idx) => idx === currentSlideIndex ? { ...s, layout: l } : s) } : null)}
                                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${currentSlide?.layout === l ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                 >
                                   {l.replace('-', ' ')}
                                 </button>
                               ))}
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                            <p className="text-slate-400 text-sm">No image attached. Upload your own or AI generate one.</p>
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 overflow-hidden">
                       <h3 className="text-lg font-bold mb-4 flex items-center space-x-2 text-slate-800">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                        <span>Project Spec</span>
                      </h3>
                      <div className="space-y-4 text-slate-600 text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                           <span className="font-semibold text-slate-400">Style</span>
                           <span className="text-indigo-600 font-bold">{presentation.theme}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                           <span className="font-semibold text-slate-400">Palette</span>
                           <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: presentation.palette.primary }}></div>
                              <span className="text-indigo-600 font-bold">{presentation.palette.name}</span>
                           </div>
                        </div>
                        {currentSlide?.imagePrompt && (
                          <div className="pt-2">
                            <p className="font-semibold text-slate-400 mb-1">Visual Intent</p>
                            <p className="italic text-xs leading-relaxed text-slate-500 line-clamp-4">"{currentSlide.imagePrompt}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isAddingSlide && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-in">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Add New Slide</h3>
                <button onClick={() => setIsAddingSlide(false)} className="text-slate-400 hover:text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <form onSubmit={handleAddSlide} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Slide Title</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    placeholder="E.g. Market Strategy"
                    value={newSlideTitle}
                    onChange={(e) => setNewSlideTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-4">Select Layout</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['title', 'content', 'split', 'quote', 'image-left', 'image-right'] as SlideLayout[]).map(layout => (
                      <button
                        key={layout}
                        type="button"
                        onClick={() => setNewSlideLayout(layout)}
                        className={`p-3 rounded-xl border-2 text-xs font-bold uppercase transition-all ${
                          newSlideLayout === layout 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' 
                            : 'border-slate-100 hover:border-slate-200 text-slate-400'
                        }`}
                      >
                        {layout.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02]"
                  >
                    Add Slide
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isExporting && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-sm w-full text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    className="text-slate-100"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="40"
                    cx="48"
                    cy="48"
                  />
                  <circle
                    className="text-indigo-600 transition-all duration-300 ease-out"
                    strokeWidth="8"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * exportProgress) / 100}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="40"
                    cx="48"
                    cy="48"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-slate-800">
                  {exportProgress}%
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Exporting Deck...</h3>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default App;


import React, { useState } from 'react';
import { Slide } from '../types';
// @ts-ignore
import ReactKatex from 'react-katex';

interface SlideRendererProps {
  slide: Slide;
  className?: string;
  isThumbnail?: boolean;
}

// Safely extract components from the module which may be a default or named export bundle
const InlineMath = (ReactKatex as any).InlineMath || ReactKatex;
const BlockMath = (ReactKatex as any).BlockMath || ReactKatex;

/**
 * SmartText component that parses strings and renders LaTeX if present.
 */
const SmartText: React.FC<{ text: string, block?: boolean }> = ({ text, block = false }) => {
  if (!text) return null;

  // Handle block math if it's the whole string
  if (text.startsWith('$$') && text.endsWith('$$')) {
    const math = text.slice(2, -2);
    return (
      <div className="overflow-x-auto max-w-full my-2 custom-scrollbar">
        <BlockMath math={math} />
      </div>
    );
  }

  // Handle mixed text and inline math
  const parts = text.split(/(\$\$.*?\$\$|\$.*?\$)/g);
  
  return (
    <span className="break-words whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2);
          return (
            <div key={i} className="overflow-x-auto max-w-full my-2 custom-scrollbar">
              <BlockMath math={math} />
            </div>
          );
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          return <InlineMath key={i} math={math} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

const SlideRenderer: React.FC<SlideRendererProps> = ({ slide, className = "", isThumbnail = false }) => {
  const [imgLoaded, setImgLoaded] = useState(false);

  /**
   * Calculates a dynamic font size based on the amount of text content and line breaks.
   * Ensures content stays within the 16:9 box.
   */
  const getDynamicFontSize = (content: string[], baseSize: number, minSize: number) => {
    if (isThumbnail) return `${baseSize * 0.4}px`;
    
    const textLength = content.join('').length;
    const lineCount = content.length;
    
    // Weighted factor: characters + lines
    const complexity = textLength + (lineCount * 40);
    
    // Thresholds
    const easyThreshold = 300;
    const hardLimit = 1200;
    
    if (complexity <= easyThreshold) return `${baseSize}px`;
    
    const scale = Math.max(
      minSize / baseSize, 
      1 - ((complexity - easyThreshold) / (hardLimit - easyThreshold)) * 0.6
    );
    
    return `${Math.floor(baseSize * scale)}px`;
  };

  const renderLayout = () => {
    switch (slide.layout) {
      case 'title':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 md:p-12 bg-gradient-to-br from-indigo-900 to-slate-900 text-white overflow-hidden">
            <h1 
              className="font-bold mb-4 md:mb-6 tracking-tight leading-tight max-w-full break-words"
              style={{ fontSize: getDynamicFontSize([slide.title], isThumbnail ? 24 : 64, isThumbnail ? 12 : 32) }}
            >
              <SmartText text={slide.title} />
            </h1>
            {slide.subtitle && (
              <p 
                className="text-indigo-200 font-light max-w-full opacity-90"
                style={{ fontSize: getDynamicFontSize([slide.subtitle], isThumbnail ? 12 : 28, isThumbnail ? 8 : 16) }}
              >
                <SmartText text={slide.subtitle} />
              </p>
            )}
          </div>
        );
      
      case 'quote':
        return (
          <div className="flex flex-col items-center justify-center h-full p-10 md:p-20 bg-slate-50 italic text-center overflow-hidden">
            <div className="relative max-w-full">
              {!isThumbnail && <span className="absolute -top-12 -left-12 text-9xl text-slate-200 font-serif opacity-50 select-none">"</span>}
              <p 
                className="text-slate-700 font-medium relative z-10 break-words leading-relaxed"
                style={{ fontSize: getDynamicFontSize(slide.content, isThumbnail ? 14 : 40, isThumbnail ? 10 : 20) }}
              >
                <SmartText text={slide.content[0]} />
              </p>
              <div 
                className={`mt-6 md:mt-8 text-indigo-600 font-bold not-italic border-t border-slate-200 pt-4`}
                style={{ fontSize: isThumbnail ? '10px' : '20px' }}
              >
                — <SmartText text={slide.title} />
              </div>
            </div>
          </div>
        );

      case 'image-left':
      case 'image-right':
        const isLeft = slide.layout === 'image-left';
        return (
          <div className={`flex h-full bg-white ${isLeft ? 'flex-row' : 'flex-row-reverse'} overflow-hidden`}>
            <div className="w-1/2 h-full overflow-hidden bg-slate-50 flex items-center justify-center relative">
              {slide.imageUrl ? (
                <>
                  {!imgLoaded && (
                    <div className="absolute inset-0 bg-slate-100 animate-pulse flex items-center justify-center text-slate-400">
                      Loading...
                    </div>
                  )}
                  <img 
                    src={slide.imageUrl} 
                    alt={slide.title} 
                    className={`w-full h-full object-contain transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`} 
                    onLoad={() => setImgLoaded(true)}
                  />
                </>
              ) : (
                <div className="text-slate-400 text-sm animate-pulse flex flex-col items-center">
                   <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                   <span>Visual Aid Pending...</span>
                </div>
              )}
            </div>
            <div className="w-1/2 p-6 md:p-10 flex flex-col justify-center overflow-hidden">
              <h2 className={`${isThumbnail ? 'text-sm' : 'text-3xl'} font-bold mb-4 text-slate-800 leading-tight border-b border-slate-100 pb-2`}>
                <SmartText text={slide.title} />
              </h2>
              <ul 
                className="space-y-3 text-slate-600 overflow-hidden" 
                style={{ fontSize: getDynamicFontSize(slide.content, isThumbnail ? 10 : 20, isThumbnail ? 8 : 12) }}
              >
                {slide.content.map((item, i) => (
                  <li key={i} className="flex items-start">
                    <span className="mr-2 text-indigo-500 flex-shrink-0 mt-1.5">•</span>
                    <SmartText text={item} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );

      case 'split':
        const leftContent = slide.content.slice(0, Math.ceil(slide.content.length / 2));
        const rightContent = slide.content.slice(Math.ceil(slide.content.length / 2));
        const splitFontSize = getDynamicFontSize(slide.content, isThumbnail ? 9 : 18, isThumbnail ? 7 : 12);

        return (
          <div className="flex flex-col h-full bg-white overflow-hidden">
            <div className="p-6 md:p-8 border-b border-slate-100 flex-shrink-0">
              <h2 className={`${isThumbnail ? 'text-sm' : 'text-3xl'} font-bold text-slate-800 tracking-tight`}>
                <SmartText text={slide.title} />
              </h2>
            </div>
            <div className="flex flex-1 min-h-0">
              <div className="w-1/2 p-6 md:p-8 border-r border-slate-100 overflow-hidden">
                <ul className="space-y-3 text-slate-600" style={{ fontSize: splitFontSize }}>
                  {leftContent.map((item, i) => (
                    <li key={i} className="flex items-start">
                      <span className="mr-2 text-indigo-500 flex-shrink-0 mt-1.5">•</span>
                      <SmartText text={item} />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="w-1/2 p-6 md:p-8 overflow-hidden">
                <ul className="space-y-3 text-slate-600" style={{ fontSize: splitFontSize }}>
                  {rightContent.map((item, i) => (
                    <li key={i} className="flex items-start">
                      <span className="mr-2 text-indigo-500 flex-shrink-0 mt-1.5">•</span>
                      <SmartText text={item} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );

      case 'content':
      default:
        return (
          <div className="flex flex-col h-full bg-white p-8 md:p-14 overflow-hidden">
            <h2 
              className="font-bold mb-6 md:mb-10 text-slate-800 border-b-4 border-indigo-500 pb-3 inline-block self-start max-w-full"
              style={{ fontSize: isThumbnail ? '16px' : '44px' }}
            >
              <SmartText text={slide.title} />
            </h2>
            <div className="flex-1 min-h-0 overflow-hidden">
              <ul 
                className="space-y-4 md:space-y-6 text-slate-700 h-full overflow-hidden"
                style={{ fontSize: getDynamicFontSize(slide.content, isThumbnail ? 11 : 26, isThumbnail ? 9 : 14) }}
              >
                {slide.content.map((item, i) => (
                  <li key={i} className="flex items-start">
                    <span className="mr-3 md:mr-4 text-indigo-600 font-bold flex-shrink-0 mt-1">•</span>
                    <SmartText text={item} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`slide-aspect w-full overflow-hidden slide-shadow bg-white relative select-none ${className}`}>
      {renderLayout()}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default SlideRenderer;

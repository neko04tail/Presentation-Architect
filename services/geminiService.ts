
import { GoogleGenAI, Type } from "@google/genai";
import { Presentation, Slide, GroundingSource, PresentationStyle, ColorPalette } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generatePresentation = async (
  prompt: string, 
  style: PresentationStyle, 
  palette: ColorPalette, 
  slideCount: number
): Promise<Presentation> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create a professional presentation structure for the following topic: "${prompt}". 
    The presentation should have exactly ${slideCount} slides. 
    Design Style: ${style}. 
    Color Palette Inspiration: ${palette.name} (${palette.primary}, ${palette.secondary}, ${palette.accent}).
    
    Include a Title slide, Introduction, deep-dive content slides, and a strong Conclusion.
    Provide realistic, up-to-date and high-quality content for each slide. 
    Use your search tool to ensure facts, statistics, and recent developments are accurate.

    CRITICAL: For any mathematical formulas, scientific notation, or complex equations, ALWAYS use LaTeX format.
    - Use $...$ for inline math (e.g., $E=mc^2$).
    - Use $$...$$ for block/standalone equations (e.g., $$\\int_a^b f(x)dx$$).
    
    CRITICAL FOR VISUALS: For each slide, create a highly descriptive "imagePrompt". 
    To support academic and technical content, images MUST be conceptual infographics, scholarly diagrams, or data visualizations. 
    Avoid generic photography. Instead, describe:
    - Flowcharts or process diagrams for sequences.
    - Clean bar/line/pie charts (conceptual) for data trends.
    - Mind maps or hierarchy charts for structures.
    - Professional technical blueprints for engineering/science.
    
    Visual Style: strictly follow the "${style}" aesthetic using a clean, flat-design infographic style.
    Color Harmony: Use ${palette.name} color codes (${palette.primary}, ${palette.accent}) to color the chart elements and background in your descriptions.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                content: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                layout: { 
                  type: Type.STRING,
                  description: "One of: title, content, split, quote, image-left, image-right"
                },
                notes: { type: Type.STRING },
                imagePrompt: { type: Type.STRING, description: "Detailed description of a scholarly infographic, chart, or diagram that visually explains the slide's specific content." }
              },
              required: ["id", "title", "content", "layout", "imagePrompt"]
            }
          }
        },
        required: ["title", "slides"]
      }
    }
  });

  const data = JSON.parse(response.text || '{}');
  
  // Extract grounding sources
  const sources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web && chunk.web.uri) {
        sources.push({
          title: chunk.web.title || 'Source',
          uri: chunk.web.uri
        });
      }
    });
  }

  return {
    id: crypto.randomUUID(),
    title: data.title || "Untitled Presentation",
    slides: data.slides || [],
    theme: style,
    palette: palette,
    sources: sources.length > 0 ? sources : undefined
  };
};

export const regenerateSlideContent = async (
  currentSlide: Slide,
  userPrompt: string,
  style: PresentationStyle
): Promise<Partial<Slide>> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Refine the following slide content based on this instruction: "${userPrompt}".
    Keep the style consistent with: ${style}.
    
    Current Slide Context:
    Title: ${currentSlide.title}
    Subtitle: ${currentSlide.subtitle || 'N/A'}
    Current Content: ${currentSlide.content.join(', ')}

    REMINDER: Use LaTeX ($...$ for inline, $$...$$ for blocks) for all mathematical expressions.
    
    Also, update the "imagePrompt" to describe a new scholarly infographic or diagram that matches the updated text.
    
    Provide high-quality, professional updated content.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          content: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          imagePrompt: { type: Type.STRING }
        },
        required: ["title", "content"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateSlideImage = async (imagePrompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `Create a clean, professional scholarly infographic for a presentation slide. 
          The visual MUST BE COMPLETELY CONTAINED within the frame with no cut-offs or missing edges.
          Topic focus: "${imagePrompt}". 
          
          Style guidelines: 
          - FLAT DESIGN INFOGRAPHIC style with clear boundaries.
          - Use a white or very light neutral background.
          - NO realistic photography. Use geometric shapes, clean lines, and conceptual charts.
          - Full frame composition, centered, with adequate padding.
          - High resolution, vector-like clarity, professional iconography.
          - Minimal text in the image (placeholder-like labels only).` }
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};

export const editSlideImage = async (base64Image: string, editPrompt: string): Promise<string | null> => {
  try {
    const cleanBase64 = base64Image.split(',')[1] || base64Image;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/png',
            },
          },
          {
            text: `Modify this scholarly infographic to better reflect: ${editPrompt}. 
            Keep it as a clean, full-frame data visualization. Do NOT crop any elements.
            Maintain a minimalist, flat-design aesthetic.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error editing image:", error);
    return null;
  }
};

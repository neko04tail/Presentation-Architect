
export type SlideLayout = 'title' | 'content' | 'split' | 'quote' | 'image-left' | 'image-right';

export type PresentationStyle = 'Professional' | 'Creative' | 'Minimalist' | 'Futuristic' | 'Organic';

export interface ColorPalette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  text: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Slide {
  id: string;
  title: string;
  subtitle?: string;
  content: string[];
  layout: SlideLayout;
  notes?: string;
  imageUrl?: string;
  imagePrompt?: string;
}

export interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  theme: PresentationStyle;
  palette: ColorPalette;
  sources?: GroundingSource[];
}

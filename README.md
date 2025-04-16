# Semiote - Let the Symbols Speak

![Semiote Logo](/public/Semiote%20Name%20Logo%20Transparent.png)

## Overview
Semiote is a symbol analysis, interpretation, and creation platform designed to help users immerse themselves in the world of symbols.
It combines advanced computer vision technology with deep symbolic knowledge to help users detect symbols in images, understand their meanings across cultures and time periods, and create personal symbol libraries.

## Key Features
- **Discern**: Upload images and identify symbols within their contexts using AI-powered computer vision and a tailored knowledge base.
- **Decipher**: Understand the meaning behind symbols across cultures and time periods, by chatting with an AI Agent or with other users about symbols in contexts.
- **Define**: Create and archive your own symbolic interpretations in a personal library, which Semiote leverages in future interactions.

## Release Notes

### 0.1.0 - Omen: Initial Release
This initial release of Semiote introduces "Omen," my first prototype focusing on the core symbol recognition functionality:

- **Discern Tool**: Upload images via drag-and-drop or clipboard paste to identify symbols
- **AI-Powered Analysis**: Get detailed information about detected symbols including:
  - Name and category identification
  - Confidence, prominence, and authenticity scoring
  - Historical and cultural context via Wikipedia integration
  - Scholarly references via Google Books API
  - Visual complexity assessment and key visual elements identification
- **Brand and Design**: Clean, intuitive interface with the Semiote brand identity

Future releases will incorporate the Decipher and Define tools as development continues.

## Project Status
Semiote is currently in early development with its first prototype "Omen" that demonstrates the core functionality. Current development focuses include:

- **Mobile Responsiveness**: Updating the UI to work well across all devices, as it currently only performs optimally on higher desktop resolutions
- **Discern Tool Enhancements**: Actively improving the Discern tool with a focus on:
  - Performance optimization to make symbol recognition faster
  - Implementation of Retrieval Augmented Generation (RAG) to improve accuracy and context-awareness of symbol analysis
  - Enhanced filtering of detected symbols
- **Foundation Work**: Building the architecture to support upcoming Decipher and Define tools

## Advanced Computer Vision Integration
Semiote leverages state-of-the-art computer vision technology to analyze and detect symbols in images:

- **Symbol Segmentation**: Using [Segment Anything Model (SAM)](https://segment-anything.com/) technology for precise symbol detection within complex images
- **Visual Analysis**: AI and Knowledge powered assessment of symbol prominence, authenticity, and visual complexity 
- **Multi-modal Processing**: Integration of vision and language models for comprehensive symbol analysis

## AI and Data Integration
The application connects to multiple data sources to provide rich, contextual information:

- **OpenAI API**: [GPT-4o](https://openai.com/gpt-4o) powers the multimodal analysis of symbols
- **Wikipedia API**: [MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page) provides historical and cultural context
- **Google Books API**: [Google Books](https://developers.google.com/books) offers insights from scholarly sources
- more to be added soon!

## Tech Stack
- **Frontend**: Next.js with React
- **Styling**: Tailwind CSS 
- **UI Components**: Radix UI
- **AI Integration**: OpenAI GPT-4o for multimodal analysis

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key
- Google Books API key (optional)

### Installation
1. Clone the repository
   ```
   git clone https://github.com/yourusername/semiote.git
   cd semiote/code
   ```

2. Install dependencies
   ```
   npm install
   # or
   yarn install
   ```

3. Set up environment variables
   Create a `.env.local` file in the code directory with your API keys:
   ```
   OPENAI_API_KEY=your_api_key_here
   GOOGLE_BOOKS_API_KEY=your_google_books_api_key
   ```

4. Start the development server
   ```
   npm run dev
   # or
   yarn dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Usage
- Use the **Discern** tool to upload images and identify symbols using advanced computer vision (WIP)
- Use the **Decipher** tool to understand symbol meanings across cultures and time periods (Yet to be Implemented)
- Use the **Define** tool to create and archive your own symbolic interpretations (Yet to be Implemented)

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request if you have something you'd like to be added.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Brand
Semiote's brand essence is captured in the phrase "Let the Symbols Speak" with core values of Knowledge, Discovery, Archiving, and Interpretation.

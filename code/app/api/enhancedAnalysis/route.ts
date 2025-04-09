import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define proper types for multimodal messages
type TextContent = {
  type: 'text';
  text: string;
};

type ImageUrlContent = {
  type: 'image_url';
  image_url: {
    url: string;
  };
};

type MessageContent = TextContent | ImageUrlContent;

export async function POST(request: Request) {
  try {
    const { imageBase64, boundingBox } = await request.json();
    
    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }
    
    // Step 1: Initial identification to get the symbol name
    const initialPrompt = "What is this symbol? Give me just the name and category, nothing else.";
    
    const initialResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: initialPrompt 
            } as TextContent,
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
            } as ImageUrlContent
          ]
        }
      ],
      max_tokens: 50,
    });
    
    const symbolName = initialResponse.choices[0].message.content?.trim() || "Unknown symbol";
    
    // Step 2: Fetch Wikipedia data
    const wikiResponse = await fetch(new URL('/api/wikiLookup', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbolName })
    });
    
    const wikiData = await wikiResponse.json();
    
    // Step 3: Fetch Google Books data
    let booksData = "Unable to retrieve book information at this time.";
    let booksInfoAvailable = false;
    
    try {
      const booksResponse = await fetch(new URL('/api/googleBooksLookup', request.url).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbolName }),
      });
      
      if (booksResponse.ok) {
        const booksResult = await booksResponse.json();
        
        if (booksResult.success) {
          booksData = booksResult.bookData;
          booksInfoAvailable = true;
          
          // Check if we're using sample data with a note
          if (booksResult.note && booksResult.note.includes("sample data")) {
            console.log("Using sample book data:", booksResult.note);
          }
        } else {
          console.error("Google Books lookup returned failure:", booksResult);
        }
      } else {
        console.error(`Google Books lookup failed with status: ${booksResponse.status}`);
      }
    } catch (error) {
      console.error("Error during Google Books lookup:", error);
    }
    
    // Step 4: Enhanced analysis with all gathered data
    const enhancedPrompt = `
You are an expert in symbolic analysis with deep knowledge of historical, religious, and cultural symbols.

IDENTIFIED SYMBOL: ${symbolName}

RESEARCH FROM WIKIPEDIA:
${wikiData.success ? wikiData.info : "No Wikipedia information available"}

RESEARCH FROM BOOKS:
${booksData}

Analyze the symbol in this image${boundingBox ? `, focusing on the region: ${JSON.stringify(boundingBox)}` : ''}.
Use the research information provided above to enhance your analysis.

Format your response as JSON with the following structure:
{
  "name": string,
  "category": string, 
  "confidence": number (0-10, be precise to 0.1 decimal places, do not just use 0.5 increments),
  "prominence": number (0-10, be precise to 0.1 decimal places, measuring how visually important/central the symbol is in the image),
  "authenticity": number (0-10, be precise to 0.1 decimal places, do not just use 0.5 increments),
  "description": string (max 100 words),
  "overallScoreRationale": string (2-3 sentences explaining WHY this symbol scored as it did),
  "contextDescription": string (max 120 words about the symbol's use across cultures/traditions),
  "origin": string (brief, 1-3 words geographic origin),
  "timePeriod": string (brief time period, e.g., "3000 BCE - Present"),
  "primaryUse": string (brief, 1-3 words on main use),
  "culturalPrevalence": string (single word: "Limited", "Regional", "Widespread", or "Universal"),
  "visualComplexity": string (single word: "Low", "Medium", "High", or "Very High"),
  "keyElements": string (3-5 key visual elements separated by commas only),
  "thinkingProcess": [string] (5 analysis steps that explain how you identified and evaluated this symbol)
}

For the "prominence" score, consider:
- How central/important is the symbol within the image composition?
- How much space does it occupy relative to the whole image?
- Is it in the foreground, background, or center?
- How visually striking or emphasized is it compared to other elements?

Your analysis should be detailed yet concise, specific to this exact symbol, NOT generic descriptions. Focus on accuracy, precision, and brevity.
`;
    
    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: enhancedPrompt 
            } as TextContent,
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
            } as ImageUrlContent
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });
    
    // Check if we actually got content back
    if (!finalResponse.choices[0].message.content) {
      throw new Error("OpenAI returned empty response");
    }
    
    // Parse the JSON response
    const analysisResult = JSON.parse(finalResponse.choices[0].message.content);
    
    return NextResponse.json({
      success: true,
      initialIdentification: symbolName,
      wikiInfoAvailable: wikiData.success,
      booksInfoAvailable: booksInfoAvailable,
      analysis: analysisResult
    });
  } catch (error) {
    console.error('Error in enhanced analysis:', error);
    return NextResponse.json(
      { error: 'Failed to analyze symbol with enhanced data', details: (error as Error).message },
      { status: 500 }
    );
  }
} 
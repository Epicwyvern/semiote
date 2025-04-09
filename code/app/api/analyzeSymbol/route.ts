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
    // Parse the request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const { imageBase64, boundingBox } = body;
    
    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }
    
    // Construct the prompt for detailed symbol analysis
    const prompt = `
You are an expert in symbolic analysis with deep knowledge of historical, religious, and cultural symbols.

Analyze the symbol in this image${boundingBox ? `, focusing on the region: ${JSON.stringify(boundingBox)}` : ''}.

Provide a detailed analysis including the symbol's name, category, historical context, significance, and authenticity assessment.

Format your response as JSON with the following structure:
{
  "name": string,
  "category": string, 
  "confidence": number (0-10),
  "significance": number (0-10),
  "authenticity": number (0-10),
  "description": string,
  "origin": string,
  "timePeriod": string,
  "primaryUse": string,
  "culturalPrevalence": string,
  "visualComplexity": string,
  "keyElements": string,
  "thinkingProcess": [string] (5 analysis steps)
}
    `;
    
    // Make API call to GPT-4 Vision
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: prompt 
            } as TextContent,
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
            } as ImageUrlContent
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });
    
    // Check if we got a response
    if (!response.choices[0].message.content) {
      throw new Error("OpenAI returned empty response");
    }
    
    // Parse the JSON response
    const analysisResult = JSON.parse(response.choices[0].message.content);
    
    return NextResponse.json({
      success: true,
      analysis: analysisResult
    });
  } catch (error) {
    console.error('Error in symbol analysis:', error);
    return NextResponse.json(
      { error: 'Failed to analyze symbol', details: (error as Error).message },
      { status: 500 }
    );
  }
} 
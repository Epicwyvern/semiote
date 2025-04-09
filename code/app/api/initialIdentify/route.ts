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
    
    // Construct prompt based on whether we have a bounding box
    let prompt = 'What is this symbol? Provide only the name and category, nothing else.';
    
    if (boundingBox) {
      prompt = `What is the symbol in this region: ${JSON.stringify(boundingBox)}? Provide only the name and category, nothing else.`;
    }
    
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
      max_tokens: 50,
    });
    
    // Check if we got a response
    if (!response.choices[0].message.content) {
      throw new Error("OpenAI returned empty response");
    }
    
    const result = response.choices[0].message.content.trim();
    
    return NextResponse.json({
      success: true,
      name: result.split(',')[0] || result,  // Attempt to extract just the name
      fullResponse: result
    });
  } catch (error) {
    console.error('Error in initial symbol identification:', error);
    return NextResponse.json(
      { error: 'Failed to identify symbol', details: (error as Error).message },
      { status: 500 }
    );
  }
} 
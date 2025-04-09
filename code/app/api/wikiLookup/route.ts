import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { symbolName } = await request.json();
    
    if (!symbolName) {
      return NextResponse.json(
        { error: 'Symbol name is required' },
        { status: 400 }
      );
    }
    
    // Create a search query for the symbol
    const searchQuery = `${symbolName} symbol`;
    const encodedQuery = encodeURIComponent(searchQuery);
    
    // Query the Wikipedia API
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles=${encodedQuery}&redirects=1&origin=*`
    );
    
    if (!response.ok) {
      throw new Error('Wikipedia API request failed');
    }
    
    const data = await response.json();
    
    // Extract the page content
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    
    // Check if we got a valid page or a "no results" page
    if (pageId === '-1') {
      return NextResponse.json({
        success: false,
        info: "No Wikipedia information found for this symbol"
      });
    }
    
    const extract = pages[pageId].extract || "No detailed information available";
    
    return NextResponse.json({
      success: true,
      title: pages[pageId].title,
      info: extract,
      pageId: pageId
    });
  } catch (error) {
    console.error('Error in Wiki lookup:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve information from Wikipedia' },
      { status: 500 }
    );
  }
} 
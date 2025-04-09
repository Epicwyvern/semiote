import { NextResponse } from 'next/server';

// Define types for Google Books API response
interface BookVolumeInfo {
  title: string;
  authors?: string[];
  publishedDate?: string;
  description?: string;
}

interface BookSearchInfo {
  textSnippet?: string;
}

interface BookItem {
  volumeInfo: BookVolumeInfo;
  searchInfo?: BookSearchInfo;
}

interface BookExcerpt {
  title: string;
  authors: string[];
  publishedDate: string | undefined;
  description: string;
  snippet: string;
}

// Define TypeScript interfaces for Google Books API response
interface GoogleBooksResponse {
  items?: GoogleBookItem[];
  totalItems: number;
}

interface GoogleBookItem {
  volumeInfo: {
    title?: string;
    authors?: string[];
    description?: string;
    publishedDate?: string;
  };
}

// Sample data to use as fallback when API fails
const sampleBookData = [
  {
    title: "The Language of Symbols",
    authors: ["David Fontana"],
    publishedDate: "1994",
    description: "A comprehensive guide to understanding symbols across cultures",
    snippet: "The mandala represents the cosmos in its entirety and the harmony of all elements."
  },
  {
    title: "Sacred Symbols in Art",
    authors: ["Elizabeth E. Goldsmith"],
    publishedDate: "2006",
    description: "A study of religious symbolism throughout history",
    snippet: "Among Eastern symbols, the mandala holds particular significance as a representation of universal wholeness."
  }
];

export async function POST(request: Request) {
  try {
    const { symbolName } = await request.json();
    
    if (!symbolName) {
      return Response.json({ 
        success: false, 
        bookData: "No symbol name provided for book lookup.",
        error: "MISSING_SYMBOL_NAME"
      });
    }
    
    const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;
    
    if (!GOOGLE_BOOKS_API_KEY) {
      console.warn("Google Books API key is not configured");
      return Response.json({ 
        success: true,
        bookData: formatBookData(sampleBookData),
        note: "Using sample data because Google Books API key is not configured"
      });
    }
    
    try {
      const query = `${symbolName} symbol meaning history`;
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${GOOGLE_BOOKS_API_KEY}&maxResults=3`;
      
      // Enhanced error handling with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, { 
        signal: controller.signal,
        next: { revalidate: 3600 } // Cache for 1 hour
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Google Books API request failed with status ${response.status}`);
      }
      
      const data: GoogleBooksResponse = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log(`No book results found for "${symbolName}", using sample data`);
        return Response.json({ 
          success: true, 
          bookData: formatBookData(sampleBookData),
          note: "Using sample data as no books were found for this symbol"
        });
      }
      
      // Format the book data consistently
      const formattedData = formatBookData(data.items.map(book => {
        const volumeInfo = book.volumeInfo || {};
        return {
          title: volumeInfo.title || "Unknown Title",
          authors: volumeInfo.authors || ["Unknown Author"],
          publishedDate: volumeInfo.publishedDate,
          description: volumeInfo.description || "No description available",
          snippet: (volumeInfo.description || "").substring(0, 300) + ((volumeInfo.description || "").length > 300 ? '...' : '')
        };
      }));
      
      return Response.json({ 
        success: true, 
        bookData: formattedData
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Google Books API error for "${symbolName}":`, errorMessage);
      
      return Response.json({ 
        success: true,
        bookData: formatBookData(sampleBookData),
        note: `Using sample data due to API error: ${errorMessage}`
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Internal error in Google Books lookup:", errorMessage);
    
    return Response.json({ 
      success: true,
      bookData: formatBookData(sampleBookData),
      note: "Using sample data due to internal server error"
    });
  }
}

// Helper function to format book data consistently
function formatBookData(books: any[]): string {
  return books.map(book => 
    `BOOK: "${book.title}" by ${book.authors.join(', ')}${book.publishedDate ? ` (${book.publishedDate})` : ''}\nEXCERPT: ${book.snippet || book.description || 'No excerpt available'}`
  ).join('\n\n');
} 
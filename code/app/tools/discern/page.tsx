"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Upload, X, FileSymlink, ArrowUpFromLine, ExternalLink, Info, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

// Simulated symbol detection results
const sampleDetectionResults = [
  {
    name: "Mandala",
    category: "Spiritual",
    confidence: 9.4,
    prominence: 8.7,
    authenticity: 9.2,
    description: "A geometric configuration of symbols with spiritual significance in various traditions. This circular design represents the universe and cosmic harmony.",
    overallScoreRationale: "This Mandala symbol scores highly (9.1/10) due to its distinctive concentric patterns and clear spiritual significance. The authenticity score (9.2) is particularly strong as it displays classic mandala elements with high precision.",
    contextDescription: "The Mandala is a sacred geometric symbol that appears in spiritual traditions across Asia, particularly in Hinduism and Buddhism. It represents the cosmos and serves as an aid to meditation practices, drawing the eye toward its center to symbolize unity and harmony.",
    origin: "India/Tibet",
    timePeriod: "500 BCE - Present",
    primaryUse: "Meditation",
    culturalPrevalence: "Widespread",
    visualComplexity: "High",
    keyElements: "Concentric circles, Symmetry, Geometric patterns, Central point",
    boundingBox: { x: 50, y: 50, width: 500, height: 500 }
  },
  {
    name: "Lotus Flower",
    category: "Eastern",
    confidence: 8.7,
    prominence: 8.3,
    authenticity: 8.9,
    description: "A sacred symbol in many Eastern traditions, representing purity, enlightenment, and rebirth. Often depicted with symmetrical petals emerging from muddy waters.",
    overallScoreRationale: "The Lotus Flower scores 8.6/10 due to its clear symbolic outline and cultural significance. Its authenticity (8.9) stands out as this representation closely matches traditional Eastern iconography.",
    contextDescription: "The Lotus Flower holds profound meaning in Eastern religious traditions, particularly in Buddhism and Hinduism. It represents spiritual awakening and transcendence, emerging clean from muddy waters as a metaphor for spiritual growth.",
    origin: "Egypt/India",
    timePeriod: "1500 BCE - Present",
    primaryUse: "Religious",
    culturalPrevalence: "Regional",
    visualComplexity: "Medium",
    keyElements: "Symmetrical petals, Center, Stem",
    boundingBox: { x: 250, y: 300, width: 100, height: 80 }
  },
  {
    name: "Sun Motif",
    category: "Universal",
    confidence: 7.6,
    prominence: 7.9,
    authenticity: 7.3,
    description: "A representation of the sun, universally recognized as a symbol of life, energy, and divine power across many cultures throughout human history.",
    overallScoreRationale: "The Sun Motif scores 7.6/10, with its prominence (7.9) being the strongest aspect due to its central position in the image. Its authenticity (7.3) is lower as this design lacks some traditional detailing.",
    contextDescription: "The Sun as a symbol appears in virtually every human culture throughout history. As the source of light and life-sustaining energy, it naturally became associated with divinity, power, and life cycles across civilizations.",
    origin: "Universal",
    timePeriod: "Prehistoric - Present",
    primaryUse: "Religious",
    culturalPrevalence: "Universal",
    visualComplexity: "Low",
    keyElements: "Disc, Rays, Circular form",
    boundingBox: { x: 275, y: 275, width: 50, height: 50 }
  }
];

export default function DiscernPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<string[]>([]) // Store multiple images
  const [currentImageIndex, setCurrentImageIndex] = useState(0) // Track current image
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [detectionResults, setDetectionResults] = useState<any[] | null>(null)
  const [selectedSymbol, setSelectedSymbol] = useState<number | null>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [activeSymbol, setActiveSymbol] = useState(0)
  
  // Track image container height for matching
  const [imageContainerHeight, setImageContainerHeight] = useState(0)
  const imageRef = useRef<HTMLDivElement>(null)
  const [thinkingProcessData, setThinkingProcessData] = useState<Array<{symbolName: string, thinking: string[]}>>([])

  // Add error state
  const [error, setError] = useState<string | null>(null);

  // Effect to update image container height
  useEffect(() => {
    if (imageRef.current) {
      const updateHeight = () => {
        if (imageRef.current) {
          setImageContainerHeight(imageRef.current.clientHeight)
        }
      }
      
      // Reset height when changing images to ensure proper resizing
      setImageContainerHeight(0)
      
      // Use a small delay to ensure the image has rendered
      const timer = setTimeout(() => {
        updateHeight()
      }, 100)
      
      window.addEventListener('resize', updateHeight)
      
      return () => {
        window.removeEventListener('resize', updateHeight)
        clearTimeout(timer)
      }
    }
  }, [uploadedImages, currentImageIndex])

  // Add clipboard paste event listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData) {
        // Check if clipboard contains images
        const items = e.clipboardData.items;
        let imageFound = false;
        
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            imageFound = true;
            const blob = items[i].getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = (e) => {
                if (e.target && typeof e.target.result === "string") {
                  // Reset any existing analysis
                  setUploadedImages([e.target.result]);
                  setCurrentImageIndex(0);
                  setIsAnalyzing(true);
                  setDetectionResults(null);
                  setSelectedSymbol(null);
                  
                  // Process the pasted image
                  processImageWithAI(e.target.result);
                }
              };
              reader.readAsDataURL(blob);
            }
            break;
          }
        }
        
        if (imageFound) {
          e.preventDefault();
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);
    
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  // Update the processImageWithAI function to capture all the returned fields
  const processImageWithAI = async (imageBase64: string) => {
    setIsAnalyzing(true);
    setError(null); // Clear any previous errors
    
    try {
      // Step 1: Segment the image to find symbols using SAM
      const segmentResponse = await fetch('/api/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imageBase64.split(',')[1] })
      });
      
      if (!segmentResponse.ok) {
        const errorData = await segmentResponse.json();
        throw new Error(`Segmentation failed: ${errorData.error || segmentResponse.statusText}`);
      }
      
      const segmentData = await segmentResponse.json();
      
      // Check if any symbols were detected
      if (!segmentData.symbols || segmentData.symbols.length === 0) {
        throw new Error('No symbols detected in the image');
      }
      
      // For simplicity in the demo, use the first symbol if multiple were detected
      const boundingBox = segmentData.symbols[0]?.boundingBox;
      
      // Step 2: Analyze the symbol with enhanced analysis that includes books and wiki data
      const analysisResponse = await fetch('/api/enhancedAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64: imageBase64.split(',')[1],
          boundingBox
        })
      });
      
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json();
        throw new Error(`Analysis failed: ${errorData.error || analysisResponse.statusText}`);
      }
      
      const analysisData = await analysisResponse.json();
      
      // Format the results for display in the existing UI
      const formattedResults = [
        {
          name: analysisData.analysis.name,
          category: analysisData.analysis.category,
          confidence: analysisData.analysis.confidence,
          prominence: analysisData.analysis.prominence,
          authenticity: analysisData.analysis.authenticity,
          description: analysisData.analysis.description,
          overallScoreRationale: analysisData.analysis.overallScoreRationale || "Score based on confidence, prominence, and authenticity metrics.",
          contextDescription: analysisData.analysis.contextDescription || analysisData.analysis.description,
          origin: analysisData.analysis.origin || "Unknown",
          timePeriod: analysisData.analysis.timePeriod || "Unknown",
          primaryUse: analysisData.analysis.primaryUse || "Unknown",
          culturalPrevalence: analysisData.analysis.culturalPrevalence || "Unknown",
          visualComplexity: analysisData.analysis.visualComplexity || "Medium",
          keyElements: analysisData.analysis.keyElements || "Various geometric elements",
          boundingBox: boundingBox || null
        }
      ];
      
      // Format thinking process data
      const formattedThinkingProcess = [
        {
          symbolName: analysisData.analysis.name,
          thinking: analysisData.analysis.thinkingProcess || []
        }
      ];
      
      // Update state with the analysis results
      setDetectionResults(formattedResults);
      setThinkingProcessData(formattedThinkingProcess);
      setSelectedSymbol(0);
      setActiveSymbol(0);
    } catch (error) {
      console.error('Error analyzing image:', error);
      setError((error as Error).message || 'Failed to analyze image');
      // Set fallback data for demo purposes
      setDetectionResults(sampleDetectionResults);
      setSelectedSymbol(0);
      setActiveSymbol(0);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(Array.from(files))
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files))
    }
  }

  // New function to handle multiple files
  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith("image/"))
    
    if (imageFiles.length === 0) {
      alert("Please upload image files (SVG, PNG, JPG, or WEBP).")
      return
    }
    
    // Check size limits
    const oversizedFiles = imageFiles.filter(file => file.size > 10 * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      alert("Some files exceed the 10MB limit and will be skipped.")
    }
    
    const validFiles = imageFiles.filter(file => file.size <= 10 * 1024 * 1024)
    
    if (validFiles.length === 0) {
      return
    }
    
    // Process first image immediately, queue the rest
    processImage(validFiles[0], 0, validFiles)
  }
  
  // Process a single image from the queue
  const processImage = (file: File, index: number, allFiles: File[]) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === "string") {
        // Add this image to our collection
        if (index === 0) {
          // First image, start fresh
          setUploadedImages([e.target.result])
          setCurrentImageIndex(0)
          setIsAnalyzing(true)
          setDetectionResults(null)
          setSelectedSymbol(null)
        } else {
          // Additional image - ensure we only add strings to the array
          setUploadedImages(prev => [...prev, e.target?.result as string])
        }
        
        // If it's the first image, process with AI
        if (index === 0) {
          processImageWithAI(e.target.result);
        }
        
        // Process next image if available
        if (index < allFiles.length - 1) {
          processImage(allFiles[index + 1], index + 1, allFiles)
        }
      }
    }
    
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    if (uploadedImages.length <= 1) {
      // Last image, reset everything
      setUploadedImages([])
      setDetectionResults(null)
      setSelectedSymbol(null)
    } else {
      // Remove current image
      setUploadedImages(prev => prev.filter((_, idx) => idx !== currentImageIndex))
      
      // Adjust current index if needed
      if (currentImageIndex >= uploadedImages.length - 1) {
        setCurrentImageIndex(uploadedImages.length - 2)
      }
    }
  }
  
  // Navigation functions with AI processing
  const goToNextImage = () => {
    if (currentImageIndex < uploadedImages.length - 1) {
      setCurrentImageIndex(prev => prev + 1)
      
      // Process the next image with AI
      processImageWithAI(uploadedImages[currentImageIndex + 1]);
    }
  }
  
  const goToPrevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1)
      
      // Process the previous image with AI
      processImageWithAI(uploadedImages[currentImageIndex - 1]);
    }
  }

  // Replace the getScoreGradient function with a proper gradient based on score
  const getScoreGradient = (score: number) => {
    // Create a gradient from dark brown (#726025) to Gold Leaf
    return `bg-gradient-to-r from-[#726025] to-gold-leaf`;
  };

  // Add function to calculate overall score
  const calculateOverallScore = (symbol: any) => {
    if (!symbol) return 0;
    // Weight the different metrics to create an overall score
    const weightedSum = 
      (symbol.confidence * 0.4) + 
      (symbol.prominence * 0.3) + 
      (symbol.authenticity * 0.3);
    
    // Return score on a scale of 10 (already in 0-10 range)
    return weightedSum.toFixed(1);
  };

  return (
    <div className="relative min-h-screen bg-bone-white ml-[80px]">
      <div className="px-8 py-12">
        <div className="text-left max-w-full">
          <div className="flex items-center mb-4 text-gold-leaf">
            <FileSymlink size={24} className="mr-3" />
            <h1 className="text-3xl font-garamond">Discern</h1>
          </div>
          
          <p className="text-lg mb-8 max-w-3xl text-ash-grey">
            Upload an image to identify and analyze symbols within it. Our advanced algorithms will detect 
            and highlight symbolic elements, providing context and interpretation.
          </p>

          {uploadedImages.length === 0 ? (
            <div
              className={`border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center transition-colors ${
                isDragging ? "border-gold-leaf bg-gold-leaf/5" : "border-ash-grey/30 bg-parchment/10"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="w-16 h-16 mb-4 flex items-center justify-center">
                <ArrowUpFromLine className="h-10 w-10 text-ash-grey/50" />
              </div>
              <p className="text-center text-ash-grey mb-2">Click to upload, drag and drop, or paste (Ctrl+V) one or more images</p>
              <p className="text-center text-moonlit-silver text-sm mb-6">
                SVG, PNG, JPG or WEBP (MAX. 10 MB per image)
              </p>
              <input type="file" accept="image/*" multiple className="hidden" id="image-upload" onChange={handleFileInput} />
              <Button asChild className="bg-gold-leaf hover:bg-gold-leaf/80 text-obsidian-black border-none">
                <label htmlFor="image-upload" className="cursor-pointer px-4 py-2">
                  Select Files
                </label>
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Left side: Image Container */}
                <div className="lg:w-[35%]" ref={imageRef}>
                  <div className="relative rounded-lg overflow-hidden border border-ash-grey/20 bg-parchment/5">
                    <img
                      src={uploadedImages[currentImageIndex]}
                      alt={`Uploaded image ${currentImageIndex + 1}`}
                      className="w-full h-auto"
                    />
                    
                    {/* Overlay detection boxes */}
                    {detectionResults && !isAnalyzing && (
                      <div className="absolute top-0 left-0 w-full h-full">
                        {detectionResults.map((result, index) => (
                          <div 
                            key={index}
                            className={`absolute border-2 ${selectedSymbol === index ? 'border-gold-leaf' : 'border-obsidian-black'} 
                              cursor-pointer transition-colors hover:border-gold-leaf`}
                            style={{
                              top: `${(result.boundingBox.y / imageSize.height) * 100}%`,
                              left: `${(result.boundingBox.x / imageSize.width) * 100}%`,
                              width: `${(result.boundingBox.width / imageSize.width) * 100}%`,
                              height: `${(result.boundingBox.height / imageSize.height) * 100}%`
                            }}
                            onClick={() => {
                              setSelectedSymbol(index)
                              setActiveSymbol(index)
                            }}
                          >
                            <div className="absolute -top-6 left-0 bg-obsidian-black text-bone-white text-xs px-2 py-1 rounded">
                              {result.name} ({result.confidence}%)
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <button
                      className="absolute top-4 right-4 bg-obsidian-black/70 text-bone-white p-2 rounded-full hover:bg-obsidian-black transition-colors"
                      onClick={removeImage}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Right side: Analysis Results */}
                <div 
                  className="lg:w-[65%] flex flex-col justify-between overflow-y-auto"
                  style={{ 
                    height: imageContainerHeight > 0 ? `${Math.max(imageContainerHeight, 736)}px` : 'auto'
                  }}
                >
                  {isAnalyzing ? (
                    <div className="p-6 bg-parchment/10 rounded-lg border border-ash-grey/20 h-full flex items-center justify-center">
                      <div>
                        <h2 className="text-2xl mb-6 font-garamond text-gold-leaf text-center">Analyzing Image...</h2>
                        <div className="space-y-4">
                          <div className="h-4 bg-ash-grey/20 rounded-full w-full animate-pulse"></div>
                          <div className="h-4 bg-ash-grey/20 rounded-full w-3/4 animate-pulse"></div>
                          <div className="h-4 bg-ash-grey/20 rounded-full w-5/6 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  ) : detectionResults && selectedSymbol !== null ? (
                    <div className="flex flex-col h-full">
                      {/* Symbol Tabs - Right below the image */}
                      <div className="rounded-lg border border-ash-grey/10 bg-parchment mb-5 flex-shrink-0">
                        <div className="flex overflow-x-auto py-2 px-3 gap-2">
                          {detectionResults.map((result, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setSelectedSymbol(index)
                                setActiveSymbol(index)
                              }}
                              className={`px-5 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                                activeSymbol === index 
                                  ? 'bg-gold-leaf text-obsidian-black' 
                                  : 'bg-sand-salt hover:bg-sand-salt/80 text-ash-grey'
                              }`}
                            >
                              {result.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* 2x2 Grid of Cards - Wider than tall */}
                      <div className="grid grid-cols-2 gap-5 overflow-y-auto pr-1">
                        {/* Scores Card - Top Left */}
                        <div className="bg-parchment rounded-lg border border-ash-grey/20 overflow-hidden">
                          <div className="p-5">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h3 className="text-lg font-garamond font-medium">{detectionResults[selectedSymbol].name}</h3>
                                <p className="text-sm text-ash-grey">{detectionResults[selectedSymbol].category}</p>
                              </div>
                              <Link href={`/library/symbol/${detectionResults[selectedSymbol].name.toLowerCase().replace(/\s+/g, '-')}`}>
                                <Button variant="outline" size="sm" className="flex items-center gap-1 text-xs">
                                  View in Library
                                  <ExternalLink size={12} />
                                </Button>
                              </Link>
                            </div>
                          
                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <div className="flex justify-between">
                                  <span className="font-medium text-sm">Confidence</span>
                                  <span className="font-medium text-sm">{(detectionResults[selectedSymbol].confidence).toFixed(1)}</span>
                                </div>
                                <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                                  <div 
                                    className={`h-full ${getScoreGradient(detectionResults[selectedSymbol].confidence)} transition-all duration-500`}
                                    style={{ width: `${detectionResults[selectedSymbol].confidence * 10}%` }}
                                  >
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex justify-between">
                                  <span className="font-medium text-sm">Prominence</span>
                                  <span className="font-medium text-sm">{(detectionResults[selectedSymbol].prominence).toFixed(1)}</span>
                                </div>
                                <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                                  <div 
                                    className={`h-full ${getScoreGradient(detectionResults[selectedSymbol].prominence)} transition-all duration-500`}
                                    style={{ width: `${detectionResults[selectedSymbol].prominence * 10}%` }}
                                  >
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex justify-between">
                                  <span className="font-medium text-sm">Authenticity</span>
                                  <span className="font-medium text-sm">{(detectionResults[selectedSymbol].authenticity).toFixed(1)}</span>
                                </div>
                                <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                                  <div 
                                    className={`h-full ${getScoreGradient(detectionResults[selectedSymbol].authenticity)} transition-all duration-500`}
                                    style={{ width: `${detectionResults[selectedSymbol].authenticity * 10}%` }}
                                  >
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Overall Score Card - Top Right */}
                        <div className="bg-parchment rounded-lg border border-ash-grey/20 overflow-hidden">
                          <div className="p-5">
                            <h3 className="text-lg font-garamond font-medium mb-5">Overall Score</h3>
                            
                            <div className="bg-sand-salt p-4 rounded-md border border-ash-grey/10 flex items-start space-x-3 mb-5">
                              <Info className="h-5 w-5 text-gold-leaf shrink-0 mt-0.5" />
                              <div>
                                <h4 className="text-sm font-medium mb-1">Score: {calculateOverallScore(detectionResults[selectedSymbol])} / 10</h4>
                                <p className="text-xs text-ash-grey overflow-y-auto max-h-[80px]">
                                  {detectionResults[selectedSymbol].overallScoreRationale || 
                                    "This score represents our system's analysis of this symbol's confidence, prominence, and authenticity."}
                                </p>
                              </div>
                            </div>
                            
                            <div className="space-y-3 text-sm text-ash-grey mb-3">
                              <p>The score evaluates the symbol against our database of historical and contemporary symbols.</p>
                              <p>Higher scores indicate stronger matches with verified authentic symbols from our collections.</p>
                            </div>
                          </div>
                        </div>

                        {/* Source & Origin Card - Bottom Left */}
                        <div className="bg-parchment rounded-lg border border-ash-grey/20 overflow-hidden">
                          <div className="p-5">
                            <h3 className="text-lg font-garamond font-medium mb-5">Source & Origin</h3>
                            
                            <div className="bg-sand-salt p-4 rounded-md border border-ash-grey/10 mb-5 max-h-[150px] overflow-y-auto">
                              <h4 className="text-sm font-medium mb-1">Context</h4>
                              <p className="text-xs text-ash-grey">
                                {detectionResults[selectedSymbol].contextDescription || 
                                  `${detectionResults[selectedSymbol].name} has been used in various cultures throughout history.`}
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div className="p-3 bg-sand-salt rounded-md border border-ash-grey/10">
                                <h5 className="text-xs text-ash-grey mb-1">Origin</h5>
                                <p className="font-medium text-sm">{detectionResults[selectedSymbol].origin}</p>
                              </div>
                              <div className="p-3 bg-sand-salt rounded-md border border-ash-grey/10">
                                <h5 className="text-xs text-ash-grey mb-1">Time Period</h5>
                                <p className="font-medium text-sm">{detectionResults[selectedSymbol].timePeriod}</p>
                              </div>
                              <div className="p-3 bg-sand-salt rounded-md border border-ash-grey/10">
                                <h5 className="text-xs text-ash-grey mb-1">Primary Use</h5>
                                <p className="font-medium text-sm">{detectionResults[selectedSymbol].primaryUse}</p>
                              </div>
                              <div className="p-3 bg-sand-salt rounded-md border border-ash-grey/10">
                                <h5 className="text-xs text-ash-grey mb-1">Cultural Prevalence</h5>
                                <p className="font-medium text-sm">{detectionResults[selectedSymbol].culturalPrevalence}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Visual Analysis Card - Bottom Right */}
                        <div className="bg-parchment rounded-lg border border-ash-grey/20 overflow-hidden">
                          <div className="p-5">
                            <h3 className="text-lg font-garamond font-medium mb-5">Visual Analysis</h3>
                            
                            <div className="max-h-[100px] overflow-y-auto mb-5">
                              <p className="text-sm text-ash-grey">
                                {detectionResults[selectedSymbol].description}
                              </p>
                            </div>
                            
                            <div className="bg-sand-salt p-4 rounded-md border border-ash-grey/10 space-y-2 mb-5 max-h-[100px] overflow-y-auto">
                              {thinkingProcessData[selectedSymbol || 0]?.thinking?.map((thought, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <div className="h-2 w-2 rounded-full bg-gold-leaf mt-1.5"></div>
                                  <p className="text-xs text-ash-grey">{thought}</p>
                                </div>
                              ))}
                              {(!thinkingProcessData[selectedSymbol || 0]?.thinking || thinkingProcessData[selectedSymbol || 0]?.thinking.length === 0) && (
                                <p className="text-xs text-ash-grey">Analysis process will appear here when available.</p>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div className="p-3 bg-sand-salt rounded-md border border-ash-grey/10">
                                <h5 className="text-xs text-ash-grey mb-1">Visual Complexity</h5>
                                <p className="font-medium text-sm">{detectionResults[selectedSymbol].visualComplexity}</p>
                              </div>
                              <div className="p-3 bg-sand-salt rounded-md border border-ash-grey/10">
                                <h5 className="text-xs text-ash-grey mb-1">Key Elements</h5>
                                <p className="font-medium text-sm">{detectionResults[selectedSymbol].keyElements}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full bg-parchment/10 rounded-lg border border-ash-grey/20 p-8">
                      <p className="text-ash-grey text-center">Select a symbol from the image to view analysis</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Pagination Controls */}
              {uploadedImages.length > 0 && !isAnalyzing && (
                <div className="flex justify-center items-center mt-8 mb-4">
                  <button 
                    className={`flex items-center px-4 py-2 rounded-lg border border-ash-grey/10 ${
                      currentImageIndex > 0 
                        ? 'text-ash-grey hover:text-gold-leaf hover:bg-sand-salt'
                        : 'text-ash-grey/40 cursor-not-allowed'
                    }`}
                    onClick={goToPrevImage}
                    disabled={currentImageIndex === 0}
                  >
                    <ChevronLeft size={20} className="mr-2" />
                    <span>Previous Image</span>
                  </button>
                  <div className="mx-6 px-6 py-2 bg-sand-salt rounded-lg border border-ash-grey/10 text-ash-grey font-medium">
                    {currentImageIndex + 1} / {uploadedImages.length}
                  </div>
                  <button 
                    className={`flex items-center px-4 py-2 rounded-lg border border-ash-grey/10 ${
                      currentImageIndex < uploadedImages.length - 1 
                        ? 'text-ash-grey hover:text-gold-leaf hover:bg-sand-salt'
                        : 'text-ash-grey/40 cursor-not-allowed'
                    }`}
                    onClick={goToNextImage}
                    disabled={currentImageIndex >= uploadedImages.length - 1}
                  >
                    <span>Next Image</span>
                    <ChevronRight size={20} className="ml-2" />
                  </button>
                </div>
              )}

              {/* Error display in the UI */}
              {error && (
                <div className="p-4 mb-4 bg-red-50 text-red-800 border border-red-200 rounded-md">
                  <p className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </p>
                  <p className="text-sm mt-2">The analysis is continuing with sample data for demonstration purposes.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

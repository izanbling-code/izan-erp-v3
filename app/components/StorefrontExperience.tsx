"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

type QuizChoice = {
  id: string;
  text: string;
  nextNodeId: string | null;
  resultProductId: string | null;
  resultUrl: string | null;
};

type QuizNode = {
  id: string;
  question: string;
  choices: QuizChoice[];
};

type QuizData = {
  id: string;
  nodes: QuizNode[];
} | null;

export default function StorefrontExperience({ 
  quizData, 
  fallbackProducts 
}: { 
  quizData: QuizData; 
  fallbackProducts: any[]; 
}) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // Find the current question node
  const currentNode = quizData?.nodes.find(n => n.id === activeNodeId) || quizData?.nodes[0];

  const handleChoiceClick = (choice: QuizChoice) => {
    if (choice.resultUrl) {
      window.location.href = choice.resultUrl; // Redirect to specific category/page
    } else if (choice.resultProductId) {
      window.location.href = `/shop/product/${choice.resultProductId}`; // Redirect to product details
    } else if (choice.nextNodeId) {
      setActiveNodeId(choice.nextNodeId); // Move to next question node
    }
  };

  const startExperience = () => {
    if (quizData && quizData.nodes.length > 0) {
      setHasStarted(true);
      setActiveNodeId(quizData.nodes[0].id);
    } else {
      // If no quiz/funnel exists yet, smoothly scroll down to the collection/canvas area
      window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-[#faf9f6] text-slate-900 font-sans selection:bg-teal-900 selection:text-white">
      
      {/* 1. INITIAL LUXURY CAMPAIGN HERO */}
      {!hasStarted && (
        <div className="relative w-full h-screen flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-1000">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-black/40 z-10" />
            <img 
              src="https://placehold.co/2000x1200/1a1a1a/ffffff?text=IZAN+BLING+LUXURY" 
              alt="Campaign Background" 
              className="w-full h-full object-cover scale-105 motion-safe:animate-[pulse_10s_ease-in-out_infinite]"
            />
          </div>

          <div className="relative z-20 text-center px-6 max-w-4xl mx-auto flex flex-col items-center">
            <Sparkles className="w-8 h-8 text-teal-400 mb-6 animate-pulse" />
            <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter uppercase mb-6 drop-shadow-lg">
              Define Your <br className="hidden md:block"/> Aesthetic
            </h1>
            <p className="text-lg md:text-xl text-white/90 font-light max-w-2xl mb-12 drop-shadow-md">
              Skip the endless scrolling. Tell us about your style, and we will curate the perfect Izan Bling pieces exclusively for you.
            </p>
            
            <button 
              onClick={startExperience}
              className="group relative inline-flex items-center justify-center px-10 py-5 bg-white text-slate-900 font-bold uppercase tracking-widest text-sm rounded-full overflow-hidden transition-all hover:scale-105 shadow-2xl"
            >
              <span className="relative z-10 flex items-center gap-3">
                Begin the Experience <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 2. THE INTERACTIVE FUNNEL UI */}
      {hasStarted && currentNode && (
        <div className="w-full min-h-screen flex items-center justify-center p-6 animate-in slide-in-from-bottom-8 fade-in duration-700">
          <div className="max-w-2xl w-full text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 mb-12 leading-tight">
              {currentNode.question}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentNode.choices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => handleChoiceClick(choice)}
                  className="p-6 border border-slate-200 bg-white rounded-2xl hover:border-teal-600 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-lg font-medium text-slate-700 hover:text-teal-700 flex items-center justify-between group"
                >
                  <span>{choice.text}</span>
                  <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. FALLBACK COLLECTION (Shows if user scrolls down before starting quiz) */}
      {!hasStarted && fallbackProducts.length > 0 && (
        <div className="w-full max-w-7xl mx-auto px-6 py-32 bg-[#faf9f6]">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold uppercase tracking-widest text-slate-900 mb-4">The Collection</h3>
            <p className="text-slate-500">Explore our latest arrivals.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {fallbackProducts.map((product) => (
              <Link key={product.id} href={`/shop/product/${product.id}`} className="group block">
                <div className="relative aspect-[4/5] bg-slate-100 rounded-xl overflow-hidden mb-4">
                  <Image 
                    src={product.imageUrl || `https://placehold.co/600x800?text=${encodeURIComponent(product.name)}`}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <h4 className="font-bold text-slate-900">{product.name}</h4>
                <p className="text-teal-700 font-medium mt-1">Rs. {Number(product.salePrice).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
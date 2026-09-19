'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'dark' | 'light';

function savedTheme(): Theme {
  try {
    const saved = window.localStorage.getItem('resqnet-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage blocked: fall through */
  }
  return 'dark'; // control-room default
}

/** Dark/light switch for the command center. Renders "dark" on the server, then syncs after mount. */
export function ThemeToggle(){
  const [theme,setTheme]=useState<Theme>('dark');

  useEffect(()=>{
    const t=setTimeout(()=>setTheme(savedTheme()),0); // after hydration: no server/client mismatch
    return()=>clearTimeout(t);
  },[]);

  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
  },[theme]);

  const toggle=()=>{
    const next=theme==='dark'?'light':'dark';
    setTheme(next);
    try{window.localStorage.setItem('resqnet-theme',next)}catch{/* ignore */}
  };

  return <button className="theme-toggle" onClick={toggle} aria-label={`Switch to ${theme==='dark'?'light':'dark'} mode`} title={`Switch to ${theme==='dark'?'light':'dark'} mode`}>
    <span className={theme==='light'?'active':''}><Sun size={12}/></span>
    <span className={theme==='dark'?'active':''}><Moon size={12}/></span>
  </button>;
}

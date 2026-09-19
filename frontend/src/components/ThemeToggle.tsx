'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'dark' | 'light';

export function ThemeToggle(){
  const [theme,setTheme]=useState<Theme>(()=>{
    if(typeof window==='undefined') return 'dark';
    const saved=window.localStorage.getItem('resqnet-theme') as Theme | null;
    if(saved==='light'||saved==='dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
  },[theme]);

  const toggle=()=>{
    const next=theme==='dark'?'light':'dark';
    setTheme(next);
    document.documentElement.dataset.theme=next;
    window.localStorage.setItem('resqnet-theme',next);
  };

  return <button className="theme-toggle" onClick={toggle} aria-label={`Switch to ${theme==='dark'?'light':'dark'} mode`} title={`Switch to ${theme==='dark'?'light':'dark'} mode`}>
    <span className={theme==='light'?'active':''}><Sun size={12}/></span>
    <span className={theme==='dark'?'active':''}><Moon size={12}/></span>
  </button>;
}

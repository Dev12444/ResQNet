'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'dark' | 'light';

export function ThemeToggle(){
  const [theme,setTheme]=useState<Theme>('dark');

  useEffect(()=>{
    // Deferred: setting state synchronously in an effect body cascades a
    // render. The inline bootstrap in `layout.tsx` has already applied the
    // saved theme before first paint, so this just reads it back.
    const t=setTimeout(()=>{
      const applied=document.documentElement.dataset.theme;
      const saved=window.localStorage.getItem('resqnet-theme') as Theme | null;
      const next=applied==='light'||applied==='dark'?applied:(saved==='light'||saved==='dark'?saved:'light');
      setTheme(next);
      document.documentElement.dataset.theme=next;
    },0);
    return ()=>clearTimeout(t);
  },[]);

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

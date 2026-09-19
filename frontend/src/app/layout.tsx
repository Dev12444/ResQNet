import './globals.css';

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`try{var t=localStorage.getItem('resqnet-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else if(matchMedia('(prefers-color-scheme: light)').matches)document.documentElement.dataset.theme='light';}catch(e){}`}}/></head><body>{children}</body></html>}

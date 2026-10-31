"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="empty-state"><h1>Səhifə yüklənmədi.</h1><p>Bir az sonra yenidən cəhd edin.</p><button className="btn btn-dark" onClick={reset}>Yenidən yoxla</button></main>; }

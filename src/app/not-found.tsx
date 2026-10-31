import Link from "next/link";
export default function NotFound() { return <main className="empty-state"><p className="eyebrow">404</p><h1>Səhifə tapılmadı.</h1><Link className="btn btn-dark" href="/">Ana səhifəyə qayıt</Link></main>; }

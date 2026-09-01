'use client'

import './landing.css'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BarChart3, Check, ChevronRight, Link2, Menu, Share2, Users, X } from 'lucide-react'
import LogoMark from '@/components/LogoMark'

const visitors = [
  { name: 'Maya Chen', detail: 'VP Marketing · Notion', source: 'LinkedIn', img: 12 as number | null },
  { name: 'Anonymous visitor', detail: 'Austin, TX · Chrome', source: 'Google', img: null as number | null },
  { name: 'Priya Shah', detail: 'Brooklyn, NY · Chrome', source: 'LinkedIn', img: 47 as number | null },
]

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const node = ref.current; if (!node) return; const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && node.classList.add('is-visible'), { threshold: 0.12 }); observer.observe(node); return () => observer.disconnect() }, [])
  return <div ref={ref} className={`reveal ${className}`} style={{ '--delay': `${delay}ms` } as React.CSSProperties}>{children}</div>
}
function Count({ end, suffix = '' }: { end: number; suffix?: string }) { const [value, setValue] = useState(0); const ref = useRef<HTMLSpanElement>(null); useEffect(() => { const node = ref.current; if (!node) return; const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) return; let current = 0; const timer = window.setInterval(() => { current += Math.ceil(end / 30); if (current >= end) { current = end; window.clearInterval(timer) } setValue(current) }, 30); observer.disconnect() }, { threshold: .6 }); observer.observe(node); return () => observer.disconnect() }, [end]); return <span ref={ref}>{value.toLocaleString()}{suffix}</span> }
function Logo() { return <a href="#top" className="logo"><LogoMark />CreatorPixel</a> }
function LiveVisitorStrip() { const [index, setIndex] = useState(0); useEffect(() => { const timer = window.setInterval(() => setIndex(i => (i + 1) % visitors.length), 3200); return () => window.clearInterval(timer) }, []); const visitor = visitors[index]; return <div className="live-strip"><div className="live-strip-head"><span><i /> Live visitors</span><small>+1 engaged view</small></div><div key={index} className="live-visitor animate-card">{visitor.img ? <img src={`https://i.pravatar.cc/64?img=${visitor.img}`} alt={`${visitor.name} avatar`} /> : <span className="live-avatar-anon"><Users /></span>}<div className="live-visitor-info"><strong>{visitor.name}</strong><span>{visitor.detail}</span></div><div className="live-visitor-meta"><b>ACTIVE</b><span>via {visitor.source}</span></div></div></div> }

const captureFields = [
  { label: 'Full name', value: 'Maya Chen' },
  { label: 'Work email', value: 'maya@notion.so' },
  { label: 'Company & role', value: 'VP Marketing · Notion' },
  { label: 'Location', value: 'San Francisco, CA' },
  { label: 'Referral source', value: 'LinkedIn' },
]
const platforms = ['Website', 'Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Podcast']
function InstallCard() {
  const [copied, setCopied] = useState(false)
  const snippet = '<script src="https://cdn.creatorpixel.app/px.js"\n  data-id="cp_9f3a"></script>'
  const copy = () => { navigator.clipboard?.writeText(snippet).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600) }) }
  return <div className="install-card"><span className="step-chip">Step 01 — Install</span><h3>Paste one line. Anywhere.</h3><p>Drop the pixel into any site, or connect a social profile in a single click. No developer required.</p><div className="code-block"><div className="code-bar"><span className="traffic-lights"><i /><i /><i /></span><button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button></div><pre><code>{snippet}</code></pre></div><div className="install-platforms"><span className="platform-label">Works on</span><div className="platform-chips">{platforms.map(p => <span key={p}>{p}</span>)}</div></div></div>
}
function CaptureCard() {
  return <div className="capture-card"><span className="step-chip">Step 02 — Identify</span><div className="capture-rate"><div className="rate-num"><strong><Count end={35} suffix="%" /></strong><span>of visitors identified,<br />on average</span></div><div className="rate-bar" role="img" aria-label="35 percent of visitors identified"><i /></div></div><p className="capture-sub">We match high-intent visits to real people and enrich every profile:</p><ul className="capture-fields">{captureFields.map(field => <li key={field.label}><Check /><span>{field.label}</span><b>{field.value}</b></li>)}</ul></div>
}

const features = [
  { icon: Users, title: 'Identified visitors', text: 'Real names, roles, companies, and LinkedIn profiles — when the signal is there.', image: '/features/identified-visitors.png' },
  { icon: BarChart3, title: 'Page journeys', text: 'See the exact path each visitor takes through your site.', image: '/features/page-journeys.png' },
  { icon: Link2, title: 'Smart links', text: 'Track every click from campaigns, podcasts, and partners.', image: '/features/smart-links.png' },
  { icon: Share2, title: 'Bio page', text: 'Every CreatorPixel bio page has tracking built in. Zero setup.', image: '/features/bio-page.png' },
]
function BenefitsShowcase() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => { if (paused) return; const timer = window.setInterval(() => setActive(i => (i + 1) % features.length), 4000); return () => window.clearInterval(timer) }, [paused])
  return <div className="benefits-showcase" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    <ul className="benefit-list">{features.map((feature, i) => { const on = i === active; return <li key={feature.title}><button type="button" className={`benefit-item ${on ? 'is-active' : ''}`} onClick={() => setActive(i)} aria-pressed={on}><span className="benefit-icon"><feature.icon /></span><span className="benefit-text"><strong>{feature.title}</strong><span>{feature.text}</span></span>{on && !paused && <span className="benefit-progress" key={active}><i /></span>}</button></li> })}</ul>
    <div className="benefit-media">{features.map((feature, i) => <img key={feature.title} src={feature.image || '/placeholder.svg'} alt={`${feature.title} preview`} className={i === active ? 'is-active' : ''} />)}<div className="benefit-media-glow" /></div>
  </div>
}
const pricing = [
  { name: 'Starter', price: '$49', text: 'For creators getting serious about their audience.', items: ['Anonymous analytics', 'Page journeys', 'Company names'] },
  { name: 'Growth', price: '$199', text: 'For creators building a sponsor-ready business.', items: ['Everything in Starter', '~150 identified profiles', 'Email capture'] },
  { name: 'Pro', price: '$399', text: 'For teams that need the complete picture.', items: ['Everything in Growth', '~500 identified profiles', 'CSV export'] },
]
function AttentionPanel({ wide = false }: { wide?: boolean }) { return <div className={`metrics-panel${wide ? ' metrics-wide' : ''}`}><div className="metrics-header"><div><p className="panel-kicker">ATTENTION / LAST 30 DAYS</p><h3>Your channel is holding attention.</h3></div><BarChart3 /></div><div className="metrics-body"><div className="metrics-left"><div className="metric-pair"><div><p>Public views</p><strong>4.1K</strong><span>what everyone sees</span></div><div className="metric-highlight"><p>Engaged views</p><strong>4.0K</strong><span className="metric-up">+18.2% <ChevronRight /></span></div></div><div className="metrics-row"><div><p>Watch hours</p><strong>235</strong><span>hours watched</span></div><div><p>Avg. view duration</p><strong>8:42</strong><span>per view</span></div><div><p>Avg. viewed</p><strong>35.6%</strong><span>of each video</span></div></div></div><div className="retention"><div><p>Engaged views — last 30 days</p><span>Average across channel</span></div><svg viewBox="0 0 460 100" preserveAspectRatio="none" aria-label="Engaged views trend"><path d="M0 86 L24 80 L47 83 L68 71 L91 74 L112 62 L134 67 L156 51 L178 56 L201 43 L224 47 L246 34 L270 39 L293 27 L316 31 L340 21 L365 25 L390 14 L416 18 L440 8 L460 11" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M0 86 L24 80 L47 83 L68 71 L91 74 L112 62 L134 67 L156 51 L178 56 L201 43 L224 47 L246 34 L270 39 L293 27 L316 31 L340 21 L365 25 L390 14 L416 18 L440 8 L460 11 V100 H0Z" fill="currentColor" opacity=".08" /></svg><div className="chart-labels"><span>0:00</span><span>5:00</span><span>10:00</span><span>15:00</span></div></div></div>{wide && <LiveVisitorStrip />}</div> }

export default function Page() { const [menuOpen, setMenuOpen] = useState(false); return <main id="top" className="landing"><nav className="site-nav"><div className="section-wrap nav-inner"><Logo /><div className="nav-links"><a href="#how">How it works</a><a href="#pricing">Pricing</a></div><div className="nav-actions"><a href="/auth/login">Log in</a><a className="button button-primary" href="/auth/login?mode=signup">Get your pixel <ArrowRight /></a></div><button className="menu-button" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>{menuOpen && <div className="mobile-menu"><a href="#how" onClick={() => setMenuOpen(false)}>How it works</a><a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a><a className="button button-primary" href="/auth/login?mode=signup">Get your pixel</a></div>}</nav>
<section id="attention" className="hero-dark"><div className="section-wrap hero hero-inner"><div className="hero-copy"><p className="eyebrow light"><span /> Visitor intelligence for creators</p><h1>Attention is the<br /><em>real</em> currency.</h1><p className="hero-sub">There are two versions of your reach — the public number everyone sees, and the engaged audience sponsors actually pay for. CreatorPixel shows you both, and exactly who&apos;s behind them.</p><div className="hero-actions"><a className="button button-primary button-large" href="/auth/login?mode=signup">Get your pixel — free <ArrowRight /></a><a className="watch-link" href="#how">See how it works</a></div><p className="hero-note">Free to install. No credit card. Works anywhere you can paste a script.</p></div><div className="hero-visual"><div className="laptop"><div className="laptop-screen"><div className="device-bar"><span className="traffic-lights"><i /><i /><i /></span><span className="device-url">creatorpixel.app/dashboard</span></div><div className="device-screen"><AttentionPanel wide /></div></div><div className="laptop-base"><i /></div></div></div></div></section>
<section id="how" className="section-wrap section-pad"><Reveal><div className="section-heading"><div><p className="eyebrow">Simple by design</p><h2>From invisible traffic<br />to <em>real insight.</em></h2></div><p>One tiny script. A much clearer picture of who your work reaches — on websites, landing pages, portfolio sites, courses, and podcasts.</p></div></Reveal><div className="how-grid"><Reveal delay={80}><InstallCard /></Reveal><Reveal delay={160}><CaptureCard /></Reveal></div></section>
<section className="surface-strip"><div className="section-wrap"><p>One pixel. Everywhere your audience lands.</p><div><span>Website</span><span>Landing page</span><span>Bio link</span><span>Podcast site</span><span>Course page</span></div></div></section>
<section className="section-wrap section-pad features-section"><Reveal><div className="section-heading"><div><p className="eyebrow">Built for the whole creator business</p><h2>Everything in<br /><em>one clear view.</em></h2></div><p>Every signal CreatorPixel captures, in one place — from anonymous traffic to sponsor-ready profiles.</p></div></Reveal><Reveal delay={100}><BenefitsShowcase /></Reveal></section>
<section className="lifestyle section-wrap"><div className="lifestyle-image"><img src="/features/influencer-desk.png" alt="Social media influencer working on her computer" /><div className="floating-stat"><span>Engaged audience</span><strong>4.0K</strong><b>+18.2%</b></div></div><div className="lifestyle-copy"><p className="eyebrow">The full picture</p><h2>Make better calls<br />with <em>attention.</em></h2><p>Know which episodes, ideas, and offers hold people long enough to matter. Then bring proof to the next sponsor conversation.</p></div></section>
<section id="pricing" className="pricing-section"><div className="section-wrap"><Reveal><div className="center-heading"><p className="eyebrow">Early access pricing</p><h2>Start seeing<br /><em>what matters.</em></h2><p>Lock in founding-member pricing while CreatorPixel is still early.</p></div></Reveal><div className="pricing-grid">{pricing.map((tier, i) => <Reveal key={tier.name} delay={i * 80}><div className={`price-card ${i === 1 ? 'price-featured' : ''}`}><div className="price-top"><h3>{tier.name}</h3><span>Early access</span></div><div className="price"><strong>{tier.price}</strong><span>/ month</span></div><p>{tier.text}</p><ul>{tier.items.map(item => <li key={item}><Check />{item}</li>)}</ul><a href="/auth/login?mode=signup" className={`button ${i === 1 ? 'button-primary' : 'button-outline'}`}>Get started <ArrowRight /></a></div></Reveal>)}</div></div></section>
<section id="cta" className="cta-section"><div className="section-wrap cta-inner"><div><p className="eyebrow light">Your next sponsor call</p><h2>Stop guessing.<br /><em>Start knowing.</em></h2></div><div><p>Get your pixel and meet the people behind the numbers.</p><a className="button button-light button-large" href="/auth/login?mode=signup">Get your pixel — free <ArrowRight /></a></div></div></section><footer className="site-footer"><div className="section-wrap footer-inner"><Logo /><p>© 2026 CreatorPixel. Built for people who make things.</p><div><a href="mailto:hello@creatorpixel.app">Contact</a></div></div></footer></main> }

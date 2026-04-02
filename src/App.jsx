import { useState, useEffect, useRef, Fragment, memo } from 'react'
import { ShaderGradient, ShaderGradientCanvas } from 'shadergradient'
import { createPortal } from 'react-dom'
import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectCards } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-cards'

const SPOTIFY_CLIENT_ID = '5ee9147feda6434aa4414c48c2a472bd'
const SPOTIFY_REDIRECT  = `${window.location.origin}/callback`
const SPOTIFY_SCOPES    = 'user-read-recently-played'

function useMagnetRepel(radius = 80, strength = 0.4) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0
    let raf = null
    const lerp = 0.12

    const tick = () => {
      currentX += (targetX - currentX) * lerp
      currentY += (targetY - currentY) * lerp
      if (Math.abs(currentX - targetX) < 0.1 && Math.abs(currentY - targetY) < 0.1) {
        currentX = targetX
        currentY = targetY
      }
      el.style.transform = currentX === 0 && currentY === 0 ? '' : `translate(${currentX}px, ${currentY}px)`
      if (currentX !== 0 || currentY !== 0 || targetX !== 0 || targetY !== 0) {
        raf = requestAnimationFrame(tick)
      } else {
        raf = null
        el.style.willChange = ''
      }
    }

    const startLoop = () => { if (!raf) { el.style.willChange = 'transform'; raf = requestAnimationFrame(tick) } }

    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = cx - e.clientX
      const dy = cy - e.clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < radius) {
        const t = 1 - dist / radius
        const force = t * t * strength
        targetX = dx * force
        targetY = dy * force
      } else {
        targetX = 0
        targetY = 0
      }
      startLoop()
    }
    const onLeave = () => { targetX = 0; targetY = 0; startLoop() }
    window.addEventListener('mousemove', onMove)
    el.closest('.nav')?.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      el.closest('.nav')?.removeEventListener('mouseleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
      el.style.willChange = ''
    }
  }, [radius, strength])
  return ref
}

function formatDate(str) {
  const diff = Date.now() - new Date(str).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function cleanTitle(name) {
  return name
    .replace(/\s*[\(\[].*?[\)\]]/g, '')
    .replace(/\s+-\s+.+$/, '')
    .trim()
}

function generateVerifier() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateChallenge(verifier) {
  const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(data))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function initiateSpotifyAuth() {
  const verifier = generateVerifier()
  sessionStorage.setItem('spotify_verifier', verifier)
  generateChallenge(verifier).then(challenge => {
    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT,
      scope: SPOTIFY_SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    })
    window.location.href = `https://accounts.spotify.com/authorize?${params}`
  })
}

async function exchangeCode(code) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT,
      code_verifier: sessionStorage.getItem('spotify_verifier'),
    })
  })
  return res.json()
}

async function refreshToken(token) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: token,
    })
  })
  return res.json()
}

async function getValidToken() {
  const stored = JSON.parse(localStorage.getItem('spotify_tokens') || 'null')
  if (!stored) return null
  if (Date.now() < stored.expires_at) return stored.access_token
  const data = await refreshToken(stored.refresh_token)
  if (!data.access_token) { localStorage.removeItem('spotify_tokens'); return null }
  const tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? stored.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000 - 60000,
  }
  localStorage.setItem('spotify_tokens', JSON.stringify(tokens))
  return tokens.access_token
}
let _audioCtx = null, _audioFilter = null, _audioGain = null

function playClick(intensity = 0.4) {
  if (!_audioCtx) {
    _audioCtx = new AudioContext()
    _audioFilter = _audioCtx.createBiquadFilter()
    _audioFilter.type = 'bandpass'
    _audioFilter.Q.value = 8
    _audioGain = _audioCtx.createGain()
    _audioFilter.connect(_audioGain)
    _audioGain.connect(_audioCtx.destination)
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  const buf = _audioCtx.createBuffer(1, Math.floor(_audioCtx.sampleRate * 0.004), _audioCtx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 25)
  _audioGain.gain.value = 0.5 * intensity
  _audioFilter.frequency.value = 2000 + intensity * 2000
  const src = _audioCtx.createBufferSource()
  src.buffer = buf
  src.connect(_audioFilter)
  src.onended = () => src.disconnect()
  src.start()
}

import { Post, ArrowDownLeft, NavArrowRight, Xmark, Plus, FilterList, Check } from 'iconoir-react'
import { motion, AnimatePresence, useDragControls } from 'motion/react'
import './style.css'

const projects = [
  {
    name: 'Ritual Dental',
    desc: 'Using AI to better inform patient oral health',
    year: '2024',
    img: '/images/ritual-dental/Perio 1.png',
    href: 'https://ritualdental.com',
    linkOnly: true,
    tagline: 'Personalized preventative oral care that sticks',
    role: 'Product Designer',
    tools: 'Figma',
    team: ['Gabriel Valdivia', 'Alex Valdivia', 'Arman Ozgun', 'Daniel Chung'],
    overview: 'Ritual Dental is a next-generation dental practice using AI to form a comprehensive health perspective for prevention and early detection to boost patients quality of life.',
    timeline: 'May – June (2 months)',
    sections: [
      { id: 'gum',        heading: 'Gum Health' },
      { id: 'bacteria',   heading: 'Bacteria Table' },
      { id: 'abundance',  heading: 'Abundance levels' },
      { id: 'impact',     heading: 'Impact' },
      { id: 'outcome',       heading: 'Outcome' },
    ],
    content: [
      {
        id: 'problem',
        body: `Patients walk out of dental appointments with a treatment plan they didn't fully understand, from a conversation that felt one-sided. The clinical language, the time pressure, the authority dynamic — all of it conspires to leave people making decisions without adequate information.\n\nThe result is avoidance. People delay care, distrust recommendations, or simply disengage. The problem isn't that patients don't care about their health — it's that the system doesn't communicate with them on their terms.`,
      },
      {
        id: 'gum',
        heading: 'Gum Health',
        body: `Gum health is one of the most overlooked indicators of overall oral wellness. Patients rarely receive clear feedback about the state of their gum tissue — only that something is wrong after it's already progressed. We designed a view that communicates gum condition over time, making trends visible rather than waiting for the next appointment to surface a problem.\n\nThe goal was to make the invisible visible. Most people don't know what healthy gums look like compared to inflamed or receding tissue. By giving patients a consistent frame of reference, they can start to understand what their daily habits are actually doing.`,
      },
      {
        id: 'bacteria',
        heading: 'Bacteria Table',
        body: `The oral microbiome is complex, but its implications for health are increasingly well understood. Certain bacterial strains are directly linked to gum disease, tooth decay, and systemic conditions. Rather than hiding this data from patients, we surfaced it — translated into language that doesn't require a clinical background to interpret.\n\nThe bacteria table became one of the more distinctive parts of the product. It reframes a lab result as a story: here's what's living in your mouth, here's what that means, and here's what you can do about it. Patients found it unsettling in exactly the right way — the kind of unsettling that actually changes behavior.`,
      },
      {
        id: 'abundance',
        heading: 'Abundance levels',
        body: `Abundance levels measure how much of each bacterial strain is present relative to a healthy baseline. A single number doesn't communicate much — what matters is whether a strain is elevated, within range, or suppressed, and how that's shifted since the last reading.\n\nWe designed around the idea of relative change rather than absolute values. The interface shows whether things are moving in the right direction, which turns out to be more motivating than a static snapshot. Progress is legible at a glance, without needing to understand the underlying science.`,
      },
      {
        id: 'impact',
        heading: 'Impact',
        body: `We designed around the moment after the appointment — when patients are processing what they were told and trying to decide what to do. The AI reads the treatment notes and translates them into plain language, surfaces relevant context, and answers follow-up questions.\n\nThe interface was kept deliberately calm. No dashboards, no overwhelming data. Just a conversation that respects the user's intelligence and doesn't try to alarm them into action.`,
      },
      {
        id: 'outcome',
        heading: 'Outcome',
        body: `Patients reported feeling more confident in their treatment decisions and more likely to follow through with recommended care. The design reduced the perceived distance between the patient and their own health information — which turns out to be most of the problem.`,
        noImageAfter: true,
      },
    ],
    modalBody: `I came on as Product Designer to help lay the groundwork for the product. A lot of early decisions about how things looked and felt. We did this over the summer of 2024.`,
    modalContent: `Special thanks to`,
    collaborators: ['Gabriel Valdivia'],
    hoverText: 'THIS IS THE NEBULA',
  },
  { name: 'Goodword',              desc: 'Maintain relationships in your professional network',         year: '2024', href: 'https://www.goodword.com/', hoverText: 'A GLOW THAT NEVER ENDS' },
  { name: 'Workmate',              desc: 'Turning your inbox into an auto-updating task list',         year: '2024', href: 'https://www.workmate.com/', hoverText: 'DUSK SOAKED IN GREEN LIGHT' },
  { name: 'Sensible',              desc: 'A high yield account for your crypto',                       year: '2024', href: 'https://www.coinbase.com/en-gb/blog/Coinbase-acquires-team-to-accelerate-onchain-consumer-roadmap', hoverText: 'AND STILL, IT DRIFTS ONWARD' },
  { name: 'Dex',                   desc: 'Learning camera for children',                               year: '2025', href: 'https://www.dex.camera/', hoverText: 'FADING THE MOMENT YOU LOOK AWAY' },
  { name: 'Underline',             desc: 'An investment platform for alternative assets',              year: '2023' },
]

function useVisitorLocation() {
  const [location, setLocation] = useState(null)
  useEffect(() => {
    fetch('https://ipinfo.io/json')
      .then(r => r.json())
      .then(d => { if (d.city && d.region) setLocation(`${d.city}, ${d.region}`) })
      .catch(() => {})
  }, [])
  return location
}

function useLocalTime() {
  const fmt = () => { const d = new Date(); return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}` }
  const [time, setTime] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

function WorkFooter({ color }) {
  const time = useLocalTime()
  return (
    <footer className="work-links animate" style={{ color, transition: 'color 0.5s ease', animationDelay: '0.5s' }}>
      <div className="footer-left">
        <span className="footer-item visitor-time">{time}</span>
      </div>
    </footer>
  )
}

function GrainOverlay() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let raf
    let last = 0
    const fps = 12
    const interval = 1000 / fps
    const draw = (now) => {
      raf = requestAnimationFrame(draw)
      if (now - last < interval) return
      last = now
      const w = canvas.width  = canvas.offsetWidth
      const h = canvas.height = canvas.offsetHeight
      const img = ctx.createImageData(w, h)
      const data = img.data
      for (let i = 0; i < data.length; i += 4) {
        const v = Math.random() * 255 | 0
        data[i] = data[i+1] = data[i+2] = v
        data[i+3] = 255
      }
      ctx.putImageData(img, 0, 0)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05, pointerEvents: 'none', zIndex: 'var(--z-content)', mixBlendMode: 'overlay' }} />
}

function BackNav({ setPage }) {
  return (
    <button className="back-nav" onClick={() => setPage('work')}>
      <ArrowDownLeft width={12} height={12} strokeWidth={1.75} />
      Back
    </button>
  )
}

function Nav({ setPage }) {
  return (
    <nav className="nav">
      <button className="nav-home" onClick={() => setPage('home')}>Baltzelle</button>
    </nav>
  )
}

function ProjectDetailPage({ project, onBack, setPage }) {
  const hasSections = project.sections?.length > 0
  const [activeId, setActiveId] = useState('__intro')
  const [crumbInView, setCrumbInView] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const containerRef = useRef(null)
  const breadcrumbRef = useRef(null)
  const scrollingRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current?.closest('.page-transition')
    if (el) el.scrollTop = 0
  }, [project])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSheetOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('modal-open', sheetOpen)
    return () => document.body.classList.remove('modal-open')
  }, [sheetOpen])

  useEffect(() => {
    if (!hasSections) return
    const el = breadcrumbRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setCrumbInView(entry.isIntersecting), { threshold: 0 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasSections])

  useEffect(() => {
    if (!hasSections) return
    const container = containerRef.current
    if (!container) return
    const scrollEl = container.closest('.page-transition') ?? window
    const onScroll = () => {
      if (scrollingRef.current) return
      const scrollTop = scrollEl instanceof Element ? scrollEl.scrollTop : window.scrollY
      if (scrollTop < 80) { setActiveId('__intro'); return }
      const threshold = scrollTop + (scrollEl instanceof Element ? scrollEl.clientHeight : window.innerHeight) * 0.3
      let active = '__intro'
      for (const { id } of project.sections) {
        const el = container.querySelector(`#${id}`)
        if (el && el.offsetTop <= threshold) active = id
      }
      setActiveId(active)
    }
    scrollEl.addEventListener('scroll', onScroll)
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [project, hasSections])

  return (
    <>
    <div className={"note-layout"} ref={containerRef}>
      <TopFade />
      {hasSections && (
        <aside className="note-sidebar">
          <div className={`note-sidebar-crumb${crumbInView ? '' : ' visible'}`}>
            <button className="note-back" onClick={onBack}>Work</button>
          </div>
          <nav className="note-toc">
            <a
              className={`note-toc-item${activeId === '__intro' ? ' active' : ''}`}
              href="#"
              onClick={e => {
                e.preventDefault()
                setActiveId('__intro')
                scrollingRef.current = true
                const scrollEl = containerRef.current?.closest('.page-transition') ?? window
                scrollEl.scrollTo({ top: 0, behavior: 'smooth' })
                setTimeout(() => { scrollingRef.current = false }, 1000)
              }}
            >{project.name}</a>
            {project.sections.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`note-toc-item${activeId === s.id ? ' active' : ''}`}
                onClick={e => {
                  e.preventDefault()
                  setActiveId(s.id)
                  scrollingRef.current = true
                  containerRef.current?.querySelector(`#${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  setTimeout(() => { scrollingRef.current = false }, 1000)
                }}
              >{s.heading}</a>
            ))}
          </nav>
        </aside>
      )}
      <article className="note-article">
        <div className="note-breadcrumb" ref={breadcrumbRef}>
          <div className="note-breadcrumb-left">
            <button className="note-back" onClick={onBack}>Work</button>
            <NavArrowRight className="note-breadcrumb-sep" width={14} height={14} strokeWidth={1.75} />
            <span className="note-breadcrumb-current">{project.name}</span>
          </div>
        </div>
        {project.content.map((section, si) => (
          <Fragment key={section.id}>
            {(section.heading || section.body) && (
              <section key={section.id} id={section.id} className={`note-section${section.sectionClass ? ` ${section.sectionClass}` : ''}`}>
                {!section.noHeading && (section.heading || si === 0) && <h2 className={section.headingClass ?? 'note-section-heading'}>{section.heading ?? project.name}</h2>}
                {section.body && section.body.split('\n\n').map((p, i) => (
                  <p key={i} className={section.bodyClass ?? 'note-body'}>{p}</p>
                ))}
              </section>
            )}
            {si < project.content.length - 1 && !section.noImageAfter && (
              <div key={`img-${section.id}`} className="note-image-wrap">
                <div className="note-image-inner">
                  <div className="note-image-placeholder" />
                  <div className="grain-overlay" />
                </div>
              </div>
            )}
          </Fragment>
        ))}
      </article>
    </div>
    <div className={`sheet-backdrop note-backdrop${sheetOpen ? ' open' : ''}`} onClick={() => setSheetOpen(false)} />
    <div className={`setup-modal${sheetOpen ? ' open' : ''}`}>
      <p className="setup-modal-heading">About this project</p>
      <button className="setup-modal-close" onClick={() => setSheetOpen(false)}>
        <Xmark width={16} height={16} strokeWidth={1.75} />
      </button>
      {project.modalBody && <p>{project.modalBody}</p>}
      {(project.modalContent || project.collaborators) && (
        <p>
          {project.modalContent}
          {project.collaborators && (
            <>{' '}{project.collaborators.map((name, i) => (
              <span key={name} className="modal-collaborator">
                <span className="modal-avatar">{name.split(' ').map(n => n[0]).join('')}</span>
                {name}{i < project.collaborators.length - 1 ? (i === project.collaborators.length - 2 ? ', and ' : ', ') : ''}
              </span>
            ))}{' '}for collaborating on this.</>
          )}
        </p>
      )}
    </div>
    </>
  )
}

const SHADER_START = Date.now()

function getShaderColor() {
  const t = (Date.now() - SHADER_START) / 1000 * 0.018
  const ping = Math.abs(((t * 0.5) % 1) * 2 - 1)
  const h = 0.228 + ping * 0.01
  const s = 0.75, l = 0.45
  const f = (o) => {
    const c = Math.min(Math.max(Math.abs(((h * 6 + o) % 6) - 3) - 1, 0), 1)
    return l + s * (c - 0.5) * (1 - Math.abs(2 * l - 1))
  }
  return `rgb(${Math.round(f(0)*255)},${Math.round(f(4)*255)},${Math.round(f(2)*255)})`
}

const WorkShader = memo(() => (
  <ShaderGradientCanvas style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
    <ShaderGradient
      animate="on"
      axesHelper="off"
      brightness={1.2}
      cAzimuthAngle={0}
      cDistance={5.5}
      cPolarAngle={90}
      cameraZoom={1}
      color1="#708238"
      color2="#8A9A5B"
      color3="#556B2F"
      destination="onCanvas"
      embedMode="off"
      envPreset="city"
      format="gif"
      fov={40}
      frameRate={10}
      gizmoHelper="hide"
      grain="off"
      lightType="3d"
      pixelDensity={1.2}
      positionX={0}
      positionY={0}
      positionZ={0}
      range="disabled"
      rangeEnd={40}
      rangeStart={0}
      reflection={0.1}
      rotationX={0}
      rotationY={0}
      rotationZ={0}
      shader="defaults"
      type="waterPlane"
      uAmplitude={1}
      uDensity={0.6}
      uFrequency={5.5}
      uSpeed={0.1}
      uStrength={3.4}
      uTime={0}
      wireframe={false}
      zoomOut={false}
    />
  </ShaderGradientCanvas>
))

function WorkPage({ setPage, active }) {
  const [activeProject, setActiveProject] = useState(null)
  const [hoveredProject, setHoveredProject] = useState(null)
  const [contentKey, setContentKey] = useState(0)

  useEffect(() => {
    if (active) setContentKey(k => k + 1)
  }, [active])

  return (
    <>
      {activeProject && (
        <div key={activeProject.name} className="page-transition" style={{ position: 'absolute', inset: 0, zIndex: 'var(--z-overlay)', background: 'var(--bg, #FAF8F4)' }}>
          <ProjectDetailPage project={activeProject} onBack={() => { setActiveProject(null); setContentKey(k => k + 1) }} setPage={setPage} />
        </div>
      )}
      <div className="page" style={{ visibility: activeProject ? 'hidden' : 'visible' }}>
        <Nav setPage={setPage} />
        <div key={contentKey} className="page-content">
          <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>Work</h1>
          <ul className="projects no-bg-hover" style={{ width: '100%' }}>
            {projects.map((p, i) => (
              <li
                key={p.name}
                className={`project writing-item animate${p.dim ? ' dim' : ''}`}
                style={{ animationDelay: `${0.15 + i * 0.05}s`, '--end-opacity': p.dim ? 0.3 : 1, cursor: (p.sections || p.href) ? 'pointer' : 'not-allowed' }}
                onClick={() => { if (p.sections && !p.linkOnly) { setHoveredProject(null); setActiveProject(p) } else if (p.href) window.open(p.href, '_blank', 'noreferrer') }}
                onMouseEnter={() => { setHoveredProject(p); playClick(0.4) }}
                onMouseLeave={() => setHoveredProject(null)}
              >
                <div className="writing-item-main">
                  <span className="project-name">{p.name}</span>
                  <span className="writing-meta">{p.desc}</span>
                </div>
                <span className="writing-category">{p.year}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}





function ColophonPage({ setPage }) {
  return (
    <div className="page">
      <div className="page-content" style={{ paddingTop: '156px' }}>
        <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>Colophon</h1>
        <div className="about-text">
          <p className="animate" style={{ animationDelay: '0.15s' }}>A colophon is a tradition from print publishing — a behind-the-scenes look at how something was made. This is mine.</p>
          <h2 className="page-heading animate" style={{ animationDelay: '0.2s', marginTop: '48px' }}>Philosophy</h2>
          <p className="animate" style={{ animationDelay: '0.25s' }}>I'm deeply guided by things that have high craft, precision, and restraint. That's just my personal style. I tend to gravitate towards design that emulates these principles.</p>
          <p className="animate" style={{ animationDelay: '0.3s' }}>All of the writing on this site was done by myself so the writing quality itself might be cooked. It's not meant to be perfect, it's meant to be my true authentic self.</p>
          <h2 className="page-heading animate" style={{ animationDelay: '0.3s', marginTop: '48px' }}>Typography</h2>
          <p className="animate" style={{ animationDelay: '0.35s' }}><a href="https://displaay.net/typeface/matter/" target="_blank" rel="noreferrer" style={{ color: 'var(--light)', textDecoration: 'underline', textDecorationColor: 'var(--border-light)', textUnderlineOffset: '2px', transition: 'color 0.15s ease, text-decoration-color 0.15s ease' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--dark)'; e.currentTarget.style.textDecorationColor = 'var(--dark)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--light)'; e.currentTarget.style.textDecorationColor = 'var(--border-light)' }}>Matter by Displaay Type Foundry</a> — restrained but with enough personality in the characters to feel like mine. I studied letterforms in design school, so when it came time to build this I wanted something unique to me rather than another open-source default.</p>
          <h2 className="page-heading animate" style={{ animationDelay: '0.5s', marginTop: '48px' }}>Construction</h2>
          <p className="animate" style={{ animationDelay: '0.55s' }}>My previous site was built using Framer and I think it's still a great product, but not the best choice for me moving forward. With the advent of powerful tools like Cursor and Claude, I can go beyond the boundaries of what Framer allows, implement my ideas much quicker, and move away from another subscription. This transition has given me immense freedom.</p>
          <h2 className="page-heading animate" style={{ animationDelay: '0.6s', marginTop: '48px' }}>Domain</h2>
          <p className="animate" style={{ animationDelay: '0.65s' }}>I initially used my entire name as my domain, but that felt a bit too long. Only using my last name felt right. It's short, simple, personal, and memorable even if people can never figure out how to properly pronounce it initially. That's alright with me though, I think it feels like a gamer tag.</p>
        </div>
      </div>
    </div>
  )
}

function AboutPage({ setPage }) {
  return (
    <div className="page">
      <nav className="home-nav">
        <div className="home-nav-links">
          <a onClick={() => setPage('home')}>Work</a>
          <a className="active">About</a>
          <a onClick={() => setPage('writing')}>Misc</a>
        </div>
      </nav>
      <div className="page-content" style={{ paddingTop: '96px' }}>
        <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>About</h1>
        <div className="about-text">
          <p className="animate" style={{ animationDelay: '0.15s' }}>I am a designer currently helping craft software experiences for pre-seed and seed companies.</p>
          <p className="animate" style={{ animationDelay: '0.2s' }}>In middle school I began making designs for my online gaming profile. Eventually, this would lead me to design school, but I've really grown by building things and being exposed to others who are exceptional at their craft.</p>
          <p className="animate" style={{ animationDelay: '0.25s' }}>Currently I'm interested in code and glyph dithers. Outside of work I'm interested in baroque art, competitive CoD, and collecting niche fragrances.</p>
        </div>
        <div className="animate" style={{ animationDelay: '0.3s' }}>
          <h2 className="page-heading" style={{ marginBottom: '16px' }}>Connect</h2>
          <div className="about-links">
            <a href="mailto:mabaltzelle@gmail.com">Email</a>
            <a href="http://www.linkedin.com/in/matthew-baltzelle" target="_blank" rel="noreferrer">LinkedIn</a>
            <a href="https://x.com/bltzle" target="_blank" rel="noreferrer">Twitter</a>
          </div>
        </div>
      </div>
    </div>
  )
}

const mangaCovers = [
  { title: 'Hell\'s Paradise: Jigokuraku', volume: 'Vol. 06', src: '/images/manga/hells-paradise-06.jpg', body: 'Set in the Edo period of Japan, the series follows the journey of ninja Gabimaru and executioner Yamada Asaemon Sagiri as they search for the elixir of immortality. Multiple pairs of people with unaligned interests are thrown into an enclosed space, forced to work together.' },
  { title: 'Chainsaw Man', volume: 'Vol. 12', src: '/images/manga/chainsaw-man-12.jpg', body: 'Chainsaw Man follows the story of Denji, an impoverished teenager who makes a contract that fuses his body with that of Pochita, the dog-like Chainsaw Devil, granting him the ability to transform parts of his body into chainsaws. Denji eventually joins the Public Safety Devil Hunters, a government agency focused on combating Devils whenever they become a threat to Japan.' },
  { title: 'The Apothecary Diaries', volume: 'Vol. 10', src: '/images/manga/apothecary-diaries-10.jpg', body: 'Set in a fictional country inspired by China in the Tang Dynasty, the series follows Maomao, a girl trained in medicine by her apothecary father. After being sold as a servant to the emperor\'s palace, she secretly uses her skills to solve mysteries and help others.' },
  { title: 'Gachiakuta', volume: 'Vol. 08', src: '/images/manga/gachiakuta-08.jpg', body: 'A young teenage boy named Rudo lives in the slums of a wealthy society among the "tribesfolk", a population descended from criminals and exiled by society. Falsely charged with the murder of his foster father, Rudo is dumped into "the Pit," an endless landscape of trash below the floating city.' },
  { title: 'Jujutsu Kaisen', volume: 'Vol. 00', src: '/images/manga/jujutsu-kaisen-00.jpg', body: 'The series follows Yuta Okkotsu, a young student who becomes a sorcerer and seeks to control the Cursed Spirit of his childhood friend Rika Orimoto.' },
  { title: 'After the Rain', volume: 'Vol. 05', src: '/images/manga/after-the-rain-05.jpg', body: 'After the Rain tells the story of Akira Tachibana, a high school student working part-time at a family restaurant, who starts falling in love with the manager, Masami Kondo, a forty-five-year-old divorcee with a young son.' },
  { title: 'Fly Me to the Moon', volume: 'Vol. 13', src: '/images/manga/fly-me-to-the-moon-13.jpg', body: 'The story centers around the teenage genius Nasa Yuzaki and his developing relationship with his new wife, Tsukasa, who saves him from a traffic accident during the beginning of the story.' },
  { title: 'Frieren: Beyond Journey\'s End', volume: 'Vol. 07', src: '/images/manga/frieren-07.jpg', body: 'The series takes place in a fantasy world and follows Frieren, an elven mage on a journey to the resting place of souls to reunite with her former comrade Himmel, whose Hero Party slew the Demon King.' },
  { title: 'My Hero Academia', volume: 'Vol. 29', src: '/images/manga/my-hero-academia-29.jpg', body: 'Set in a world where superpowers called "Quirks" have become commonplace, the story follows Izuku Midoriya, a boy who was born without a Quirk but still dreams of becoming a superhero. He is scouted by the world\'s greatest hero, All Might, who bestows his Quirk to Midoriya after recognizing his potential, and helps to enroll him in a prestigious high school for superheroes in training.' },
  { title: 'Golden Kamuy', volume: 'Vol. 02', src: '/images/manga/golden-kamuy.jpg', body: 'Set in the early twentieth century, Golden Kamuy follows Saichi Sugimoto, a veteran of the Russo-Japanese War, as he searches for a hidden cache of Ainu gold in the wilderness of Hokkaido alongside a young Ainu girl named Asirpa.' },
  { title: 'Kagurabachi', volume: 'Vol. 03', src: '/images/manga/kagurabachi.jpg', body: 'Kagurabachi follows Chihiro Rokuhira, a young swordsmith whose father is murdered by a criminal organization seeking enchanted blades. Armed with one of his father\'s legendary swords, Chihiro sets out for revenge.' },
  { title: 'Fire Force', volume: 'Vol. 30', src: '/images/manga/fire-force.jpg', body: 'Set in a world where people spontaneously combust into flame-wreathed monsters called Infernals, Fire Force follows Shinra Kusakabe, a third-generation pyrokinetic who joins Special Fire Force Company 8 to uncover the truth behind the phenomenon.' },
  { title: 'That Time I Got Reincarnated as a Slime', volume: 'Vol. 19', src: '/images/manga/slime.jpg', body: 'After being killed in a random street attack, thirty-seven-year-old Satoru Mikami is reincarnated in a fantasy world as a slime with unique abilities, eventually building a nation of monsters and forging alliances with humans and demons alike.' },
  { title: 'Classroom of the Elite', volume: 'Vol. 09', src: '/images/manga/classroom-of-the-elite.jpg', body: 'Set in a prestigious high school where students are secretly ranked by ability, Classroom of the Elite follows Kiyotaka Ayanokoji, a seemingly indifferent student in the lowest-ranked class who harbors exceptional intelligence and quietly manipulates events around him.' },
  { title: 'Overlord', volume: 'Vol. 03', src: '/images/manga/overlord.jpg', body: 'When a popular fantasy game shuts down, the player Momonga finds himself trapped inside as his skeletal undead avatar. Rather than panic, he assumes the name Ainz Ooal Gown and sets out to explore this new world, accompanied by the now-sentient NPCs of his former guild.' },
]

const writings = [
  {
    title: 'Quotes from animations',
    category: 'Anime',
    type: 'anime',
  },
  {
    title: 'Collection of my favorite manga covers',
    category: 'Manga',
    type: 'manga',
  },
  {
    title: 'Recent listening',
    category: 'Music',
    type: 'music',
  },
]

function TopFade() {
  return <div className="top-fade" />
}

function NoteDetailPage({ note, onBack, setPage }) {
  const hasSections = note.sections?.length > 0
  const [activeId, setActiveId] = useState('__intro')
  const [crumbInView, setCrumbInView] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const containerRef = useRef(null)
  const breadcrumbRef = useRef(null)
  const scrollingRef = useRef(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSheetOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('modal-open', sheetOpen)
    return () => document.body.classList.remove('modal-open')
  }, [sheetOpen])

  useEffect(() => {
    if (!hasSections) return
    const el = breadcrumbRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setCrumbInView(entry.isIntersecting), { threshold: 0 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasSections])

  useEffect(() => {
    if (!hasSections) return
    const container = containerRef.current
    if (!container) return
    const scrollEl = container.closest('.page-transition') ?? window
    const onScroll = () => {
      if (scrollingRef.current) return
      const scrollTop = scrollEl instanceof Element ? scrollEl.scrollTop : window.scrollY
      if (scrollTop < 80) { setActiveId('__intro'); return }
      const threshold = scrollTop + (scrollEl instanceof Element ? scrollEl.clientHeight : window.innerHeight) * 0.3
      let active = '__intro'
      for (const { id } of note.sections) {
        const el = container.querySelector(`#${id}`)
        if (el && el.offsetTop <= threshold) active = id
      }
      setActiveId(active)
    }
    scrollEl.addEventListener('scroll', onScroll)
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [note, hasSections])

  return (
    <>
    <div className={"note-layout"} ref={containerRef}>
      <TopFade />
      {hasSections && (
        <aside className="note-sidebar">
          <div className={`note-sidebar-crumb${crumbInView ? '' : ' visible'}`}>
            <button className="note-back" onClick={onBack}>Misc</button>
          </div>
          <nav className="note-toc">
            <a
              className={`note-toc-item${activeId === '__intro' ? ' active' : ''}`}
              href="#"
              onClick={e => {
                e.preventDefault()
                setActiveId('__intro')
                scrollingRef.current = true
                const scrollEl = containerRef.current?.closest('.page-transition') ?? window
                scrollEl.scrollTo({ top: 0, behavior: 'smooth' })
                setTimeout(() => { scrollingRef.current = false }, 1000)
              }}
            >{note.title}</a>
            {note.sections.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`note-toc-item${activeId === s.id ? ' active' : ''}`}
                onClick={e => {
                  e.preventDefault()
                  setActiveId(s.id)
                  scrollingRef.current = true
                  containerRef.current?.querySelector(`#${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  setTimeout(() => { scrollingRef.current = false }, 1000)
                }}
              >{s.heading}</a>
            ))}
          </nav>
        </aside>
      )}
      <article className="note-article" style={!hasSections ? { paddingBottom: '80px' } : undefined}>
        <div className="note-breadcrumb" ref={breadcrumbRef}>
          <div className="note-breadcrumb-left">
            <button className="note-back" onClick={onBack}>Misc</button>
            <NavArrowRight className="note-breadcrumb-sep" width={14} height={14} strokeWidth={1.75} />
            <span className="note-breadcrumb-current">{note.title}</span>
          </div>
        </div>
        {note.content.map((section, si) => (
          <Fragment key={section.id}>
            {(section.heading || section.body) && (
              <section key={section.id} id={section.id} className={`note-section${section.sectionClass ? ` ${section.sectionClass}` : ''}`}>
                {!section.noHeading && (section.heading || (si === 0 && hasSections)) && <h2 className={section.headingClass ?? 'note-section-heading'}>{section.heading ?? note.title}</h2>}
                {section.body && section.body.split('\n\n').map((p, i) => (
                  <p key={i} className={section.bodyClass ?? 'note-body'}>{p}</p>
                ))}
              </section>
            )}
            {si < note.content.length - 1 && !section.noImageAfter && (
              <div key={`img-${section.id}`} className="note-image-wrap">
                <div className="note-image-inner" style={section.imgs ? { display: 'flex', gap: '8px' } : undefined}>
                  {section.imgs
                    ? section.imgs.map((src, i) => (
                        <img key={i} src={src} alt="" style={{ flex: 1, minWidth: 0, height: 'auto', display: 'block', borderRadius: 'var(--radius)' }} />
                      ))
                    : section.img
                    ? <img src={section.img} alt="" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 'var(--radius)', outline: '1px solid rgba(0,0,0,0.07)', outlineOffset: '-1px' }} />
                    : si === 1
                    ? <img src="/tumblr_8b97eed4e22307c56b8c51612a492c87_8b2d8fbc_540.gif" alt="" className="note-image-placeholder" style={{ objectFit: 'cover' }} />
                    : si === 2
                    ? <img src="/frieren.gif" alt="" className="note-image-placeholder" style={{ objectFit: 'cover' }} />
                    : si === 3
                    ? <img src="/vinland.gif" alt="" className="note-image-placeholder" style={{ objectFit: 'cover' }} />
                    : si === 4
                    ? <img src="/boji.gif" alt="" className="note-image-placeholder" style={{ objectFit: 'cover' }} />
                    : <div className="note-image-placeholder" />}
                  {!section.img && !section.imgs && <div className="grain-overlay" />}
                </div>
                {section.caption && (
                  <p className="note-image-caption">
                    {section.captionPrefix}{section.captionHref
                      ? <a href={section.captionHref} target="_blank" rel="noreferrer">{section.caption}</a>
                      : section.caption}
                  </p>
                )}
              </div>
            )}
          </Fragment>
        ))}
      </article>
    </div>
    <div className={`sheet-backdrop note-backdrop${sheetOpen ? ' open' : ''}`} onClick={() => setSheetOpen(false)} />
    <div className={`setup-modal${sheetOpen ? ' open' : ''}`}>
      <p className="setup-modal-heading">About this note</p>
      <button className="setup-modal-close" onClick={() => setSheetOpen(false)}>
        <Xmark width={16} height={16} strokeWidth={1.75} />
      </button>
      {note.sheet ? (
        <>
          <p>{note.sheet.link ? <><a href={note.sheet.link.href} target="_blank" rel="noreferrer">Matter</a>{note.sheet.body.slice('Matter'.length)}</> : note.sheet.body}</p>
        </>
      ) : (
        <p>Placeholder text for {note.title}. Add context about this piece here.</p>
      )}
    </div>
    </>
  )
}


function dedupeTracks(items) {
  const seen = new Set()
  return items.filter(({ track }) => {
    if (seen.has(track.id)) return false
    seen.add(track.id)
    return true
  })
}


const animeData = {
  watching: [
    {
      title: 'Frieren: Beyond Journey\'s End', studio: 'Madhouse', episodes: 28,
      cover: 'https://image.tmdb.org/t/p/original/dqZENchTd7lp5zht7BdlqM7RBhD.jpg',
      desc: [
        'Frieren follows an elven mage who outlives the companions she adventured with, watching decades pass like seasons. The show is less about the journey than about what gets left behind. There\'s a line in the show that has stayed with me.',
        'It\'s about magic, but it feels like it\'s really about life, about how the search itself is the thing, not what you find at the end of it. I think that\'s a beautiful way to move through the world, and something more people could stand to sit with.',
        'The most recent season is fully living up to its reputation as one of the highest rated anime ever. I\'d highly recommend it to anyone who appreciates strong animation, thoughtful storytelling, a beautiful score, and something that actually lands emotionally.',
      ],
      quote: 'The greatest joy of magic lies in searching for it.',
      quoteAttr: 'Frieren',
      quoteSource: 'Frieren: Beyond Journey\'s End',
      quoteHref: 'https://en.wikipedia.org/wiki/Frieren',
      quoteImg: '/images/quotes/frieren.gif',
    },
    {
      title: 'Avatar: The Last Airbender', studio: 'Nickelodeon', episodes: 61,
      cover: 'https://image.tmdb.org/t/p/original/9RQhVb3r3mCMqYVhLoCu4EvuipP.jpg',
      quote: 'Sometimes life is like this tunnel. You can\'t always see the light at the end of the tunnel, but if you keep moving, you will come to a better place.',
      quoteAttr: 'Iroh',
      quoteSource: 'Avatar: The Last Airbender',
      quoteHref: 'https://en.wikipedia.org/wiki/Avatar:_The_Last_Airbender',
      quoteImg: '/images/quotes/iroh.gif',
      quoteImgCrop: true,
      desc: [
        'Avatar: The Last Airbender follows Aang, the last surviving Airbender, as he works to master all four elements and bring balance to a world at war. The show is deceptively layered — built for younger audiences but genuinely rich in its themes.',
        'Uncle Iroh is the character that makes the show. His warmth, his stillness, the way he holds wisdom without ever making it feel like a lecture. The quote above is the one I keep coming back to.',
        'Few shows carry this much heart without it ever feeling forced. It earns every emotional beat it lands.',
      ],
    },
    {
      title: 'Made in Abyss', studio: 'Kinema Citrus', episodes: 25,
      cover: 'https://image.tmdb.org/t/p/original/f6U3odfIb3pCXMGKRTQGGF9o1Qg.jpg',
      quote: 'I want to go. Even if it means I can never come back.',
      quoteAttr: 'Riko',
      quoteSource: 'Made in Abyss',
      quoteHref: 'https://en.wikipedia.org/wiki/Made_in_Abyss',
      quoteImg: '/images/quotes/riko.gif',
      desc: [
        'Made in Abyss follows Riko, a young girl who descends into a vast and ancient chasm in search of her missing mother. The Abyss is beautiful and deeply hostile in equal measure.',
        'The show has a deceptive quality to it — the art style reads as warm and childlike, and then uses that against you. The world-building is meticulous, and the deeper the story goes, the more it earns its darkness.',
        'It is genuinely unlike anything else. The sense of descent, both physical and emotional, is sustained across the entire run.',
      ],
    },
    {
      title: 'Hunter x Hunter', studio: 'Madhouse', episodes: 148,
      cover: 'https://image.tmdb.org/t/p/original/i2EEr2uBvRlAwJ8d8zTG2Y19mIa.jpg',
      quote: 'Gon, you are light. Sometimes you shine so brightly, I must look away. But even so, is it still okay if I stay by your side?',
      quoteAttr: 'Killua Zoldyck',
      quoteSource: 'Hunter x Hunter',
      quoteHref: 'https://en.wikipedia.org/wiki/Hunter_%C3%97_Hunter',
      quoteImg: '/images/quotes/killua.gif',
      desc: [
        'Hunter x Hunter follows Gon Freecss, a boy who discovers his absent father is one of the world\'s greatest hunters, and sets out to find him. What begins as a straightforward adventure quickly becomes something far darker and more considered.',
        'The Chimera Ant arc is one of the most ambitious things in anime — a long, slow build that earns everything it asks of you. Madhouse gives it the visual weight it deserves.',
        'At 148 episodes it\'s a commitment, but it never feels padded. Every arc shifts the tone and raises the stakes in ways that feel earned rather than escalated.',
      ],
    },
    {
      title: 'Jujutsu Kaisen', studio: 'MAPPA', episodes: 47,
      cover: 'https://image.tmdb.org/t/p/original/fHpKWq9ayzSk8nSwqRuaAUemRKh.jpg',
      desc: [
        'Jujutsu Kaisen follows Yuji Itadori, a high schooler who swallows a cursed finger and gets pulled into a world of sorcerers and malevolent spirits. The premise moves fast and the show keeps pace with it.',
        'MAPPA\'s animation is the obvious draw — fluid, kinetic, and technically impressive in a way that holds up across the entire run. The Shibuya arc in particular is some of the most sustained high-quality animation in recent memory.',
        'Beneath the spectacle there is a show genuinely interested in what it costs to fight, and what you lose along the way. It earns the weight it eventually asks you to carry.',
      ],
    },
    {
      title: 'My Hero Academia', studio: 'Bones', episodes: 138,
      cover: 'https://image.tmdb.org/t/p/original/ivOLM47yJt90P19RH1NvJrAJz9F.jpg',
      quote: 'Who protects the heroes when they are hurting?',
      quoteAttr: 'Uraraka',
      quoteSource: 'My Hero Academia',
      quoteHref: 'https://en.wikipedia.org/wiki/My_Hero_Academia',
      quoteImg: '/images/quotes/uraraka.gif',
    },
    {
      title: 'Ranking of Kings', studio: 'Wit Studio', episodes: 23,
      cover: 'https://image.tmdb.org/t/p/original/ujMjMUi6z02uOfQEerEDC4rH6aG.jpg',
      quote: 'Because of what you are missing, you have experienced many things that an ordinary person never would. While they may be painful, they will surely help you to clear your own path. So love everything about yourself.',
      quoteAttr: 'Despa',
      quoteSource: 'Ranking of Kings',
      quoteHref: 'https://en.wikipedia.org/wiki/Ranking_of_Kings',
      quoteImg: '/images/quotes/despa.gif',
    },
  ],
  finished: [
    { title: 'Jujutsu Kaisen', studio: 'MAPPA', episodes: 47, year: 2025, cover: 'https://image.tmdb.org/t/p/original/fHpKWq9ayzSk8nSwqRuaAUemRKh.jpg' },
    { title: 'Ranking of Kings', studio: 'Wit Studio', episodes: 23, year: 2025, cover: 'https://image.tmdb.org/t/p/original/ujMjMUi6z02uOfQEerEDC4rH6aG.jpg' },
    { title: 'Mob Psycho 100', studio: 'Bones', episodes: 37, year: 2024, cover: 'https://image.tmdb.org/t/p/original/vR7hwaGQ0ySRoq1WobiNRaPs4WO.jpg' },
    { title: 'Ping Pong the Animation', studio: 'Tatsunoko', episodes: 11, year: 2024, cover: 'https://image.tmdb.org/t/p/original/frgVn3ww547TVQH8vS2bWKZnEBu.jpg' },
  ],
}


function AnimePage({ note, onBack, setPage }) {
  const [hovered, setHovered] = useState(null)
  const avatarRef = useRef(null)
  const mouse = useRef({ x: 0, y: 0 })
  const pos = useRef({ x: 0, y: 0 })
  const raf = useRef(null)

  useEffect(() => {
    if (hovered === null) {
      if (raf.current) { cancelAnimationFrame(raf.current); raf.current = null }
      return
    }
    const lerp = 0.15
    const tick = () => {
      pos.current.x += (mouse.current.x - pos.current.x) * lerp
      pos.current.y += (mouse.current.y - pos.current.y) * lerp
      if (avatarRef.current) {
        avatarRef.current.style.left = `${pos.current.x + 16}px`
        avatarRef.current.style.top = `${pos.current.y}px`
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [hovered])

  const handleMove = (e) => {
    mouse.current.x = e.clientX
    mouse.current.y = e.clientY
  }

  const handleEnter = (e, i) => {
    mouse.current.x = e.clientX
    mouse.current.y = e.clientY
    pos.current.x = e.clientX
    pos.current.y = e.clientY
    setHovered(i)
  }

  return (
    <div className="page">
      <div className="page-content" style={{ paddingTop: '156px' }}>
        <div className="note-breadcrumb-left">
          <button className="note-back" onClick={onBack}>Misc</button>
          <NavArrowRight className="note-breadcrumb-sep" width={14} height={14} strokeWidth={1.75} />
          <span className="note-breadcrumb-current">{note?.title}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {animeData.watching.filter(item => item.quote).map((item, i) => (
            <div key={i} className="quote-block" style={{ opacity: hovered !== null && hovered !== i ? 0.3 : 1 }} onMouseEnter={e => handleEnter(e, i)} onMouseMove={handleMove} onMouseLeave={() => setHovered(null)}>
              <p style={{ fontFamily: "'Gambetta', serif", fontSize: '16px', fontStyle: 'italic', color: 'var(--dark)', lineHeight: 1.75, textWrap: 'pretty' }}>{item.quote}</p>
              <p style={{ fontSize: '13px', color: 'var(--light)', marginTop: '10px' }}>— <span className="quote-name">{item.quoteAttr ?? item.title}</span>{item.quoteSource && <>, <a href={item.quoteHref} target="_blank" rel="noreferrer" style={{ color: 'var(--light)', textDecoration: 'underline', textDecorationColor: 'var(--border-light)', textUnderlineOffset: '2px', transition: 'color 0.15s ease, text-decoration-color 0.15s ease' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--dark)'; e.currentTarget.style.textDecorationColor = 'var(--dark)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--light)'; e.currentTarget.style.textDecorationColor = 'var(--border-light)' }}>{item.quoteSource}</a></>}</p>
            </div>
          ))}
        </div>
        <div ref={avatarRef} className={`quote-avatar${hovered !== null ? ' visible' : ''}`}>
          {hovered !== null && (() => {
            const item = animeData.watching.filter(item => item.quote)[hovered]
            return item?.quoteImg ? (
              <img src={item.quoteImg} alt="" className={`quote-avatar-img${item.quoteImgCrop ? ' crop' : ''}`} />
            ) : null
          })()}
        </div>
      </div>
    </div>
  )
}

function MangaPage({ note, onBack, setPage }) {
  const [openIdx, setOpenIdx] = useState(null)
  const activeCover = openIdx !== null ? mangaCovers[openIdx] : null
  const isOpen = openIdx !== null
  const isMobile = window.matchMedia('(max-width: 768px)').matches
  const dragControls = useDragControls()

  useEffect(() => {
    if (openIdx === null) return
    const content = document.querySelector('.manga-panel-content')
    if (content) content.scrollTop = 0
  }, [openIdx])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenIdx(null)
      if (e.key === 'ArrowLeft')  setOpenIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setOpenIdx(i => Math.min(mangaCovers.length - 1, i + 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen])

  useEffect(() => {
    const pageTransition = document.querySelector('.page-transition')
    if (isOpen) {
      const scrollbarWidth = pageTransition ? pageTransition.offsetWidth - pageTransition.clientWidth : 0
      document.documentElement.style.setProperty('--scrollbar-compensation', `${scrollbarWidth}px`)
      document.body.classList.add('modal-open')
      pageTransition?.classList.add('manga-page-blurred')
    } else {
      document.body.classList.remove('modal-open')
      document.documentElement.style.removeProperty('--scrollbar-compensation')
      pageTransition?.classList.remove('manga-page-blurred')
    }
    return () => {
      document.body.classList.remove('modal-open')
      document.documentElement.style.removeProperty('--scrollbar-compensation')
      pageTransition?.classList.remove('manga-page-blurred')
    }
  }, [isOpen])

  return (
    <div className="page">
      <div className="page-content" style={{ paddingTop: '156px' }}>
        <div className="note-breadcrumb-left">
          <button className="note-back" onClick={onBack}>Misc</button>
          <NavArrowRight className="note-breadcrumb-sep" width={14} height={14} strokeWidth={1.75} />
          <span className="note-breadcrumb-current">{note?.title}</span>
        </div>
        <div className="manga-grid">
          {mangaCovers.map((cover, i) => (
            <div key={i} className="manga-item">
              <button className="manga-trigger" onClick={() => { if (!isMobile) setOpenIdx(i) }}>
                <img src={cover.src} alt={`${cover.title} ${cover.volume}`} className="manga-cover" draggable="false" />
              </button>
              <div className="manga-info">
                <span className="manga-title">{cover.title}</span>
                <span className="manga-volume">{cover.volume}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="manga-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
              onClick={() => setOpenIdx(null)}
            />
            <motion.aside
              className={isMobile ? 'manga-panel manga-panel--full' : 'manga-panel'}
              initial={isMobile ? { y: '100%' } : { x: '100%' }}
              animate={isMobile ? { y: 0 } : { x: 0 }}
              exit={isMobile ? { y: '100%' } : { x: '100%' }}
              transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="manga-panel-header">
                <button className="manga-panel-close" aria-label="Close panel" onClick={() => setOpenIdx(null)}>
                  <Xmark width={18} height={18} strokeWidth={1.75} />
                </button>
              </div>
              {activeCover && (
                <div className="manga-panel-content">
                  <img src={activeCover.src} alt={`${activeCover.title} ${activeCover.volume}`} className="manga-panel-cover" draggable="false" />
                  <div className="manga-panel-info">
                    <span className="manga-panel-title">{activeCover.title}</span>
                    <span className="manga-panel-volume">{activeCover.volume}</span>
                  </div>
                  {activeCover.body && (
                    <p className="manga-panel-body">{activeCover.body}</p>
                  )}
                  <div className="manga-panel-nav">
                    {openIdx > 0 ? (
                      <button className="manga-panel-nav-btn" onClick={() => setOpenIdx(openIdx - 1)}>
                        <span className="manga-panel-label">Previous</span>
                        <span className="manga-panel-nav-title">{mangaCovers[openIdx - 1].title}</span>
                      </button>
                    ) : <span />}
                    {openIdx < mangaCovers.length - 1 ? (
                      <button className="manga-panel-nav-btn manga-panel-nav-next" onClick={() => setOpenIdx(openIdx + 1)}>
                        <span className="manga-panel-label">Next</span>
                        <span className="manga-panel-nav-title">{mangaCovers[openIdx + 1].title}</span>
                      </button>
                    ) : <span />}
                  </div>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function MusicPage({ note, onBack, setPage }) {
  const [tracks, setTracks] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('spotify_tracks')) || [] } catch { return [] }
  })
  const [loading, setLoading] = useState(() => !sessionStorage.getItem('spotify_tracks'))
  const [sort, setSort] = useState({ col: null, dir: null })
  const cycleSort = (col) => setSort(s => {
    if (col === 'played') return s.col === 'played' ? { col: null, dir: null } : { col, dir: 'asc' }
    return s.col !== col ? { col, dir: 'asc' } : s.dir === 'asc' ? { col, dir: 'desc' } : { col: null, dir: null }
  })

  const displayedTracks = sort.col
    ? [...tracks].sort((a, b) => {
        let cmp = 0
        if (sort.col === 'song')   cmp = cleanTitle(a.track.name).localeCompare(cleanTitle(b.track.name))
        if (sort.col === 'artist') cmp = a.track.artists[0]?.name.localeCompare(b.track.artists[0]?.name)
        if (sort.col === 'album')  cmp = (a.track.album?.name || '').localeCompare(b.track.album?.name || '')
        if (sort.col === 'played') cmp = new Date(a.played_at) - new Date(b.played_at)
        return sort.dir === 'asc' ? cmp : -cmp
      })
    : tracks

  useEffect(() => {
    fetch('/api/spotify')
      .then(r => r.json())
      .then(items => {
        const deduped = Array.isArray(items) ? dedupeTracks(items) : []
        setTracks(deduped)
        setLoading(false)
        sessionStorage.setItem('spotify_tracks', JSON.stringify(deduped))
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="music-page">
      <TopFade />
      <div className="music-inner animate" style={{ paddingTop: '156px', paddingBottom: '24px', animationDelay: '0.05s' }}>
        <h1 className="page-heading">Music</h1>
      </div>
      <div className="music-col-headers animate" style={{ animationDelay: '0.1s' }}>
        <div className="music-inner">
          {!loading && tracks.length > 0 && (
            <div className="music-col-headers-row">
              {[['song', 'Title'], ['artist', 'Artist'], ['album', 'Album'], ['played', 'Played']].map(([col, label]) => (
                <span key={col} className={col === 'album' ? 'music-col-album' : ''} onClick={() => cycleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', color: sort.col === col ? 'var(--dark)' : '' }}>
                  {label} {sort.col === col ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="music-scroll">
        <div className="music-inner">
          {loading ? (
            <p className="music-empty">Loading...</p>
          ) : tracks.length === 0 && ['localhost', '127.0.0.1'].includes(window.location.hostname) ? (
            <button className="music-connect" onClick={initiateSpotifyAuth}>Connect Spotify</button>
          ) : (
            <div className="music-rows">
              {displayedTracks.map(({ track, played_at }, i) => (
                <div key={i} className="music-row animate" style={{ animationDelay: `${0.1 + i * 0.03}s` }} onClick={() => window.open(track.external_urls.spotify, '_blank')} onMouseEnter={() => playClick(0.4)}>
                  <span className="music-title-cell">
                    {track.album?.images?.[2]?.url && <img src={track.album.images[2].url} alt="" className="music-thumb" style={{ flexShrink: 0, border: '1px solid var(--border-light)' }} />}
                    <span className="music-track-info">
                      <span className="music-song-name">{cleanTitle(track.name)}</span>
                      <span className="music-artist music-artist-sub">{track.artists.map(a => a.name).join(', ')}</span>
                    </span>
                  </span>
                  <span className="music-artist music-artist-col">{track.artists.map(a => a.name).join(', ')}</span>
                  <span className="music-col-album">{track.album?.name}</span>
                  <span className="music-col-date">{formatDate(played_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="music-scroll-fade" />
      </div>

    </div>
  )
}

function WritingPage({ setPage, initialNote }) {
  const [activeNote, setActiveNote] = useState(() => initialNote ? writings.find(w => w.type === initialNote) ?? null : null)
  const [animateList, setAnimateList] = useState(true)

  useEffect(() => {
    if (!animateList) return
    const t = setTimeout(() => setAnimateList(false), 1200)
    return () => clearTimeout(t)
  }, [animateList])

  if (activeNote?.type === 'music') {
    return (
      <div key={activeNote.title} className="page-transition">
        <MusicPage note={activeNote} onBack={() => { setAnimateList(true); setActiveNote(null) }} setPage={setPage} />
      </div>
    )
  }

  if (activeNote?.type === 'anime') {
    return (
      <div key={activeNote.title} className="page-transition">
        <AnimePage note={activeNote} onBack={() => { setAnimateList(true); setActiveNote(null) }} setPage={setPage} />
      </div>
    )
  }

  if (activeNote?.type === 'manga') {
    return (
      <div key={activeNote.title} className="page-transition">
        <MangaPage note={activeNote} onBack={() => { setAnimateList(true); setActiveNote(null) }} setPage={setPage} />
      </div>
    )
  }

  if (activeNote) {
    return (
      <div key={activeNote.title} className="page-transition">
        <NoteDetailPage note={activeNote} onBack={() => { setAnimateList(true); setActiveNote(null) }} setPage={setPage} />
      </div>
    )
  }

  return (
    <>
      <div className="page">
        <nav className="home-nav">
          <div className="home-nav-links">
            <a onClick={() => setPage('home')}>Work</a>
            <a onClick={() => setPage('about')}>About</a>
            <a className="active">Misc</a>
          </div>
        </nav>
        <div className="page-content" style={{ paddingTop: '96px' }}>
          <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>Miscellaneous</h1>
          <ul className="projects no-bg-hover" style={{ width: '100%' }}>
            {writings.map((w, i) => (
              <li key={w.title} className={`project writing-item${animateList ? ' animate' : ''}`} style={{ animationDelay: `${0.1 + i * 0.05}s`, cursor: 'pointer' }} onClick={() => setActiveNote(w)} onMouseEnter={() => playClick(0.4)}>
                <span className="project-name">{w.title}</span>
                {w.category && <span className="writing-category">{w.category}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}

const prototypes = [
  { title: 'Drag-to-reorder list', date: '2026-03-15' },
  { title: 'Animated page transitions', date: '2026-03-01' },
  { title: 'Scroll-linked parallax', date: '2026-02-20' },
]

function PrototypesPage({ setPage }) {
  const [activeItem, setActiveItem] = useState(null)
  const [animateList, setAnimateList] = useState(true)
  useEffect(() => {
    if (!animateList) return
    const t = setTimeout(() => setAnimateList(false), 1200)
    return () => clearTimeout(t)
  }, [animateList])

  if (activeItem) {
    return (
      <div key={activeItem.title} className="page-transition">
        <NoteDetailPage note={activeItem} onBack={() => { setAnimateList(true); setActiveItem(null) }} setPage={setPage} />
      </div>
    )
  }

  return (
    <>
      <div className="page">
        <div className="page-content" style={{ paddingTop: '156px' }}>
          <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>Play</h1>
          <ul className="projects no-bg-hover" style={{ width: '100%' }}>
            {prototypes.map((p, i) => (
              <li key={p.title} className={`project writing-item${animateList ? ' animate' : ''}`} style={{ animationDelay: `${0.1 + i * 0.05}s`, cursor: 'pointer' }} onClick={() => setActiveItem(p)} onMouseEnter={() => playClick(0.4)}>
                <span className="project-name">{p.title}</span>
                {p.date && <span className="writing-category">{`${new Date(p.date + 'T00:00').getMonth() + 1}.${new Date(p.date + 'T00:00').getDate()}.${new Date(p.date + 'T00:00').getFullYear()}`}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}

function HomePage({ setPage }) {
  const [footerColor, setFooterColor] = useState(() => getShaderColor())
  const [activeProject, setActiveProject] = useState(null)
  const [hoveredProject, setHoveredProject] = useState(null)
  const [previewSrc, setPreviewSrc] = useState(null)
  useEffect(() => {
    const id = setInterval(() => setFooterColor(getShaderColor()), 500)
    return () => clearInterval(id)
  }, [])

  if (activeProject) {
    return (
      <div className="page-transition" style={{ height: '100%' }}>
        <ProjectDetailPage project={activeProject} onBack={() => setActiveProject(null)} setPage={setPage} />
      </div>
    )
  }

  return (
    <div className="split">
      <div className="left">
        <WorkShader />
        <GrainOverlay />
        {previewSrc && (
          <img
            src={previewSrc}
            alt=""
            className={`project-preview${hoveredProject?.img ? ' active' : ''}`}
          />
        )}
        <span className="left-label" style={{ opacity: hoveredProject?.img ? 0 : 1 }}>
          {hoveredProject?.hoverText || 'Hover a project'}
        </span>
      </div>
      <div className="right">
        <nav className="home-nav">
          <div className="home-nav-links">
            <a className="active">Work</a>
            <a onClick={() => setPage('about')}>About</a>
            <a onClick={() => setPage('writing')}>Misc</a>
          </div>
        </nav>
        <div className="home-content">
          <header className="header">
            <h1 className="animate" style={{ animationDelay: '0.1s' }}>Baltzelle</h1>
            <p className="animate" style={{ animationDelay: '0.15s' }}>Designer crafting stories for early-stage companies</p>
          </header>
          <ul className="projects">
            {projects.map((p, i) => (
              <li
                key={p.name}
                className={`project animate${(!p.sections && !p.href) ? ' dim' : ''}`}
                style={{ cursor: (p.sections || p.href) ? 'pointer' : 'not-allowed', animationDelay: `${0.2 + i * 0.04}s`, '--end-opacity': (!p.sections && !p.href) ? 0.3 : 1 }}
                onClick={() => { if (p.sections && !p.linkOnly) setActiveProject(p); else if (p.href) window.open(p.href, '_blank', 'noreferrer') }}
                onMouseEnter={() => { setHoveredProject(p); if (p.img) setPreviewSrc(p.img); playClick(0.4) }}
                onMouseLeave={() => setHoveredProject(null)}
              >
                <span className="project-name">{p.name}</span>
                <span className="project-desc">{p.desc}</span>
                <span className="project-leader" />
                <span className="project-year">{p.year}</span>
              </li>
            ))}
          </ul>
        </div>
        <WorkFooter color={footerColor} />
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('home')

  useEffect(() => {
    const titles = { home: 'Baltzelle', about: 'About', writing: 'Misc', 'writing-music': 'Misc', prototypes: 'Play' }
    document.title = titles[page] ?? 'Baltzelle'
  }, [page])


  useEffect(() => {
    const handler = (e) => {
      if (getComputedStyle(e.target).cursor === 'pointer') playClick(0.3)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  useEffect(() => {
    mangaCovers.forEach(c => { const img = new Image(); img.src = c.src })
  }, [])

  useEffect(() => {
    if (window.location.pathname !== '/callback') return
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) return
    exchangeCode(code).then(data => {
      if (data.access_token) {
        localStorage.setItem('spotify_tokens', JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Date.now() + data.expires_in * 1000 - 60000,
        }))
      }
      window.history.replaceState({}, '', '/')
      setPage('writing')
    })
  }, [])

  return (
    <div style={{ height: '100%' }}>
      {page === 'home'       && <HomePage       setPage={setPage} />}
      {page === 'about'      && <AboutPage      setPage={setPage} />}
      {page === 'writing'    && <WritingPage    setPage={setPage} />}
      {page === 'prototypes' && <PrototypesPage setPage={setPage} />}
    </div>
  )
}

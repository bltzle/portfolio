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
    el.style.willChange = 'transform'
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
      }
    }

    const startLoop = () => { if (!raf) raf = requestAnimationFrame(tick) }

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
import './style.css'

const projects = [
  {
    name: 'Ritual Dental',
    desc: 'Using AI to better inform patient oral health',
    year: '2024',
    img: '/images/ritual-dental/Perio 1.png',
    href: 'https://ritualdental.com',
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
  },
  { name: 'Goodword',              desc: 'Maintain relationships in your professional network',         year: '2024' },
  { name: 'Workmate',              desc: 'Turning your inbox into an auto-updating task list',         year: '2024' },
  { name: 'Sensible',              desc: 'A high yield account for your crypto',                       year: '2024' },
  { name: 'Dex',                   desc: 'Learning camera for children',                               year: '2025' },
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
  const fmt = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const [time, setTime] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

function WorkFooter({ color }) {
  const location = useVisitorLocation()
  const time = useLocalTime()
  return (
    <div className="work-links" style={{ color, transition: 'color 0.5s ease' }}>
      <span className="visitor-location">Last visitor from <span className="visitor-location-value">{location ?? '—'}</span></span>
      <span className="visitor-location visitor-time">{time}</span>
    </div>
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
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05, pointerEvents: 'none', zIndex: 2, mixBlendMode: 'overlay' }} />
}

function BackNav({ setPage }) {
  return (
    <button className="back-nav" onClick={() => setPage('work')}>
      <ArrowDownLeft width={12} height={12} strokeWidth={1.75} />
      Back
    </button>
  )
}

function Nav({ setPage, hueDeg = 0 }) {
  return (
    <nav className="nav">
      <img
        src="https://img.pokemondb.net/sprites/black-white/anim/normal/lugia.gif"
        alt=""
        className="nav-logo"
        onClick={() => setPage('home')}
        style={{ cursor: 'pointer', filter: `hue-rotate(${hueDeg}deg)`, transition: 'filter 0.3s ease' }}
      />
    </nav>
  )
}

function ProjectDetailPage({ project, onBack, setPage, hueDeg = 0 }) {
  const hasSections = project.sections?.length > 0
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
          <img src="https://img.pokemondb.net/sprites/black-white/anim/normal/lugia.gif" alt="" className="nav-logo" onClick={onBack} style={{ position: 'absolute', top: '48px', left: '140px', cursor: 'pointer', filter: `hue-rotate(${hueDeg}deg)`, transition: 'filter 0.3s ease' }} />
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

function WorkPage({ setPage, active, hueDeg = 0 }) {
  const [activeProject, setActiveProject] = useState(null)
  const [hoveredProject, setHoveredProject] = useState(null)
  const [contentKey, setContentKey] = useState(0)

  useEffect(() => {
    if (active) setContentKey(k => k + 1)
  }, [active])

  return (
    <>
      {activeProject && (
        <div key={activeProject.name} className="page-transition" style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--bg, #FAF8F4)' }}>
          <ProjectDetailPage project={activeProject} onBack={() => { setActiveProject(null); setContentKey(k => k + 1) }} setPage={setPage} hueDeg={hueDeg} />
        </div>
      )}
      <div className="page" style={{ visibility: activeProject ? 'hidden' : 'visible' }}>
        <Nav setPage={setPage} hueDeg={hueDeg} />
        <div key={contentKey} className="page-content">
          <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>Work</h1>
          <ul className="projects no-bg-hover" style={{ width: '100%' }}>
            {projects.map((p, i) => (
              <li
                key={p.name}
                className={`project writing-item animate${p.dim ? ' dim' : ''}`}
                style={{ animationDelay: `${0.15 + i * 0.05}s`, '--end-opacity': p.dim ? 0.4 : 1, cursor: p.sections ? 'pointer' : 'not-allowed' }}
                onClick={() => { if (p.sections) { setHoveredProject(null); setActiveProject(p) } }}
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





function ColophonPage({ setPage, hueDeg = 0 }) {
  return (
    <div className="page">
      <Nav setPage={setPage} hueDeg={hueDeg} />
      <div className="page-content">
        <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>Colophon</h1>
        <div className="about-text">
          <p className="animate" style={{ animationDelay: '0.15s' }}>A colophon is a tradition from print publishing — a behind-the-scenes look at how something was made. This is mine.</p>
          <h2 className="page-heading animate" style={{ animationDelay: '0.2s', marginTop: '48px' }}>Philosophy</h2>
          <p className="animate" style={{ animationDelay: '0.25s' }}>I'm deeply guided by things that have high craft, precision, and restraint. That's just my personal style. I tend to gravitate towards design that emulates these principles.</p>
          <p className="animate" style={{ animationDelay: '0.28s' }}>All of the writing on this site was done by myself so the writing quality itself might be cooked. It's not meant to be perfect, it's meant to be my true authentic self.</p>
          <h2 className="page-heading animate" style={{ animationDelay: '0.3s', marginTop: '48px' }}>Typography</h2>
          <p className="animate" style={{ animationDelay: '0.35s' }}>I had never even considered purchasing a typeface before because there are plenty of great open source alternatives. The issue was that every time I tried one out and set the copy it just didn't sit right with me so I set out to find one I liked.</p>
          <p className="animate" style={{ animationDelay: '0.4s' }}><a href="https://displaay.net/typeface/matter/" target="_blank" rel="noreferrer" style={{ color: 'var(--light)', textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.1)', textUnderlineOffset: '2px', transition: 'color 0.15s ease, text-decoration-color 0.15s ease' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--dark)'; e.currentTarget.style.textDecorationColor = 'var(--dark)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--light)'; e.currentTarget.style.textDecorationColor = 'rgba(0,0,0,0.1)' }}>Matter by Displaay Type Foundry</a> is the typeface I chose to license for this site. I chose to purchase the regular and medium weights which were sufficient for me. It still remains restrained, but with a bit of personality to the characters.</p>
          <p className="animate" style={{ animationDelay: '0.45s' }}>I studied typography in design school and took a class on letter forms and type. This was probably the single most enjoyable and valuable class for me. So when it came time to build this site I wanted something a bit more unique. I'm the creative director here so I want every aspect to be true to me and Matter felt like the one.</p>
          <h2 className="page-heading animate" style={{ animationDelay: '0.5s', marginTop: '48px' }}>Construction</h2>
          <p className="animate" style={{ animationDelay: '0.55s' }}>My previous site was built using Framer and I think it's still a great product, but not the best choice for me moving forward. With the advent of powerful tools like Cursor and Claude, I can go beyond the boundaries of what Framer allows, implement my ideas much quicker, and move away from another subscription. This transition has given me immense freedom.</p>
          <h2 className="page-heading animate" style={{ animationDelay: '0.6s', marginTop: '48px' }}>Domain</h2>
          <p className="animate" style={{ animationDelay: '0.65s' }}>I initially used my entire name as my domain, but that felt a bit too long. Only using my last name felt right. It's short, simple, personal, and memorable even if people can never figure out how to properly pronounce it initially. That's alright with me though, I think it feels like a gamer tag.</p>
        </div>
      </div>
    </div>
  )
}

function AboutPage({ setPage, hueDeg = 0 }) {
  return (
    <div className="page">
      <Nav setPage={setPage} hueDeg={hueDeg} />
      <div className="page-content">
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

const writings = [
  {
    title: 'Music I\'m listening to',
    date: '2026-03-12',
    type: 'music',
  },
  {
    title: 'Quotes from animations',
    date: '2026-02-18',
    type: 'anime',
  },
]

function TopFade() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 8,
      height: '120px',
      pointerEvents: 'none',
      zIndex: 5,
      background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 40%, rgba(255,255,255,0) 100%)',
    }} />
  )
}

function NoteDetailPage({ note, onBack, setPage, hueDeg = 0 }) {
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
            <button className="note-back" onClick={onBack}>Notes</button>
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
            <button className="note-back" onClick={onBack}>Notes</button>
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
    },
    {
      title: 'Avatar: The Last Airbender', studio: 'Nickelodeon', episodes: 61,
      cover: 'https://image.tmdb.org/t/p/original/9RQhVb3r3mCMqYVhLoCu4EvuipP.jpg',
      quote: 'Sometimes life is like this tunnel. You can\'t always see the light at the end of the tunnel, but if you keep moving, you will come to a better place.',
      quoteAttr: 'Iroh',
      quoteSource: 'Avatar: The Last Airbender',
      quoteHref: 'https://en.wikipedia.org/wiki/Avatar:_The_Last_Airbender',
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
      desc: [
        'Hunter x Hunter follows Gon Freecss, a boy who discovers his absent father is one of the world\'s greatest hunters, and sets out to find him. What begins as a straightforward adventure quickly becomes something far darker and more considered.',
        'The Chimera Ant arc is one of the most ambitious things in anime — a long, slow build that earns everything it asks of you. Madhouse gives it the visual weight it deserves.',
        'At 148 episodes it\'s a commitment, but it never feels padded. Every arc shifts the tone and raises the stakes in ways that feel earned rather than escalated.',
      ],
    },
    {
      title: 'Jujutsu Kaisen', studio: 'MAPPA', episodes: 47,
      cover: 'https://image.tmdb.org/t/p/original/fHpKWq9ayzSk8nSwqRuaAUemRKh.jpg',
      quote: 'No matter how many people you\'ve saved, you have no right to take a human life.',
      quoteAttr: 'Nanami Kento',
      quoteSource: 'Jujutsu Kaisen',
      quoteHref: 'https://en.wikipedia.org/wiki/Jujutsu_Kaisen',
      desc: [
        'Jujutsu Kaisen follows Yuji Itadori, a high schooler who swallows a cursed finger and gets pulled into a world of sorcerers and malevolent spirits. The premise moves fast and the show keeps pace with it.',
        'MAPPA\'s animation is the obvious draw — fluid, kinetic, and technically impressive in a way that holds up across the entire run. The Shibuya arc in particular is some of the most sustained high-quality animation in recent memory.',
        'Beneath the spectacle there is a show genuinely interested in what it costs to fight, and what you lose along the way. It earns the weight it eventually asks you to carry.',
      ],
    },
  ],
  finished: [
    { title: 'Jujutsu Kaisen', studio: 'MAPPA', episodes: 47, year: 2025, cover: 'https://image.tmdb.org/t/p/original/fHpKWq9ayzSk8nSwqRuaAUemRKh.jpg' },
    { title: 'Ranking of Kings', studio: 'Wit Studio', episodes: 23, year: 2025, cover: 'https://image.tmdb.org/t/p/original/ujMjMUi6z02uOfQEerEDC4rH6aG.jpg' },
    { title: 'Mob Psycho 100', studio: 'Bones', episodes: 37, year: 2024, cover: 'https://image.tmdb.org/t/p/original/vR7hwaGQ0ySRoq1WobiNRaPs4WO.jpg' },
    { title: 'Ping Pong the Animation', studio: 'Tatsunoko', episodes: 11, year: 2024, cover: 'https://image.tmdb.org/t/p/original/frgVn3ww547TVQH8vS2bWKZnEBu.jpg' },
  ],
}


function AnimePage({ note, onBack, setPage, hueDeg = 0 }) {
  return (
    <div className="page">
      <Nav setPage={setPage} hueDeg={hueDeg} />
      <div className="page-content">
        <div className="note-breadcrumb-left">
          <button className="note-back" onClick={onBack}>Notes</button>
          <NavArrowRight className="note-breadcrumb-sep" width={14} height={14} strokeWidth={1.75} />
          <span className="note-breadcrumb-current">{note?.title}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {animeData.watching.filter(item => item.quote).map((item, i) => (
            <div key={i}>
              <p style={{ fontFamily: "'Gambetta', serif", fontSize: '16px', fontStyle: 'italic', color: 'var(--dark)', lineHeight: 1.75, textAlign: 'justify', textWrap: 'pretty' }}>{item.quote}</p>
              <p style={{ fontSize: '13px', color: 'var(--light)', marginTop: '10px' }}>— {item.quoteAttr ?? item.title}{item.quoteSource && <>, <a href={item.quoteHref} target="_blank" rel="noreferrer" style={{ color: 'var(--light)', textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.1)', textUnderlineOffset: '2px', transition: 'color 0.15s ease, text-decoration-color 0.15s ease' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--dark)'; e.currentTarget.style.textDecorationColor = 'var(--dark)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--light)'; e.currentTarget.style.textDecorationColor = 'rgba(0,0,0,0.1)' }}>{item.quoteSource}</a></>}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MusicPage({ note, onBack, setPage, hueDeg = 0 }) {
  const cached = localStorage.getItem('spotify_tracks')
  const [tracks, setTracks] = useState(cached ? dedupeTracks(JSON.parse(cached)) : [])
  const [loading, setLoading] = useState(!cached)
  const [authed, setAuthed] = useState(!!localStorage.getItem('spotify_tokens'))
  const [sort, setSort] = useState({ col: null, dir: null })
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSheetOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const cycleSort = (col) => setSort(s => {
    if (col === 'played') return s.col === 'played' ? { col: null, dir: null } : { col, dir: 'asc' }
    return s.col !== col ? { col, dir: 'asc' } : s.dir === 'asc' ? { col, dir: 'desc' } : { col: null, dir: null }
  })

  const displayedTracks = sort.col
    ? [...tracks].sort((a, b) => {
        let cmp = 0
        if (sort.col === 'song')   cmp = cleanTitle(a.track.name).localeCompare(cleanTitle(b.track.name))
        if (sort.col === 'artist') cmp = a.track.artists[0]?.name.localeCompare(b.track.artists[0]?.name)
        if (sort.col === 'played') cmp = new Date(a.played_at) - new Date(b.played_at)
        return sort.dir === 'asc' ? cmp : -cmp
      })
    : tracks

  useEffect(() => {
    if (!authed) { setLoading(false); return }
    async function load() {
      const token = await getValidToken()
      if (!token) { setAuthed(false); setLoading(false); return }
      const res = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      const existing = JSON.parse(localStorage.getItem('spotify_tracks') || '[]')
      const merged = dedupeTracks([...(data.items ?? []), ...existing])
      localStorage.setItem('spotify_tracks', JSON.stringify(merged))
      setTracks(merged)
setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [authed])

  return (
    <>
    <div className="music-page">
      <TopFade />
      <div className="music-scroll-fade" />
      <div style={{ maxWidth: '860px', width: '100%', margin: '0 auto', padding: '48px 48px 100px', position: 'relative', zIndex: 11 }}>
        <img src="https://img.pokemondb.net/sprites/black-white/anim/normal/lugia.gif" alt="" className="nav-logo" onClick={() => setPage('home')} style={{ cursor: 'pointer', filter: `hue-rotate(${hueDeg}deg)`, transition: 'filter 0.3s ease' }} />
      </div>
      <div className="music-col-headers">
        <div className="music-inner">
          <div className="music-breadcrumb">
            <div className="note-breadcrumb-left">
              <button className="music-back-arrow" onClick={onBack}>Notes</button>
              <NavArrowRight className="music-breadcrumb-sep" width={12} height={12} />
              <span className="music-breadcrumb-current">{note?.title}</span>
            </div>
            <button className="note-info-btn" aria-label="Setup" onClick={() => setSheetOpen(true)}>
              <Post width={16} height={16} strokeWidth={1.75} />
            </button>
          </div>
          {!loading && authed && (
            <div className="music-col-headers-row">
              {[['song', 'Title'], ['artist', 'Artist'], ['played', 'Played']].map(([col, label]) => (
                <span key={col} onClick={() => cycleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', color: sort.col === col ? 'var(--dark)' : '' }}>
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
          ) : !authed ? (
            <button className="music-connect" onClick={initiateSpotifyAuth}>Connect Spotify</button>
          ) : (
            <div className="music-rows">
              {displayedTracks.map(({ track, played_at }, i) => (
                <div key={i} className="music-row" onClick={() => window.open(track.external_urls.spotify, '_blank')} onMouseEnter={() => playClick(0.4)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    {track.album?.images?.[2]?.url && <img src={track.album.images[2].url} alt="" style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, border: '1px solid rgba(0,0,0,0.06)' }} />}
                    <span className="music-song-name">{cleanTitle(track.name)}</span>
                  </span>
                  <span className="music-artist">{track.artists.map(a => a.name).join(', ')}</span>
                  <span className="music-col-date">{formatDate(played_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>

      {/* Setup modal */}
      <div className={`sheet-backdrop note-backdrop${sheetOpen ? ' open' : ''}`} onClick={() => setSheetOpen(false)} />
      <div className={`setup-modal${sheetOpen ? ' open' : ''}`}>
        <p className="setup-modal-heading">Setup</p>
        <button className="setup-modal-close" onClick={() => setSheetOpen(false)}>
          <Xmark width={16} height={16} strokeWidth={1.75} />
        </button>
        <p>I love music. I'm not too concerned with critical listening, but good sound changes how music&nbsp;feels.</p>
        <p>Currently alternating between the <a href="https://mezeaudio.com/products/109-pro" target="_blank" rel="noreferrer">Meze 109 Pro</a> and <a href="https://shop.zmfheadphones.com/collections/stock-headphones/products/bokeh-open-copy" target="_blank" rel="noreferrer">ZMF Bokeh Open</a>, paired with the <a href="https://www.fiio.com/k11r2r" target="_blank" rel="noreferrer">FiiO K11&nbsp;R2R</a>. I strongly encourage you to try listening to music with some nice wired gear if you ever get the&nbsp;opportunity.</p>
      </div>
    </>
  )
}

function WritingPage({ setPage, initialNote, hueDeg = 0 }) {
  const [activeNote, setActiveNote] = useState(() => initialNote ? writings.find(w => w.type === initialNote) ?? null : null)
  const [animateList, setAnimateList] = useState(true)
  const [easterEgg, setEasterEgg] = useState(false)
  useEffect(() => {
    if (!animateList) return
    const t = setTimeout(() => setAnimateList(false), 1200)
    return () => clearTimeout(t)
  }, [animateList])

  if (activeNote?.type === 'music') {
    return (
      <div key={activeNote.title} className="page-transition">
        <MusicPage note={activeNote} onBack={() => { setAnimateList(true); setActiveNote(null) }} setPage={setPage} hueDeg={hueDeg} />
      </div>
    )
  }

  if (activeNote?.type === 'anime') {
    return (
      <div key={activeNote.title} className="page-transition">
        <AnimePage note={activeNote} onBack={() => { setAnimateList(true); setActiveNote(null) }} setPage={setPage} hueDeg={hueDeg} />
      </div>
    )
  }

  if (activeNote) {
    return (
      <div key={activeNote.title} className="page-transition">
        <NoteDetailPage note={activeNote} onBack={() => { setAnimateList(true); setActiveNote(null) }} setPage={setPage} hueDeg={hueDeg} />
      </div>
    )
  }

  return (
    <>
      <div className="page">
        <Nav setPage={setPage} hueDeg={hueDeg} />
        <div className="page-content">
          <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>Notes<span style={{ color: 'rgba(0,0,0,0.06)', cursor: 'pointer' }} onClick={() => setEasterEgg(e => !e)}>{easterEgg ? <span style={{ color: 'var(--light)', fontWeight: 400 }}> — do people actually read these?</span> : ' ...'}</span></h1>
          <ul className="projects no-bg-hover" style={{ width: '100%' }}>
            {writings.map((w, i) => (
              <li key={w.title} className={`project writing-item${animateList ? ' animate' : ''}`} style={{ animationDelay: `${0.1 + i * 0.05}s`, cursor: 'pointer' }} onClick={() => setActiveNote(w)} onMouseEnter={() => playClick(0.4)}>
                <span className="project-name">{w.title}</span>
                {w.date && <span className="writing-category">{`${new Date(w.date + 'T00:00').getMonth() + 1}.${new Date(w.date + 'T00:00').getDate()}.${new Date(w.date + 'T00:00').getFullYear()}`}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}

const HUE_STEP = 36

function HomePage({ setPage, hueDeg = 0, setHueDeg }) {
  const [footerColor, setFooterColor] = useState(() => getShaderColor())
  const [activeProject, setActiveProject] = useState(null)
  const logoRef = useMagnetRepel()
  useEffect(() => {
    const id = setInterval(() => setFooterColor(getShaderColor()), 500)
    return () => clearInterval(id)
  }, [])

  const hue = hueDeg

  const categories = [
    { label: 'About',                  desc: 'Me',          page: 'about'      },
    { label: 'Notes',                  desc: 'Resources',  page: 'writing'    },
    { label: 'Play', desc: 'Experiments', page: 'prototypes' },
    { label: 'Colophon',               desc: 'Details',              page: 'colophon'   },
  ]

  if (activeProject) {
    return (
      <div className="page-transition" style={{ height: '100%' }}>
        <ProjectDetailPage project={activeProject} onBack={() => setActiveProject(null)} setPage={setPage} hueDeg={hueDeg} />
      </div>
    )
  }

  return (
    <div className="page">
      <nav className="nav">
        <img
          ref={logoRef}
          src="https://img.pokemondb.net/sprites/black-white/anim/normal/lugia.gif"
          alt=""
          className="nav-logo"
          style={{ cursor: 'pointer', filter: `hue-rotate(${hue}deg)`, transition: 'filter 0.3s ease' }}
          onClick={() => setHueDeg(d => d + HUE_STEP)}
        />
      </nav>
      <div className="page-content">
        <h1 className="page-heading animate" style={{ animationDelay: '0.1s', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span>Baltzelle</span>
          <span style={{ color: 'var(--light)', fontWeight: 400, lineHeight: 1.6 }}>Software Designer crafting stories for early-stage companies</span>
        </h1>
        <h2 className="page-heading animate" style={{ animationDelay: '0.12s', marginTop: '24px' }}>Projects</h2>
        <hr className="animate" style={{ animationDelay: '0.14s', border: 'none', borderTop: '1px solid rgba(0,0,0,0.06)', width: '100%', marginTop: '-24px' }} />
        <ul className="projects no-bg-hover" style={{ width: '100%', marginTop: '-32px' }}>
          {projects.map((p, i) => (
            <li
              key={p.name}
              className={`project animate${p.dim ? ' dim' : ''}`}
              style={{ animationDelay: `${0.15 + i * 0.05}s`, '--end-opacity': p.dim ? 0.4 : 1, cursor: p.sections ? 'pointer' : 'not-allowed' }}
              onClick={() => { if (p.sections) setActiveProject(p) }}
              onMouseEnter={() => playClick(0.4)}
            >
              <span className="project-name">{p.name}</span>
              <span className="project-desc">{p.desc}</span>
              <span className="project-year">{p.year}</span>
            </li>
          ))}
        </ul>
        <div className="nav-cards animate" style={{ animationDelay: '0.5s' }}>
          {categories.map((c) => (
            <div key={c.label} className="nav-card" onClick={() => setPage(c.page)} onMouseEnter={() => playClick(0.4)}>
              <span className="nav-card-label">{c.label}</span>
              <span className="nav-card-desc">{c.desc}</span>
            </div>
          ))}
        </div>
      </div>
      <WorkFooter color={footerColor} />
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('home')
  const [hueDeg, setHueDeg] = useState(0)

  useEffect(() => {
    const titles = { home: 'Baltzelle', about: 'About', colophon: 'Colophon', writing: 'Notes', 'writing-music': 'Notes' }
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
      setPage('writing-music')
    })
  }, [])

  return (
    <div style={{ height: '100%' }}>
      {page === 'home'    && <HomePage    setPage={setPage} hueDeg={hueDeg} setHueDeg={setHueDeg} />}
      {page === 'about'    && <AboutPage    setPage={setPage} hueDeg={hueDeg} />}
      {page === 'colophon' && <ColophonPage setPage={setPage} hueDeg={hueDeg} />}
      {(page === 'writing' || page === 'writing-music') && <WritingPage setPage={setPage} initialNote={page === 'writing-music' ? 'music' : null} hueDeg={hueDeg} />}
    </div>
  )
}

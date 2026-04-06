import { useState, useEffect, useLayoutEffect, useRef, useCallback, Fragment, memo } from 'react'
import { ShaderGradient, ShaderGradientCanvas } from 'shadergradient'
import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectCards } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-cards'

const SPOTIFY_CLIENT_ID = '5ee9147feda6434aa4414c48c2a472bd'
const SPOTIFY_REDIRECT  = `${window.location.origin}/callback`
const SPOTIFY_SCOPES    = 'user-read-recently-played'

function formatDate(str) {
  const d = new Date(str)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${mm}/${dd}/${yy}`
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

import { ArrowDownLeft, Xmark, LongArrowUpLeft, OpenNewWindow } from 'iconoir-react'

import { motion, AnimatePresence, useDragControls, useMotionValue, animate as motionAnimate } from 'motion/react'
import './style.css'

const projects = [
  {
    name: 'Ritual Dental',
    desc: 'Using AI to better inform patient oral health',
    year: '2024',
    img: '/images/ritual-dental/cover.png',
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
        img: '/images/ritual-dental/1.png',
      },
      {
        id: 'gum',
        heading: 'Gum Health',
        body: `Gum health is one of the most overlooked indicators of overall oral wellness. Patients rarely receive clear feedback about the state of their gum tissue — only that something is wrong after it's already progressed. We designed a view that communicates gum condition over time, making trends visible rather than waiting for the next appointment to surface a problem.\n\nThe goal was to make the invisible visible. Most people don't know what healthy gums look like compared to inflamed or receding tissue. By giving patients a consistent frame of reference, they can start to understand what their daily habits are actually doing.`,
        img: '/images/ritual-dental/2.png',
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
  { name: 'Workmate',              desc: 'Turning your inbox into an auto-updating task list',         year: '2024', img: '/images/workmate/cover.png', href: 'https://www.workmate.com/' },
  { name: 'Goodword',              desc: 'Maintain relationships in your professional network',         year: '2024', img: '/images/goodword/Cover.png', href: 'https://www.goodword.com/' },
  { name: 'Sensible',              desc: 'A high yield account for your crypto',                       year: '2024', img: '/images/sensible/Sensible.png', href: 'https://www.coinbase.com/en-gb/blog/Coinbase-acquires-team-to-accelerate-onchain-consumer-roadmap' },
  { name: 'Dex',                   desc: 'Learning camera for children',                               year: '2025', img: '/images/dex/cover.png', previewSize: '50%', href: 'https://www.dex.camera/' },
  { name: 'Underline',             desc: 'An investment platform for alternative assets',              year: '2023', img: '/images/underline/Referral View.png' },
]

function useLocalTime() {
  const fmt = () => { const d = new Date(); return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}` }
  const [time, setTime] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

function WorkFooter({ setPage }) {
  const time = useLocalTime()
  return (
    <footer className="work-footer">
      <div className="footer-row">
        <span className="footer-item visitor-time animate" style={{ animationDelay: '0.5s' }}>{time}</span>
        <span className="footer-item animate" style={{ animationDelay: '0.55s' }}>San Francisco, CA</span>
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
  const [sheetOpen, setSheetOpen] = useState(false)
  const containerRef = useRef(null)
  const scrollingRef = useRef(false)

  useEffect(() => {
    const scrollEl = document.getElementById('app')
    if (scrollEl) scrollEl.scrollTop = 0
    else window.scrollTo(0, 0)
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
    const container = containerRef.current
    if (!container) return
    const scrollEl = document.getElementById('app') ?? document.documentElement
    const trigger = window.innerHeight * 0.35
    const onScroll = () => {
      if (scrollingRef.current) return
      if (scrollEl.scrollTop < 80) { setActiveId('__intro'); return }
      let active = '__intro'
      for (const { id } of project.sections) {
        const el = container.querySelector(`#${id}`)
        if (el && el.getBoundingClientRect().top <= trigger) active = id
      }
      setActiveId(active)
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [project, hasSections])

  return (
    <>
    <div className={"note-layout"} ref={containerRef}>
      <TopFade />
      {hasSections && (
        <aside className="note-sidebar">
          <button className="back-btn" onClick={onBack} aria-label="Back">
            <LongArrowUpLeft width={16} height={16} strokeWidth={1.75} />
          </button>
          <nav className="note-toc">
            <a
              className={`note-toc-item${activeId === '__intro' ? ' active' : ''}`}
              href="#"
              onClick={e => {
                e.preventDefault()
                setActiveId('__intro')
                scrollingRef.current = true
                const scrollEl = document.getElementById('app') ?? document.documentElement
                scrollEl.scrollTo({ top: 0, behavior: 'smooth' })
                setTimeout(() => { scrollingRef.current = false }, 1000)
              }}
            >Intro</a>
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
        {(project.tagline || project.role || project.overview) && (
          <div className="project-meta">
            <div className="project-meta-header">
              <h2 className="project-meta-title">{project.name}</h2>
              {project.tagline && <p className="project-meta-tagline">{project.tagline}</p>}
            </div>
            <div className="project-meta-separator" />
            <div className="project-meta-grid">
              {project.role && (
                <div className="project-meta-field">
                  <span className="project-meta-label">Role</span>
                  <span className="project-meta-value">{project.role}</span>
                </div>
              )}
              {project.tools && (
                <div className="project-meta-field">
                  <span className="project-meta-label">Tools</span>
                  <span className="project-meta-value">{project.tools}</span>
                </div>
              )}
              {project.team && (
                <div className="project-meta-field">
                  <span className="project-meta-label">Team</span>
                  <span className="project-meta-value">{project.team.map((name, i) => <span key={i}>{name}<br/></span>)}</span>
                </div>
              )}
              {project.overview && (
                <div className="project-meta-field">
                  <span className="project-meta-label">Overview</span>
                  <span className="project-meta-value">{project.overview}</span>
                </div>
              )}
            </div>
            {project.timeline && (
              <>
                <div className="project-meta-field" style={{ marginTop: '24px' }}>
                  <span className="project-meta-label">Timeline</span>
                  <span className="project-meta-value">{project.timeline}</span>
                </div>
              </>
            )}
          </div>
        )}
        {project.content.map((section, si) => (
          <Fragment key={section.id}>
            {(section.heading || section.body) && (
              <section key={section.id} id={section.id} className={`note-section${section.sectionClass ? ` ${section.sectionClass}` : ''}`}>
                {!section.noHeading && (section.heading || si === 0) && <h2 className={section.headingClass ?? 'note-section-heading'}>{section.heading ?? 'Intro'}</h2>}
                {section.body && section.body.split('\n\n').map((p, i) => (
                  <p key={i} className={section.bodyClass ?? 'note-body'}>{p}</p>
                ))}
              </section>
            )}
            {si < project.content.length - 1 && !section.noImageAfter && (
              <div key={`img-${section.id}`} className="note-image-wrap">
                <div className="note-image-inner">
                  {section.img
                    ? <img src={section.img} alt="" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 'var(--radius)', outline: '1px solid var(--border-light)' }} />
                    : <><div className="note-image-placeholder" /><div className="grain-overlay" /></>
                  }
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
        <div key={activeProject.name} className="page-transition" style={{ zIndex: 'var(--z-overlay)', background: 'var(--bg, #FAF8F4)' }}>
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
                className={`project writing-item animate${(!p.sections && !p.href) ? ' disabled' : ''}`}
                style={{ animationDelay: `${0.15 + i * 0.05}s`, '--end-opacity': (!p.sections && !p.href) ? 0.3 : 1, cursor: (p.sections || p.href) ? 'pointer' : 'not-allowed' }}
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






const NAV_TABS = [
  { key: 'home', label: 'Work' },
  { key: 'about', label: 'About' },
  { key: 'writing', label: 'Notes' },
]

let lastNavClip = null

function getClipForBtn(container, btn) {
  const cRect = container.getBoundingClientRect()
  const bRect = btn.getBoundingClientRect()
  const left = bRect.left - cRect.left
  const right = cRect.width - (left + bRect.width)
  const top = bRect.top - cRect.top
  const bottom = cRect.height - (top + bRect.height)
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 72px)`
}

function SegmentedNav({ active, setPage }) {
  const containerRef = useRef(null)
  const btnRefs = useRef({})
  const [clip, setClip] = useState(null)
  const switching = useRef(false)

  useLayoutEffect(() => {
    if (switching.current) return
    const container = containerRef.current
    const btn = btnRefs.current[active]
    if (!container || !btn) return
    const c = getClipForBtn(container, btn)
    setClip(c)
    lastNavClip = c
  }, [active])

  const handleTab = (key) => {
    if (key === active || switching.current) return
    const container = containerRef.current
    const btn = btnRefs.current[key]
    if (!container || !btn) return
    switching.current = true
    const c = getClipForBtn(container, btn)
    setClip(c)
    lastNavClip = c
    setTimeout(() => {
      switching.current = false
      setPage(key)
    }, 150)
  }

  const from = lastNavClip || clip

  return (
    <div className="home-nav-links" ref={containerRef}>
      <div className="nav-inactive-layer">
        {NAV_TABS.map(tab => (
          <button
            key={tab.key}
            ref={el => btnRefs.current[tab.key] = el}
            className={active === tab.key ? 'active' : ''}
            onClick={() => handleTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {clip && (
        <motion.div
          className="nav-active-layer"
          initial={{ clipPath: from || clip }}
          animate={{ clipPath: clip }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
        >
          {NAV_TABS.map(tab => (
            <button
              key={tab.key}
              className="active"
              onClick={() => handleTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}

function AboutPage({ setPage }) {
  return (
    <div className="page">
      <nav className="home-nav">
        <SegmentedNav active="about" setPage={setPage} />
      </nav>
      <div className="page-content" style={{ paddingTop: '96px' }}>
        <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>About</h1>
        <div className="about-text">
          <p className="animate" style={{ animationDelay: '0.15s' }}>I am a designer currently helping craft software experiences for pre-seed and seed companies.</p>
          <p className="animate" style={{ animationDelay: '0.2s' }}>In middle school I began making designs for my online gaming profile. Eventually, this would lead me to design school, but I've really grown by building things and being exposed to others who are exceptional at their craft.</p>
          <p className="animate" style={{ animationDelay: '0.25s' }}>Outside of work, I spend a lot of time at my computer still. I'm interested in sports, competitive CoD, listening to music, and collecting niche fragrances.</p>
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
  { title: 'Hell\'s Paradise: Jigokuraku', volume: 'Vol. 06', src: '/images/manga/hells-paradise-06.jpg', wiki: 'https://en.wikipedia.org/wiki/Hell%27s_Paradise:_Jigokuraku', body: 'Set in the Edo period of Japan, the series follows the journey of ninja Gabimaru and executioner Yamada Asaemon Sagiri as they search for the elixir of immortality. Multiple pairs of people with unaligned interests are thrown into an enclosed space, forced to work together.' },
  { title: 'Chainsaw Man', volume: 'Vol. 12', src: '/images/manga/chainsaw-man-12.jpg', wiki: 'https://en.wikipedia.org/wiki/Chainsaw_Man', body: 'Chainsaw Man follows the story of Denji, an impoverished teenager who makes a contract that fuses his body with that of Pochita, the dog-like Chainsaw Devil, granting him the ability to transform parts of his body into chainsaws. Denji eventually joins the Public Safety Devil Hunters, a government agency focused on combating Devils whenever they become a threat to Japan.' },
  { title: 'The Apothecary Diaries', volume: 'Vol. 10', src: '/images/manga/apothecary-diaries-10.jpg', wiki: 'https://en.wikipedia.org/wiki/The_Apothecary_Diaries', body: 'Set in a fictional country inspired by China in the Tang Dynasty, the series follows Maomao, a girl trained in medicine by her apothecary father. After being sold as a servant to the emperor\'s palace, she secretly uses her skills to solve mysteries and help others.' },
  { title: 'Gachiakuta', volume: 'Vol. 08', src: '/images/manga/gachiakuta-08.jpg', wiki: 'https://en.wikipedia.org/wiki/Gachiakuta', body: 'A young teenage boy named Rudo lives in the slums of a wealthy society among the "tribesfolk", a population descended from criminals and exiled by society. Falsely charged with the murder of his foster father, Rudo is dumped into "the Pit," an endless landscape of trash below the floating city.' },
  { title: 'Jujutsu Kaisen', volume: 'Vol. 00', src: '/images/manga/jujutsu-kaisen-00.jpg', wiki: 'https://en.wikipedia.org/wiki/Jujutsu_Kaisen', body: 'The series follows Yuta Okkotsu, a young student who becomes a sorcerer and seeks to control the Cursed Spirit of his childhood friend Rika Orimoto.' },
  { title: 'After the Rain', volume: 'Vol. 05', src: '/images/manga/after-the-rain-05.jpg', wiki: 'https://en.wikipedia.org/wiki/After_the_Rain_(manga)', body: 'After the Rain tells the story of Akira Tachibana, a high school student working part-time at a family restaurant, who starts falling in love with the manager, Masami Kondo, a forty-five-year-old divorcee with a young son.' },
  { title: 'Fly Me to the Moon', volume: 'Vol. 13', src: '/images/manga/fly-me-to-the-moon-13.jpg', wiki: 'https://en.wikipedia.org/wiki/Fly_Me_to_the_Moon_(manga)', body: 'The story centers around the teenage genius Nasa Yuzaki and his developing relationship with his new wife, Tsukasa, who saves him from a traffic accident during the beginning of the story.' },
  { title: 'Made in Abyss', volume: 'Vol. 09', src: '/images/manga/made-in-abyss.jpg', wiki: 'https://en.wikipedia.org/wiki/Made_in_Abyss', body: 'Made in Abyss follows Riko, an orphan girl living on the edge of a vast chasm known as the Abyss, who descends into its depths alongside a mysterious robot boy named Reg in search of her missing mother, a legendary Cave Raider.' },
  { title: 'My Hero Academia', volume: 'Vol. 29', src: '/images/manga/my-hero-academia-29.jpg', wiki: 'https://en.wikipedia.org/wiki/My_Hero_Academia', body: 'Set in a world where superpowers called "Quirks" have become commonplace, the story follows Izuku Midoriya, a boy who was born without a Quirk but still dreams of becoming a superhero. He is scouted by the world\'s greatest hero, All Might, who bestows his Quirk to Midoriya after recognizing his potential, and helps to enroll him in a prestigious high school for superheroes in training.' },
  { title: 'Golden Kamuy', volume: 'Vol. 02', src: '/images/manga/golden-kamuy.jpg', wiki: 'https://en.wikipedia.org/wiki/Golden_Kamuy', body: 'Set in the early twentieth century, Golden Kamuy follows Saichi Sugimoto, a veteran of the Russo-Japanese War, as he searches for a hidden cache of Ainu gold in the wilderness of Hokkaido alongside a young Ainu girl named Asirpa.' },
  { title: 'Kagurabachi', volume: 'Vol. 03', src: '/images/manga/kagurabachi.jpg', wiki: 'https://en.wikipedia.org/wiki/Kagurabachi', body: 'Kagurabachi follows Chihiro Rokuhira, a young swordsmith whose father is murdered by a criminal organization seeking enchanted blades. Armed with one of his father\'s legendary swords, Chihiro sets out for revenge.' },
  { title: 'Fire Force', volume: 'Vol. 30', src: '/images/manga/fire-force.jpg', wiki: 'https://en.wikipedia.org/wiki/Fire_Force', body: 'Set in a world where people spontaneously combust into flame-wreathed monsters called Infernals, Fire Force follows Shinra Kusakabe, a third-generation pyrokinetic who joins Special Fire Force Company 8 to uncover the truth behind the phenomenon.' },
  { title: 'That Time I Got Reincarnated as a Slime', volume: 'Vol. 19', src: '/images/manga/slime.jpg', wiki: 'https://en.wikipedia.org/wiki/That_Time_I_Got_Reincarnated_as_a_Slime', body: 'After being killed in a random street attack, thirty-seven-year-old Satoru Mikami is reincarnated in a fantasy world as a slime with unique abilities, eventually building a nation of monsters and forging alliances with humans and demons alike.' },
  { title: 'Classroom of the Elite', volume: 'Vol. 09', src: '/images/manga/classroom-of-the-elite.jpg', wiki: 'https://en.wikipedia.org/wiki/Classroom_of_the_Elite', body: 'Set in a prestigious high school where students are secretly ranked by ability, Classroom of the Elite follows Kiyotaka Ayanokoji, a seemingly indifferent student in the lowest-ranked class who harbors exceptional intelligence and quietly manipulates events around him.' },
  { title: 'Overlord', volume: 'Vol. 03', src: '/images/manga/overlord.jpg', wiki: 'https://en.wikipedia.org/wiki/Overlord_(novel_series)', body: 'When a popular fantasy game shuts down, the player Momonga finds himself trapped inside as his skeletal undead avatar. Rather than panic, he assumes the name Ainz Ooal Gown and sets out to explore this new world, accompanied by the now-sentient NPCs of his former guild.' },
]

const writings = [
  {
    title: 'Recent listening',
    category: 'List',
    type: 'music',
  },
  {
    title: 'Quotes from animations',
    category: 'Collection',
    type: 'anime',
  },
  {
    title: 'Collection of my favorite manga covers',
    category: 'Gallery',
    type: 'manga',
  },
  {
    title: 'Really cool people',
    category: 'List',
    type: 'sites',
    sections: [],
    content: [],
  },
  {
    title: 'For the love of sound',
    category: 'Writing',
    type: 'audio',
    date: 'Apr 6, 2026',
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
          <button className="back-btn" onClick={onBack} aria-label="Back">
            <LongArrowUpLeft width={16} height={16} strokeWidth={1.75} />
          </button>
          <h1 className="page-heading">{note.title}</h1>
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
                    ? <img src={section.img} alt="" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 'var(--radius)', outline: '1px solid var(--border-light)' }} />
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
      quoteAttr: 'Killua',
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
  const [tapped, setTapped] = useState(null)
  const avatarRef = useRef(null)
  const mouse = useRef({ x: 0, y: 0 })
  const pos = useRef({ x: 0, y: 0 })
  const raf = useRef(null)
  const quoteRefs = useRef([])
  const isMobile = window.matchMedia('(max-width: 1250px)').matches

  useEffect(() => {
    animeData.watching.filter(item => item.quoteImg).forEach(item => {
      const img = new Image()
      img.src = item.quoteImg
    })
  }, [])

  useEffect(() => {
    if (!isMobile) {
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
    }
  }, [hovered, isMobile])

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

  const pipX = useMotionValue(0)
  const pipY = useMotionValue(0)
  const pipInitialized = useRef(false)

  const getCorners = () => {
    const pad = 16
    const w = 180
    const h = 140
    const vw = window.innerWidth
    const vh = window.innerHeight
    return [
      { x: pad, y: pad },
      { x: vw - w - pad, y: pad },
      { x: pad, y: vh - h - pad },
      { x: vw - w - pad, y: vh - h - pad },
    ]
  }

  const snapToCorner = (fromX, fromY) => {
    const corners = getCorners()
    let closest = corners[0]
    let minDist = Infinity
    for (const c of corners) {
      const dx = fromX - c.x
      const dy = fromY - c.y
      const dist = dx * dx + dy * dy
      if (dist < minDist) { minDist = dist; closest = c }
    }
    const spring = { type: 'spring', stiffness: 600, damping: 30 }
    motionAnimate(pipX, closest.x, spring)
    motionAnimate(pipY, closest.y, spring)
  }

  const handleTap = (i) => {
    if (tapped === i) { setTapped(null); return }
    if (tapped === null) {
      const pad = 16
      const vw = window.innerWidth
      const startX = vw - 180 - pad
      const startY = pad
      pipX.set(startX)
      pipY.set(startY)
      pipInitialized.current = true
    }
    setTapped(i)
  }

  const handleDragEnd = (_, info) => {
    const elX = pipX.get() + info.velocity.x * 0.12
    const elY = pipY.get() + info.velocity.y * 0.12
    snapToCorner(elX, elY)
  }

  return (
    <div className="page">
      <div className="page-content" style={{ paddingTop: '156px' }}>
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <LongArrowUpLeft width={16} height={16} strokeWidth={1.75} />
        </button>
        <h1 className="page-heading">{note?.title}</h1>
        <div className="quote-list">
          {animeData.watching.filter(item => item.quote).map((item, i) => {
            const active = isMobile ? tapped : hovered
            const dimmed = active !== null && active !== i
            return (
              <div key={i} ref={el => quoteRefs.current[i] = el} className="quote-block" style={{ opacity: dimmed ? 0.3 : 1 }} onClick={isMobile ? () => handleTap(i) : undefined} onMouseEnter={!isMobile ? e => handleEnter(e, i) : undefined} onMouseMove={!isMobile ? handleMove : undefined} onMouseLeave={!isMobile ? () => setHovered(null) : undefined}>
                <p className="quote-text">{item.quote}</p>
                <p className="quote-attr">— <span className="quote-name">{item.quoteAttr ?? item.title}</span>{item.quoteSource && <>, <a href={item.quoteHref} target="_blank" rel="noreferrer">{item.quoteSource}</a></>}</p>
              </div>
            )
          })}
        </div>
        {isMobile ? (
          <AnimatePresence>
            {tapped !== null && (() => {
              const item = animeData.watching.filter(item => item.quote)[tapped]
              if (!item?.quoteImg) return null
              return (
                <motion.div
                  key="pip"
                  className="quote-avatar visible"
                  style={{ position: 'fixed', top: 0, left: 0, x: pipX, y: pipY, pointerEvents: 'auto' }}
                  drag
                  dragElastic={0.18}
                  dragMomentum={false}
                  onDragEnd={handleDragEnd}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <img src={item.quoteImg} alt="" className="quote-avatar-img" />
                </motion.div>
              )
            })()}
          </AnimatePresence>
        ) : (
          <div ref={avatarRef} className={`quote-avatar${hovered !== null ? ' visible' : ''}`}>
            {hovered !== null && (() => {
              const item = animeData.watching.filter(item => item.quote)[hovered]
              return item?.quoteImg ? (
                <img src={item.quoteImg} alt="" className="quote-avatar-img" />
              ) : null
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

function MangaPage({ note, onBack, setPage }) {
  const [openIdx, setOpenIdx] = useState(null)
  const activeCover = openIdx !== null ? mangaCovers[openIdx] : null
  const isOpen = openIdx !== null
  const isMobile = window.matchMedia('(max-width: 480px)').matches
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
    if (!isOpen) return
    const pageTransition = document.querySelector('.page-transition')
    const scrollY = window.scrollY
    const scrollbarWidth = pageTransition ? pageTransition.offsetWidth - pageTransition.clientWidth : 0

    document.documentElement.style.setProperty('--scrollbar-compensation', `${scrollbarWidth}px`)
    document.documentElement.classList.add('modal-open')
    document.body.classList.add('modal-open')
    document.body.style.top = `-${scrollY}px`
    pageTransition?.classList.add('manga-page-blurred')

    const preventScroll = (e) => {
      const panel = e.target.closest('.manga-panel')
      if (!panel) { e.preventDefault(); return }
      const scrollable = panel.querySelector('.manga-panel-content') || panel
      const { scrollTop, scrollHeight, clientHeight } = scrollable
      const atTop = scrollTop <= 0
      const atBottom = scrollTop + clientHeight >= scrollHeight
      const touch = e.touches[0]
      const dy = touch.clientY - (preventScroll.lastY || touch.clientY)
      preventScroll.lastY = touch.clientY
      if ((atTop && dy > 0) || (atBottom && dy < 0)) e.preventDefault()
    }
    const resetLastY = () => { preventScroll.lastY = null }
    document.addEventListener('touchmove', preventScroll, { passive: false })
    document.addEventListener('touchstart', resetLastY, { passive: true })

    return () => {
      document.removeEventListener('touchmove', preventScroll)
      document.removeEventListener('touchstart', resetLastY)
      document.documentElement.classList.remove('modal-open')
      document.body.classList.remove('modal-open')
      document.body.style.top = ''
      document.documentElement.style.removeProperty('--scrollbar-compensation')
      pageTransition?.classList.remove('manga-page-blurred')
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])

  return (
    <div className="page">
      <div className="page-content" style={{ paddingTop: '156px' }}>
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <LongArrowUpLeft width={16} height={16} strokeWidth={1.75} />
        </button>
        <h1 className="page-heading">{note?.title}</h1>
        <div className="manga-grid">
          {mangaCovers.map((cover, i) => (
            <div key={i} className="manga-item">
              <button className="manga-trigger" onClick={() => { if (window.matchMedia('(hover: hover)').matches) setOpenIdx(i) }}>
                <img src={cover.src} alt={`${cover.title} ${cover.volume}`} className="manga-cover" draggable="false" />
              </button>
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
                {activeCover?.wiki && (
                  <button className="manga-panel-close" aria-label="Open wiki" onClick={() => window.open(activeCover.wiki, '_blank', 'noreferrer')}>
                    <OpenNewWindow width={15} height={15} strokeWidth={1.75} />
                  </button>
                )}
                <button className="manga-panel-close" aria-label="Close panel" onClick={() => setOpenIdx(null)}>
                  <Xmark width={18} height={18} strokeWidth={1.75} />
                </button>
              </div>
              {activeCover && (
                <div className="manga-panel-content">
                  <img src={activeCover.src} alt={`${activeCover.title} ${activeCover.volume}`} className="manga-panel-cover" draggable="false" />
                  <div className="manga-panel-info">
                    <span className="manga-panel-title">{activeCover.title}<span className="manga-panel-vol">, {activeCover.volume}</span></span>
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

const sites = [
  { name: 'Gabriel Valdivia', site: 'gabrielvaldivia.com', href: 'https://www.gabrielvaldivia.com/', img: 'https://pub-0c00865d02c1476494008dbb74525b2a.r2.dev/favicon.png' },
  { name: 'Eryc', site: 'eryc.cc', href: 'https://eryc.cc/', img: 'https://eryc.cc/favicon.svg' },
  { name: 'Luke', site: 'luke.boo', href: 'https://www.luke.boo/', img: '/images/sites/4.png' },
  { name: 'Yiling', site: 'yiling.art', href: 'https://www.yiling.art/', img: 'https://www.yiling.art/favicon.jpg' },
  { name: 'Todd Hamilton', site: 'toddham.com', href: 'https://toddham.com/', img: 'https://toddham.com/favicon.ico' },
]

function SitesPage({ note, onBack }) {
  return (
    <div className="page">
      <div className="page-content" style={{ paddingTop: '156px' }}>
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <LongArrowUpLeft width={16} height={16} strokeWidth={1.75} />
        </button>
        <h1 className="page-heading">{note?.title}</h1>
        <div className="sites-rows">
          {sites.map((site, i) => (
            <a key={i} className="sites-row" href={site.href} target="_blank" rel="noreferrer" onMouseEnter={() => playClick(0.4)}>
              <span className="sites-title-cell">
                <span className="sites-thumb-wrap">
                  <img src={site.img} alt="" className="sites-thumb" />
                </span>
                <span className="sites-text">
                  <span className="sites-name">{site.name}</span>
                  <span className="sites-address-sub">{site.site}</span>
                </span>
              </span>
              <span className="sites-address">{site.site}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}


function AudioPage({ note, onBack }) {
  return (
    <div className="page">
      <div className="page-content" style={{ paddingTop: '156px' }}>
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <LongArrowUpLeft width={16} height={16} strokeWidth={1.75} />
        </button>
        <h1 className="page-heading">{note?.title}</h1>
        {note?.date && <p className="note-date">{note.date}</p>}
        <p className="note-body">I really love listening to music and I'm always listening to music. I'm not really concerned with critical listening or using the highest fidelity audio file. I just want it to sound good. After much testing I couldn't really discern much difference between music streaming platforms. The ethics behind these platforms is another topic, but I digress.</p>
        <p className="note-body">Gear for me has been the most notable influence on how music sounds. Growing up playing video games competitively was my sort of introduction to seeking better audio. Sound queues provide an edge. For headphones I use for music I've found that I enjoy a more fun sound and less about technicality. Currently I alternate between the ZMF Bokeh Open and Meze 109 Pro with the Fiio K11 R2R.</p>
      </div>
    </div>
  )
}

function MusicPage({ setPage, tracks, loading, onBack }) {
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

  return (
    <div className="music-page page-transition">
      <TopFade />
      <div className="page-content" style={{ paddingTop: '156px' }}>
        <button className="back-btn" onClick={onBack || (() => setPage('home'))} aria-label="Back">
          <LongArrowUpLeft width={16} height={16} strokeWidth={1.75} />
        </button>
        <h1 className="page-heading music-heading">Music</h1>
        <div className="music-col-headers">
          {!loading && tracks.length > 0 && (
            <div className="music-col-headers-row">
              {[['song', 'Title'], ['artist', 'Artist'], ['played', 'Played']].map(([col, label]) => (
                <button key={col} onClick={() => cycleSort(col)} style={{ color: sort.col === col ? 'var(--dark)' : '' }}>
                  {label} {sort.col === col ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="music-scroll">
          {loading ? (
            <p className="music-empty">Loading...</p>
          ) : tracks.length === 0 && ['localhost', '127.0.0.1'].includes(window.location.hostname) ? (
            <button className="music-connect" onClick={initiateSpotifyAuth}>Connect Spotify</button>
          ) : (
            <div className="music-rows">
              {displayedTracks.map(({ track, played_at }, i) => (
                <a key={i} className="music-row" href={track.external_urls.spotify} target="_blank" rel="noreferrer" onMouseEnter={() => playClick(0.4)}>
                  <span className="music-title-cell">
                    {track.album?.images?.[1]?.url && <img src={track.album.images[1].url} alt="" className="music-thumb" />}
                    <span className="music-track-info">
                      <span className="music-song-name">{cleanTitle(track.name)}</span>
                      <span className="music-artist music-artist-sub">{track.artists.map(a => a.name).join(', ')}</span>
                    </span>
                  </span>
                  <span className="music-artist music-artist-col">{track.artists.map(a => a.name).join(', ')}</span>
                  <span className="music-col-date">{formatDate(played_at)}</span>
                </a>
              ))}
            </div>
          )}
          <div className="music-scroll-fade" />
        </div>
      </div>
    </div>
  )
}

function WritingPage({ setPage, initialNote, tracks, loading }) {
  const [activeNote, setActiveNote] = useState(() => initialNote ? writings.find(w => w.type === initialNote) ?? null : null)
  const [animateList, setAnimateList] = useState(true)

  useEffect(() => {
    if (!animateList) return
    const t = setTimeout(() => setAnimateList(false), 1200)
    return () => clearTimeout(t)
  }, [animateList])

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

  if (activeNote?.type === 'audio') {
    return (
      <div key={activeNote.title} className="page-transition">
        <AudioPage note={activeNote} onBack={() => { setAnimateList(true); setActiveNote(null) }} />
      </div>
    )
  }

  if (activeNote?.type === 'music') {
    return (
      <MusicPage setPage={setPage} tracks={tracks} loading={loading} onBack={() => { setAnimateList(true); setActiveNote(null) }} />
    )
  }

  if (activeNote?.type === 'sites') {
    return (
      <div key={activeNote.title} className="page-transition">
        <SitesPage note={activeNote} onBack={() => { setAnimateList(true); setActiveNote(null) }} />
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
          <SegmentedNav active="writing" setPage={setPage} />
        </nav>
        <div className="page-content" style={{ paddingTop: '96px' }}>
          <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>Notes</h1>
          <ul className="projects no-bg-hover" style={{ width: '100%' }}>
            {writings.map((w, i) => (
              <li key={w.title} className={`project writing-item${animateList ? ' animate' : ''}${w.disabled ? ' disabled' : ''}`} style={{ animationDelay: `${0.1 + i * 0.05}s`, cursor: w.disabled ? 'not-allowed' : 'pointer', '--end-opacity': w.disabled ? 0.3 : 1 }} onClick={() => !w.disabled && setActiveNote(w)} onMouseEnter={() => playClick(0.4)}>
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
  const [activeProject, setActiveProject] = useState(null)
  const [hoveredProject, setHoveredProject] = useState(null)
  const hoverLines = ['Hover a project', 'THIS IS THE NEBULA', 'DUSK SOAKED IN GREEN LIGHT', 'A GLOW THAT NEVER ENDS', 'AND STILL, IT DRIFTS ONWARD', 'FADING THE MOMENT YOU LOOK AWAY']
  const hoverIndexRef = useRef(0)
  const [lastHoverText, setLastHoverText] = useState(null)
  useEffect(() => {
    projects.forEach(p => { if (p.img) { const img = new Image(); img.src = p.img } })
  }, [])

  if (activeProject) {
    return (
      <div className="page-transition">
        <ProjectDetailPage project={activeProject} onBack={() => { setHoveredProject(null); setActiveProject(null) }} setPage={setPage} />
      </div>
    )
  }

  return (
    <div className="split">
      <div className="left">
        <WorkShader />
        <GrainOverlay />
        {projects.filter(p => p.img).map(p => (
          <img
            key={p.name}
            src={p.img}
            alt=""
            className={`project-preview${hoveredProject?.name === p.name ? ' active' : ''}`}
            style={p.previewSize ? { maxHeight: p.previewSize } : undefined}
          />
        ))}
        <span className="left-label" style={{ opacity: hoveredProject?.img ? 0 : 1 }}>
          {lastHoverText || hoverLines[0]}
        </span>
      </div>
      <div className="right">
        <nav className="home-nav">
          <SegmentedNav active="home" setPage={setPage} />
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
                className={`project animate${(!p.sections && !p.href) ? ' dim disabled' : ''}`}
                style={{ cursor: (p.sections || p.href) ? 'pointer' : 'not-allowed', animationDelay: `${0.2 + i * 0.04}s`, '--end-opacity': (!p.sections && !p.href) ? 0.3 : 1 }}
                onClick={() => { if (p.sections && !p.linkOnly) setActiveProject(p); else if (p.href) window.open(p.href, '_blank', 'noreferrer') }}
                onMouseEnter={() => { setHoveredProject(p); playClick(0.4) }}
                onMouseLeave={() => { setLastHoverText(hoverLines[hoverIndexRef.current % hoverLines.length]); hoverIndexRef.current++; setHoveredProject(null) }}
              >
                <span className="project-name">{p.name}</span>
                <span className="project-desc">{p.desc}</span>
                <span className="project-leader" />
                <span className="project-year">{p.year}</span>
              </li>
            ))}
          </ul>
        </div>
        <WorkFooter setPage={setPage} />
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPageRaw] = useState('home')
  const scrollRef = useRef(null)

  const setPage = useCallback((p) => {
    setPageRaw(p)
  }, [])

  useLayoutEffect(() => {
    const titles = { home: 'Baltzelle', about: 'About', writing: 'Notes', prototypes: 'Play' }
    document.title = titles[page] ?? 'Baltzelle'
    scrollRef.current?.scrollIntoView(true)
  }, [page])



  const [spotifyTracks, setSpotifyTracks] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('spotify_tracks')) || [] } catch { return [] }
  })
  const [spotifyLoading, setSpotifyLoading] = useState(() => !sessionStorage.getItem('spotify_tracks'))

  useEffect(() => {
    fetch('/api/spotify')
      .then(r => r.json())
      .then(items => {
        const deduped = Array.isArray(items) ? dedupeTracks(items) : []
        setSpotifyTracks(deduped)
        setSpotifyLoading(false)
        sessionStorage.setItem('spotify_tracks', JSON.stringify(deduped))
      })
      .catch(() => setSpotifyLoading(false))
  }, [])

  useEffect(() => {
    mangaCovers.forEach(c => { const img = new Image(); img.src = c.src })
    sites.forEach(s => { if (s.img) { const img = new Image(); img.src = s.img } })
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
    <div ref={scrollRef} style={{ minHeight: '100%' }}>
      {page === 'home'       && <HomePage       setPage={setPage} />}
      {page === 'about'      && <AboutPage      setPage={setPage} />}
      {page === 'writing'    && <WritingPage    setPage={setPage} tracks={spotifyTracks} loading={spotifyLoading} />}
      {page === 'prototypes' && <PrototypesPage setPage={setPage} />}
    </div>
  )
}

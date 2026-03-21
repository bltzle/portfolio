import { useState, useEffect, useRef } from 'react'

const SPOTIFY_CLIENT_ID = '5ee9147feda6434aa4414c48c2a472bd'
const SPOTIFY_REDIRECT  = 'http://127.0.0.1:5173/callback'
const SPOTIFY_SCOPES    = 'user-read-recently-played'

function formatDate(str) {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
  if (!data.access_token) return null
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

import { CornerDownLeftIcon } from './CornerDownLeftIcon'
import { ShaderGradient, ShaderGradientCanvas } from 'shadergradient'
import { Agentation } from 'agentation'
import './style.css'

const projects = [
  {
    name: 'Ritual Dental',
    desc: 'Using AI to better inform patient oral health',
    year: '2024',
    img: '/images/ritual-dental/cover.jpg',
    href: 'https://ritualdental.com',
    tagline: 'Personalized preventative oral care that sticks',
    role: 'Product Designer',
    tools: 'Figma',
    team: ['Gabriel Valdivia', 'Alex Valdivia', 'Arman Ozgun', 'Daniel Chung'],
    overview: 'Ritual Dental is a next-generation dental practice using AI to form a comprehensive health perspective for prevention and early detection to boost patients quality of life.',
    timeline: 'May – June (2 months)',
    sections: [
      { id: 'problem',    heading: 'Ritual Dental' },
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
      {
        id: 'acknowledgements',
        heading: 'Acknowledgements',
        headingClass: 'note-image-caption note-image-caption--left',
        body: `This project was done with the help of my incredible teammates and in collaboration with Gabriel Valdivia, Alex Valdivia, Arman Ozgun, and Daniel Chung. We worked on this together over the course of summer 2024.`,
        bodyClass: 'note-image-caption note-image-caption--left',
        sectionClass: 'note-section--tight',
      },
    ],
  },
  { name: 'Goodword',              desc: 'Maintain relationships in your professional network',         year: '2024' },
  { name: 'Workmate',              desc: 'Turning your inbox into an auto-updating task list',         year: '2024', img: '/images/workmate/cover.jpg' },
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

function WorkFooter() {
  const location = useVisitorLocation()
  return (
    <div className="work-links">
<span className="visitor-location">Last visitor from <span className="visitor-location-value">{location ?? '—'}</span></span>
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
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06, pointerEvents: 'none', zIndex: 2, mixBlendMode: 'overlay' }} />
}

function BackNav({ setPage }) {
  return (
    <button className="back-nav" onClick={() => setPage('work')}>
      <CornerDownLeftIcon size={12} />
      Back
    </button>
  )
}

function Nav({ page, setPage }) {
  return (
    <nav className="nav">
      <a href="#" className={page === 'work'  ? 'active' : ''} onClick={e => { e.preventDefault(); setPage('work')  }}>Home</a>
      <a href="#" className={page === 'about' ? 'active' : ''} onClick={e => { e.preventDefault(); setPage('about') }}>About</a>
      <a href="#" className={page === 'writing' ? 'active' : ''} onClick={e => { e.preventDefault(); setPage('writing') }}>Notes</a>
    </nav>
  )
}

function ProjectDetailPage({ project, onBack }) {
  const [activeId, setActiveId] = useState(project.sections[0]?.id)
  const containerRef = useRef(null)
  const scrollingRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observers = project.sections.map(({ id }) => {
      const el = container.querySelector(`#${id}`)
      if (!el) return null
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting && !scrollingRef.current) setActiveId(id) },
        { root: null, rootMargin: '-30% 0px -60% 0px', threshold: 0 }
      )
      observer.observe(el)
      return observer
    }).filter(Boolean)
    return () => observers.forEach(o => o.disconnect())
  }, [project])

  return (
    <div className="note-layout" ref={containerRef}>
      <TopFade />
      <aside className="note-sidebar">
        <nav className="note-toc">
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
      <article className="note-article">
        <button className="note-back" onClick={onBack}>Home</button>
        <header className="note-header">
          <h1 className="note-title">
            {project.href
              ? <a href={project.href} target="_blank" rel="noreferrer" className="project-title-link">{project.name}</a>
              : project.name}
          </h1>
          <span className="note-date">{project.desc}</span>
        </header>
        {project.content.map((section, si) => (
          <>
            {(section.heading || section.body) && (
              <section key={section.id} id={section.id} className={`note-section${section.sectionClass ? ` ${section.sectionClass}` : ''}`}>
                {section.heading && <h2 className={section.headingClass ?? 'note-section-heading'}>{section.heading}</h2>}
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
          </>
        ))}
      </article>
    </div>
  )
}

function WorkPage({ setPage }) {
  const [activeProject, setActiveProject] = useState(null)
  const [hoveredProject, setHoveredProject] = useState(null)

  if (activeProject) {
    return (
      <div key={activeProject.name} className="page-transition">
        <ProjectDetailPage project={activeProject} onBack={() => setActiveProject(null)} />
      </div>
    )
  }

  return (
    <div className="split">
      <div className="left">
        <GrainOverlay />
        <span className="left-label animate" style={{ animationDelay: '0.1s', transition: 'opacity 0.3s ease', opacity: hoveredProject?.img ? 0 : 1 }}>Hover a project</span>
        {projects.filter(p => p.img).map(p => (
          <img
            key={p.name}
            src={p.img}
            alt={p.name}
            className="project-preview"
            style={{ opacity: hoveredProject?.name === p.name ? 1 : 0 }}
          />
        ))}
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
      </div>
      <div className="right">
        <Nav page="work" setPage={setPage} />
        <div className="content">
          <header className="header">
            <h1 className="animate" style={{ animationDelay: '0.1s' }}>Matthew Baltzelle</h1>
            <p className="animate" style={{ animationDelay: '0.15s' }}>Designer crafting stories for early stage companies</p>
          </header>
          <ul className="projects">
            {projects.map((p, i) => (
              <li
                key={p.name}
                className={`project animate${p.dim ? ' dim' : ''}`}
                style={{ animationDelay: `${0.3 + i * 0.05}s`, '--end-opacity': p.dim ? 0.4 : 1, cursor: p.sections ? 'pointer' : 'not-allowed' }}
                onClick={() => { if (p.sections) { setHoveredProject(null); setActiveProject(p) } }}
                onMouseEnter={() => { setHoveredProject(p); playClick(0.4) }}
                onMouseLeave={() => setHoveredProject(null)}
              >
                <span className="project-name">{p.name}</span>
                <span className="project-desc">{p.desc}</span>
                <span className="project-year">{p.year}</span>
              </li>
            ))}
          </ul>
        </div>
        <WorkFooter />
      </div>
    </div>
  )
}



const albums = [
  { title: 'Album 1', img: '/images/music/album1.jpg', fallback: 'https://picsum.photos/seed/a1/120/120', href: 'https://tidal.com/track/396213085/u' },
  { title: 'Album 2', img: '/images/music/album2.jpg', fallback: 'https://picsum.photos/seed/a2/120/120', href: 'https://tidal.com/track/452623922/u' },
  { title: 'Album 3', img: '/images/music/album3.jpg', fallback: 'https://picsum.photos/seed/a3/120/120', href: 'https://tidal.com/track/97458481/u'  },
  { title: 'Album 4', img: '/images/music/album4.jpg', fallback: 'https://picsum.photos/seed/a4/120/120', href: 'https://tidal.com/track/474707709/u' },
  { title: 'Album 5', img: '/images/music/album5.jpg', fallback: 'https://picsum.photos/seed/a5/120/120', href: 'https://tidal.com/track/314943653/u' },
  { title: 'Album 6', img: '/images/music/album6.jpg', fallback: 'https://picsum.photos/seed/a6/120/120', href: 'https://tidal.com/track/304142580/u' },
]


function AboutPage({ setPage }) {
  return (
    <div className="page">
      <Nav page="about" setPage={setPage} />
      <div className="page-content">
        <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>Baltzelle</h1>
        <div className="about-text">
          <p className="animate" style={{ animationDelay: '0.15s' }}>I am a designer currently helping craft software experiences for pre-seed and seed companies.</p>
          <p className="animate" style={{ animationDelay: '0.2s' }}>In middle school I began making designs for my online gaming profile. Eventually, this would lead me to design school, but I've really grown by building things and being exposed to others who are exceptional at their craft.</p>
          <p className="animate" style={{ animationDelay: '0.25s' }}>Currently I'm interested in code and glyph dithers. Outside of work I'm interested in baroque art, competitive CoD, and collecting niche fragrances.</p>
        </div>
      </div>
    </div>
  )
}

const writings = [
  {
    title: 'The Animation Bar',
    desc: 'On craft, borrowed from anime',
    category: 'Writing',
    year: '2026',
    date: 'March 2026',
    sections: [
      { id: 'motion',    heading: 'Fluidity' },
      { id: 'camera',    heading: 'Presence' },
      { id: 'sound',     heading: 'Restraint' },
      { id: 'weight',    heading: 'Emotion' },
      { id: 'bar',       heading: 'Care' },
    ],
    content: [
      {
        id: 'intro',
        body: `I draw a lot of inspiration from Japanese animation and manga. What makes it such a rich source is how many disciplines it holds at once: storytelling and pacing, music and sound, camera angles, fluid motion, color.\n\nWhat elevates the best of it is the commitment to craft, the willingness to build entire visual languages, mythologies, and atmospheres from scratch. That level of ambition is something I try to carry into everything I design. What follows are the things I notice when watching high-quality anime, and what I think makes them great.`,
        noImageAfter: true,
      },
      {
        id: 'motion',
        heading: 'Fluidity',
        body: `Jujutsu Kaisen is a good place to start. The animation is fluid in a way that's immediately noticeable. Movements carry through, cloth settles a beat late, impacts feel heavy. None of it is realistic, but it all reads as true.\n\nWhat makes it work is the attention underneath it. Anticipation before a movement, follow-through after. Small decisions that compound into something that feels genuinely alive.`,
        captionPrefix: 'Maki and Mai Zenin, from ',
        caption: 'Jujutsu Kaisen',
        captionHref: 'https://en.wikipedia.org/wiki/Jujutsu_Kaisen',
      },
      {
        id: 'camera',
        heading: 'Presence',
        body: `Frieren is different. Where most animation asks you to watch, Frieren asks you to feel. The story follows an elven mage long after the adventure is over. The hero has died, the party has scattered, the world has moved on. What's left is memory, time, and the quiet weight of outliving everyone you loved.\n\nLook at how she rests in the water. Her hair drifts with the current, the fabric of her dress responding to what's underneath her, light scattering through the foliage behind her. None of it announces itself, it's just physics rendered with enough care that she feels like she's genuinely inhabiting the world rather than sitting on top of it. That's what the polish is doing here, not impressing you but grounding you.`,
        captionPrefix: 'Frieren, from ',
        caption: 'Frieren: Beyond Journey\'s End',
        captionHref: 'https://en.wikipedia.org/wiki/Frieren',
      },
      {
        id: 'sound',
        heading: 'Restraint',
        body: `Vinland Saga knows when to be quiet. It's a show about war and revenge and the cost of violence, and yet some of its most powerful moments have nothing in them at all. Just a figure, a sky, and room to breathe. The clouds move slowly, the character sits small against all that open space, and nothing is asking for your attention.\n\nThat kind of restraint is a choice. Knowing what to take out is just as hard as knowing what to put in, maybe harder. The emptiness isn't absence, it's intention. And because nothing is competing, you give the moment everything you have. Simplicity isn't a lack of craft. It's often the hardest version of it.`,
        captionPrefix: 'Thorfinn, from ',
        caption: 'Vinland Saga',
        captionHref: 'https://en.wikipedia.org/wiki/Vinland_Saga_(manga)',
      },
      {
        id: 'weight',
        heading: 'Emotion',
        body: `Ranking of Kings looks like a children's story. Round designs, a soft storybook world. Within the first few episodes it becomes one of the most emotionally devastating things you'll watch.\n\nBojji is deaf. The animation speaks for him. A slump of the shoulders. The way he looks up at someone twice his size. You feel what he feels without being told to.\n\nYou can't instruct someone to feel something. You build something honest, get out of the way, and let the moment land.`,
        captionPrefix: 'Bojji, from ',
        caption: 'Ranking of Kings',
        captionHref: 'https://en.wikipedia.org/wiki/Ranking_of_Kings',
      },
      {
        id: 'bar',
        heading: 'Care',
        body: `High-craft anime sets a standard that's useful to borrow, not just aesthetically but as a way of thinking. The visual polish isn't decoration, it's the result of every element being considered. Nothing is there without a reason, and nothing looks the way it looks by accident.\n\nMost software doesn't reach that standard. Some of it is resources, some of it is habit, but a lot of it is just not caring enough. What separates the best anime is the people behind it. They have the craft and they genuinely care about the work they're producing. The same is true of great software. It usually comes down to the same thing: people who care enough to sweat the details.`,
      },
    ],
  },
  {
    title: 'Recent Listening',
    desc: 'A running list of what\'s been on',
    category: 'Music',
    year: '2026',
    type: 'music',
  },
  {
    title: 'Purchasing a Typeface',
    desc: 'On the typographic qualities I keep coming back to',
    category: 'Writing',
    year: '2025',
    date: '2025',
    sections: [
      { id: 'first-impression', heading: 'Readability and legibility' },
      { id: 'weight',           heading: 'Weight and contrast' },
      { id: 'spacing',          heading: 'Spacing and rhythm' },
      { id: 'voice',            heading: 'Hierarchy' },
      { id: 'the-choice',       heading: 'Personality and tone' },
    ],
    content: [
      {
        id: 'type-intro',
        body: `Matter is a grotesque sans-serif typeface designed by Martin Vácha and published by Displaay, an independent type foundry focused on developing distinctive typefaces that feel fresh without abandoning the classics.`,
        noImageAfter: true,
      },
      {
        id: 'first-impression',
        heading: 'Readability and legibility',
        body: `Placeholder text for first impression section. Type hits you before you read it. The shape of a letterform carries tone, weight, and attitude before a single word has been processed.`,
      },
      {
        id: 'weight',
        heading: 'Weight and contrast',
        body: `Placeholder text for weight and contrast section. The thickness of a stroke, the contrast between thick and thin — these are not aesthetic choices in isolation. They carry history and intention.`,
      },
      {
        id: 'spacing',
        heading: 'Spacing and rhythm',
        body: `Placeholder text for spacing and rhythm section. How letters sit next to each other, how lines breathe. Rhythm in type is the same as rhythm in music — you feel it before you understand it.`,
      },
      {
        id: 'voice',
        heading: 'Hierarchy',
        body: `Placeholder text for hierarchy section. Every typeface has a voice. Some are authoritative, some are warm, some are neutral by design. Choosing one is choosing what to say before the words say anything.`,
      },
      {
        id: 'the-choice',
        heading: 'Personality and tone',
        body: `Placeholder text for personality and tone section. The typeface is never just a container for content. It is content. Getting it wrong doesn't make the words less readable — it makes them say something you didn't mean.`,
      },
    ],
  },
  {
    title: 'Building My Website',
    desc: 'On owning the thing that represents you',
    category: 'Writing',
    year: '2026',
    date: 'March 2026',
    sections: [
      { id: 'control',   heading: 'Control' },
      { id: 'craft',     heading: 'Craft' },
      { id: 'permanence', heading: 'Permanence' },
    ],
    content: [
      {
        id: 'intro',
        body: `Most designers have a Squarespace. A template, a grid, a set of constraints somebody else decided. That's fine. But at some point I wanted to know if I could build the thing myself — and what it would feel like if I did.`,
        noImageAfter: true,
      },
      {
        id: 'control',
        heading: 'Control',
        body: `A portfolio template is someone else's opinion about how a portfolio should look. It carries assumptions about hierarchy, about what matters, about what a designer is supposed to show. Building from scratch means every decision is yours. The spacing, the type, the way things move. You can't blame the theme.`,
      },
      {
        id: 'craft',
        heading: 'Craft',
        body: `There's a version of this that's just ego — wanting to say you built it yourself. But the more honest reason is that I think the website is part of the work. How it feels to use says something about how you think. If I'm asking companies to trust me with their product, it helps to have made something I'm proud of on my own terms.`,
      },
      {
        id: 'permanence',
        heading: 'Permanence',
        body: `Templates get discontinued. Platforms pivot. Hosted tools go away or change pricing. A site you built yourself lives as long as you want it to. That's worth something.`,
      },
    ],
  },
]

function TopFade() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '120px',
      pointerEvents: 'none',
      zIndex: 10,
      background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 40%, rgba(255,255,255,0) 100%)',
    }} />
  )
}

function NoteDetailPage({ note, onBack }) {
  const [activeId, setActiveId] = useState('__intro')
  const containerRef = useRef(null)
  const scrollingRef = useRef(false)

  useEffect(() => {
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
  }, [note])

  return (
    <div className="note-layout" ref={containerRef}>
      <TopFade />
      <aside className="note-sidebar">
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
          >Intro</a>
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
      <article className="note-article">
        <button className="note-back" onClick={onBack}>Notes</button>
        <header className="note-header">
          <h1 className="note-title">{note.title}</h1>
          <span className="note-date">{note.date}</span>
        </header>
        {note.content.map((section, si) => (
          <>
            {(section.heading || section.body) && (
              <section key={section.id} id={section.id} className={`note-section${section.sectionClass ? ` ${section.sectionClass}` : ''}`}>
                {section.heading && <h2 className={section.headingClass ?? 'note-section-heading'}>{section.heading}</h2>}
                {section.body && section.body.split('\n\n').map((p, i) => (
                  <p key={i} className={section.bodyClass ?? 'note-body'}>{p}</p>
                ))}
              </section>
            )}
            {si < note.content.length - 1 && !section.noImageAfter && (
              <div key={`img-${section.id}`} className="note-image-wrap">
                <div className="note-image-inner">
                  {si === 1
                    ? <img src="/tumblr_8b97eed4e22307c56b8c51612a492c87_8b2d8fbc_540.gif" alt="" className="note-image-placeholder" style={{ objectFit: 'cover' }} />
                    : si === 2
                    ? <img src="/frieren.gif" alt="" className="note-image-placeholder" style={{ objectFit: 'cover' }} />
                    : si === 3
                    ? <img src="/vinland.gif" alt="" className="note-image-placeholder" style={{ objectFit: 'cover' }} />
                    : si === 4
                    ? <img src="/boji.gif" alt="" className="note-image-placeholder" style={{ objectFit: 'cover' }} />
                    : <div className="note-image-placeholder" />}
                  <div className="grain-overlay" />
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
          </>
        ))}
      </article>
    </div>
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


function MusicPage({ note, onBack }) {
  const cached = localStorage.getItem('spotify_tracks')
  const [tracks, setTracks] = useState(cached ? dedupeTracks(JSON.parse(cached)) : [])
  const [loading, setLoading] = useState(!cached)
  const [authed, setAuthed] = useState(!!localStorage.getItem('spotify_tokens'))
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
      const unique = dedupeTracks(data.items ?? [])
      localStorage.setItem('spotify_tracks', JSON.stringify(unique))
      setTracks(unique)
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [authed])

  return (
    <div className="music-page">
      <TopFade />
      <div className="music-scroll-fade" />
      <div className="music-col-headers">
        <div className="music-inner">
          <div className="music-breadcrumb">
            <button className="music-back-arrow" onClick={onBack}>Notes</button>
            <span className="music-breadcrumb-sep">›</span>
            <span className="music-breadcrumb-current">{note?.title}</span>
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {track.album?.images?.[2]?.url && <img src={track.album.images[2].url} alt="" style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, border: '1px solid rgba(0,0,0,0.06)' }} />}
                    {cleanTitle(track.name)}
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
  )
}

function WritingPage({ setPage }) {
  const [activeNote, setActiveNote] = useState(null)

  if (activeNote?.type === 'music') {
    return (
      <div key={activeNote.title} className="page-transition">
        <MusicPage note={activeNote} onBack={() => setActiveNote(null)} />
      </div>
    )
  }

  if (activeNote) {
    return (
      <div key={activeNote.title} className="page-transition">
        <NoteDetailPage note={activeNote} onBack={() => setActiveNote(null)} />
      </div>
    )
  }

  return (
    <div className="page">
      <Nav page="writing" setPage={setPage} />
      <div className="page-content">
        <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>A collection of thoughts, ideas, observations, and resources</h1>
        <ul className="projects no-bg-hover" style={{ width: '100%' }}>
          {writings.map((w, i) => (
            <li key={w.title} className="project writing-item animate" style={{ animationDelay: `${0.1 + i * 0.05}s`, cursor: 'pointer' }} onClick={() => setActiveNote(w)} onMouseEnter={() => playClick(0.4)}>
              <div className="writing-item-main">
                <span className="project-name">{w.title}</span>
                <span className="writing-meta">{w.desc}</span>
              </div>
              {w.category && <span className="writing-category">{w.category}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('work')

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
      setPage('writing')
    })
  }, [])

  return (
    <div key={page} className="page-transition">
      {page === 'work'         && <WorkPage         setPage={setPage} />}
      {page === 'about'        && <AboutPage        setPage={setPage} />}
      {page === 'writing'      && <WritingPage      setPage={setPage} />}
      {/* <Agentation /> */}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { CornerDownLeftIcon } from './CornerDownLeftIcon'
import { ShaderGradient, ShaderGradientCanvas } from 'shadergradient'
import { Agentation } from 'agentation'
import './style.css'

const projects = [
  { name: 'Ritual Dental',         desc: 'Using AI to better inform patient oral health',              year: '2024' },
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

function WorkFooter() {
  const location = useVisitorLocation()
  return (
    <div className="work-links">
      <a href="mailto:mabaltzelle@gmail.com">Email</a>
      <a href="http://www.linkedin.com/in/matthew-baltzelle" target="_blank" rel="noreferrer">LinkedIn</a>
      <a href="https://twitter.com/bltzle" target="_blank" rel="noreferrer">Twitter</a>
      <span className="visitor-location">Last visitor from {location ?? '—'}</span>
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
      <a href="#" className={page === 'work'  ? 'active' : ''} onClick={e => { e.preventDefault(); setPage('work')  }}>Work</a>
      <a href="#" className={page === 'about' ? 'active' : ''} onClick={e => { e.preventDefault(); setPage('about') }}>About</a>
      <a href="#" className={page === 'thoughts' ? 'active' : ''} onClick={e => { e.preventDefault(); setPage('thoughts') }}>Thoughts</a>
    </nav>
  )
}

function WorkPage({ setPage }) {
  return (
    <div className="split">
      <div className="left">
        <GrainOverlay />
        <span className="left-label animate" style={{ animationDelay: '0.1s' }}>Hover a project</span>
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
                style={{ animationDelay: `${0.3 + i * 0.05}s`, '--end-opacity': p.dim ? 0.4 : 1, cursor: p.dim ? 'not-allowed' : 'pointer' }}
                onClick={() => p.page && setPage(p.page)}
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

function ThoughtsPage({ setPage }) {
  return (
    <div className="page">
      <Nav page="thoughts" setPage={setPage} />
      <div className="page-content">
        <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>Thoughts</h1>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('work')

  return (
    <div key={page} className="page-transition">
      {page === 'work'         && <WorkPage         setPage={setPage} />}
      {page === 'about'        && <AboutPage        setPage={setPage} />}
      {page === 'thoughts'      && <ThoughtsPage      setPage={setPage} />}
      {/* <Agentation /> */}
    </div>
  )
}
